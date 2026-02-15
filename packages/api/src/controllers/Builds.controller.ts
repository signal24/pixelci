import {
    http,
    HttpBadRequestError,
    HttpNotFoundError,
    HttpQueries,
    HttpRequest,
    HttpUnauthorizedError
} from '@deepkit/http';
import { createPersistedEntity, OkResponse, uuid7, WorkerService } from '@zyno-io/dk-server-foundation';
import axios from 'axios';

import { ScopedLogger } from '@deepkit/logger';
import { keyBy, uniq } from 'lodash';
import {
    BuildCiTokenMiddleware,
    hashCiToken,
    UserAuthMiddleware,
    validateCiToken
} from '../accessories/AuthMiddleware.accessory';
import { ApiController } from '../accessories/Controller.accessory';
import { DB } from '../database';
import { AppEntity } from '../entities/App.entity';
import { BranchEntity } from '../entities/Branch.entity';
import { BuildEntity } from '../entities/Build.entity';
import { BuildScreenEntity } from '../entities/BuildScreen.entity';
import { UserEntity } from '../entities/User.entity';
import { ProcessBuildJob } from '../jobs/ProcessBuild.job';
import { VcsService } from '../services/Vcs.service';

type IBuildResponse = Pick<
    BuildEntity,
    'id' | 'branchId' | 'commitHash' | 'commitSubject' | 'commitAuthor' | 'createdAt' | 'status'
> & {
    branchName: string;
};
type IBuildBasicResponse = Pick<BuildEntity, 'status'>;
interface IBuildApprovalResponse {
    vcsUrl: string | false;
}

@ApiController('/api/apps/:appId/builds')
export class BuildsController {
    constructor(
        private workerSvc: WorkerService,
        private vcsSvc: VcsService,
        private db: DB,
        private logger: ScopedLogger
    ) {}

    @http.GET()
    @http.middleware(UserAuthMiddleware)
    async index(appId: string, query: HttpQueries<{ branchId?: string }>): Promise<IBuildResponse[]> {
        const app = await AppEntity.query().filter({ id: appId }).findOneOrUndefined();
        if (!app) throw new HttpNotFoundError();

        const { branchId } = query;

        const builds = await BuildEntity.query()
            .filter({
                appId,
                status: { $nin: ['draft', 'canceled'] },
                ...(branchId && { branchId })
            })
            .orderBy('createdAt', 'desc')
            .find();

        const branchIds = uniq(builds.map(build => build.branchId));
        const branches = await BranchEntity.query()
            .filter({ id: { $in: branchIds } })
            .select('id', 'name')
            .find();
        const branchMap = keyBy(branches, 'id');

        return builds.map(build => ({
            ...build,
            branchName: branchMap[build.branchId]?.name ?? ''
        }));
    }

    @http.GET(':id')
    @http.middleware(UserAuthMiddleware)
    async get(appId: string, id: string): Promise<IBuildResponse> {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();

        const branch = await BranchEntity.query().filter({ id: build.branchId }).select('name').findOneOrUndefined();

        return {
            ...build,
            branchName: branch?.name ?? ''
        };
    }

    @http.GET(':id/status')
    @http.middleware(BuildCiTokenMiddleware)
    async show(appId: string, id: string): Promise<IBuildBasicResponse> {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();

        // Null out the token hash when returning a final status (session is over)
        if (build.status !== 'draft' && build.status !== 'processing') {
            build.ciTokenHash = null;
            await build.save();
        }

        return build;
    }

    @http.POST()
    async create(request: HttpRequest, appId: string): Promise<IBuildResponse> {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            this.logger.warn('Build creation failed: missing or malformed Authorization header');
            throw new HttpUnauthorizedError();
        }
        const ciToken = authHeader.slice(7);

        const app = await AppEntity.query().filter({ id: appId, deletedAt: null }).findOneOrUndefined();
        if (!app) throw new HttpBadRequestError('invalid appId');

        const ciJobData = await validateCiToken(ciToken, app.vcsId, this.logger);

