import { http, HttpBadRequestError, HttpBody, HttpNotFoundError, Redirect, UploadedFile } from '@deepkit/http';
import { AnyResponse, createPersistedEntity, uuid7 } from '@zyno-io/dk-server-foundation';
import { keyBy, uniq } from 'lodash';

import { BuildCiTokenMiddleware, UserAuthMiddleware } from '../accessories/AuthMiddleware.accessory';
import { ApiController } from '../accessories/Controller.accessory';
import { DB } from '../database';
import { AppEntity } from '../entities/App.entity';
import { BuildEntity } from '../entities/Build.entity';
import { BuildScreenEntity } from '../entities/BuildScreen.entity';
import { ScreenEntity } from '../entities/Screen.entity';
import { S3Service } from '../services/S3.service';

export type IAppScreenResponse = Pick<ScreenEntity, 'id' | 'name'>;
export type IBuildScreenResponse = {
    screenId: string;
    name: string;
    currentBuildScreen:
        | Pick<BuildScreenEntity, 'id' | 'buildId' | 'matchedBuildId' | 'approvalBuildId' | 'screenId' | 'status'>
        | undefined;
    referenceBuildScreen:
        | Pick<BuildScreenEntity, 'id' | 'buildId' | 'matchedBuildId' | 'approvalBuildId' | 'screenId' | 'status'>
        | undefined;
};
export type IBuildScreenCreateResponse = Pick<BuildScreenEntity, 'id' | 'screenId' | 'status'> &
    Pick<ScreenEntity, 'name'>;

@ApiController('/api/apps/:appId/builds/:id')
export class BuildScreensController {
    constructor(
        private db: DB,
        private s3Svc: S3Service
    ) {}

    @http.GET('screens')
    @http.middleware(UserAuthMiddleware)
    async getScreens(appId: string, id: string): Promise<IBuildScreenResponse[]> {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();

        const app = await this.db.query(AppEntity).filter({ id: appId }).findOne();

        const referenceBuild = await BuildEntity.query()
            .filter({ appId: app.id, branchId: app.defaultBranchId, status: 'changes approved', id: { $lt: build.id } })
            .orderBy('id', 'desc')
            .findOneOrUndefined();

        const currentBuildScreens = await BuildScreenEntity.query().filter({ appId, buildId: build.id }).find();

        const referenceBuildScreens = referenceBuild
            ? await BuildScreenEntity.query().filter({ appId, buildId: referenceBuild.id }).find()
            : [];

        const currentBuildScreensById = keyBy(currentBuildScreens, 'screenId');
        const referenceBuildScreensById = keyBy(referenceBuildScreens, 'screenId');
        const screenIds = uniq(
            [...currentBuildScreens, ...referenceBuildScreens].map(buildScreen => buildScreen.screenId)
        );

        const buildScreens = [...screenIds].map(screenId => ({
            screenId,
            currentBuildScreen: currentBuildScreensById[screenId],
            referenceBuildScreen: referenceBuildScreensById[screenId]
        }));

        const screens = await ScreenEntity.query()
            .filter({ id: { $in: screenIds } })
            .select('id', 'name')
            .find();
        const screensById = keyBy(screens, 'id');

        return buildScreens.map(buildScreen => ({
            ...buildScreen,
            name: screensById[buildScreen.screenId]?.name
        }));
    }

    @http.POST('screens')
    @http.middleware(BuildCiTokenMiddleware)
    async uploadScreen(
        appId: string,
        id: string,
        body: HttpBody<{ image: UploadedFile }>
    ): Promise<IBuildScreenCreateResponse | { status: string }> {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();
        if (build.status !== 'draft') throw new HttpBadRequestError('build is not in draft state');

        return this.db.transaction(async txn => {
            const screenName = body.image.name?.replace(/\.[^.]+$/, '');

            let screen = await txn.query(ScreenEntity).filter({ appId, name: screenName }).findOneOrUndefined();

            if (!screen) {
                screen = await createPersistedEntity(
                    ScreenEntity,
                    {
                        id: uuid7(),
                        appId,
                        name: screenName
                    },
                    txn
                );
            } else {
                const buildScreen = await txn
                    .query(BuildScreenEntity)
                    .filter({ buildId: id, screenId: screen.id })
                    .findOneOrUndefined();
                if (buildScreen) throw new HttpBadRequestError('screen with same name already uploaded for this build');
            }

            const buildScreen = await createPersistedEntity(
                BuildScreenEntity,
                {
                    id: uuid7(),
                    appId,
                    buildId: id,
                    screenId: screen.id,
                    status: 'new',
                    storageStatus: 'stored'
                },
                txn
            );

            await this.s3Svc.uploadFile(
                body.image.path,
                this.s3Svc.getPathForScreen(appId, id, screen.id),
                'image/png'
            );

            return {
                ...buildScreen,
                name: screen.name
            };
        });
    }

    // TEST for getting images
    @http.GET('screens/:screenId/image')
    @http.middleware(UserAuthMiddleware)
    async getScreenImage(appId: string, id: string, screenId: string): AnyResponse {
        const url = await this.s3Svc.getSignedUrl(this.s3Svc.getPathForScreen(appId, id, screenId));
        return Redirect.toUrl(url);
    }

    @http.GET('screens/:screenId/diff')
    @http.middleware(UserAuthMiddleware)
    async getScreenDiff(appId: string, id: string, screenId: string): AnyResponse {
        const url = await this.s3Svc.getSignedUrl(this.s3Svc.getPathForDiff(appId, id, screenId));
        return Redirect.toUrl(url);
    }
}