        // Validate that the CI job belongs to the correct project
        if (app.vcsProjectId && ciJobData.vcsProjectId !== app.vcsProjectId) {
            this.logger.warn(
                `Build creation failed: vcsProjectId mismatch (expected=${app.vcsProjectId}, got=${ciJobData.vcsProjectId})`
            );
            throw new HttpUnauthorizedError();
        }

        const ciTokenHash = hashCiToken(ciToken);
        const { branch: branchName, commitHash, commitSubject, commitAuthor, jobId: ciJobId } = ciJobData;

        return this.db.transaction(async txn => {
            let branch = await txn.query(BranchEntity).filter({ appId: app.id, name: branchName }).findOneOrUndefined();

            if (!branch) {
                branch = await createPersistedEntity(
                    BranchEntity,
                    {
                        id: uuid7(),
                        appId,
                        name: branchName
                    },
                    txn
                );
            }

            const existingBuild = await txn
                .query(BuildEntity)
                .filter({ appId, branchId: branch.id, commitHash })
                .findOneOrUndefined();
            if (existingBuild) {
                // Update the token hash so subsequent calls use the current token
                existingBuild.ciTokenHash = ciTokenHash;
                txn.add(existingBuild);
                return {
                    ...existingBuild,
                    branchName: branch.name
                };
            }

            const newBuild = await createPersistedEntity(
                BuildEntity,
                {
                    id: uuid7(),
                    appId,
                    branchId: branch!.id,
                    commitHash,
                    commitSubject,
                    commitAuthor,
                    ciJobId,
                    ciTokenHash,
                    status: 'draft',
                    createdAt: new Date()
                },
                txn
            );

            return {
                ...newBuild,
                branchName: branch!.name
            };
        });
    }

    @http.POST(':id/process')
    @http.middleware(BuildCiTokenMiddleware)
    async process(appId: string, id: string): OkResponse {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();

        if (build.status !== 'draft') throw new HttpBadRequestError('Build is not in draft status');

        await this.db.transaction(async txn => {
            await txn
                .query(BuildEntity)
                .filter({ appId, id: { $ne: id }, status: 'draft' })
                .patchMany({ status: 'canceled' });

            build.status = 'processing';
            txn.add(build);
        });

        await this.workerSvc.queueJob(ProcessBuildJob, { buildId: id });

        return { ok: true };
    }

    @http.POST(':id/approve')
    @http.middleware(UserAuthMiddleware)
    async approve(user: UserEntity, appId: string, id: string): Promise<IBuildApprovalResponse> {
        const build = await BuildEntity.query().filter({ id, appId }).findOneOrUndefined();
        if (!build) throw new HttpNotFoundError();
        if (build.status !== 'needs review') throw new HttpBadRequestError('Build is not in needs review status');

        await this.db.transaction(async txn => {
            const buildScreens = await txn
                .query(BuildScreenEntity)
                .filter({ appId, buildId: id, status: { $ne: 'no changes' } })
                .find();
            buildScreens.forEach(buildScreen => {
                buildScreen.status = 'changes approved';
                txn.add(buildScreen);
            });

            build.status = 'changes approved';
            build.approvedById = user.id;
            build.approvedAt = new Date();
            txn.add(build);
        });

        if (process.env.CI) {
            return { vcsUrl: 'integration-test://' };
        }

        try {
            const app = await AppEntity.query().filter({ id: appId }).findOne();
            let vcsUrl: string;
            try {
                vcsUrl = await this.vcsSvc.rerunCiJob(user, app.vcsId, app.projectPath, build.ciJobId);
            } catch (innerErr) {
                if (!axios.isAxiosError(innerErr) || innerErr.response?.status !== 405) throw innerErr;

                // Project may have moved — securely look up current path via GitLab API
                const currentPath = await this.vcsSvc.getProjectPath(user, app.vcsId, app.projectPath);
                if (currentPath === app.projectPath) throw innerErr; // not a move, rethrow

                this.logger.info(`Project moved: "${app.projectPath}" → "${currentPath}"`);
                app.projectPath = currentPath;
                await app.save();

                vcsUrl = await this.vcsSvc.rerunCiJob(user, app.vcsId, currentPath, build.ciJobId);
            }
            return { vcsUrl };
        } catch (err) {
            this.logger.error('Failed to rerun CI job', err);
            return { vcsUrl: false };
        }
    }
}
