import { http, HttpBadRequestError, HttpBody, HttpNotFoundError, HttpQueries } from '@deepkit/http';
import { uuid } from '@deepkit/type';
import { createEntity, EntityFields } from '@zyno-io/dk-server-foundation';

import { AdminAuthMiddleware, UserAuthMiddleware } from '../accessories/AuthMiddleware.accessory';
import { ApiController } from '../accessories/Controller.accessory';
import { AppEntity } from '../entities/App.entity';
import { BranchEntity } from '../entities/Branch.entity';
import { BuildEntity } from '../entities/Build.entity';
import { UserEntity } from '../entities/User.entity';
import { IGitLabConfig, VcsIntegrationEntity } from '../entities/VcsIntegration.entity';
import { IVcsProject, VcsService } from '../services/Vcs.service';

export type IAppIndexResponse = Partial<Pick<AppEntity, 'id' | 'defaultBranchId' | 'name'> & { buildCount: number }>;
export type IAppShowResponse = EntityFields<AppEntity> & { commitUrlBase: string | null };

interface IAppCreateInput {
    name: string;
    vcsId: string;
    projectPath: string;
    vcsProjectId?: number;
    defaultBranchName?: string;
}

export type IAppUpdateInput = Partial<Pick<AppEntity, 'name' | 'defaultBranchId'>>;

@ApiController('/api/apps')
@http.middleware(UserAuthMiddleware)
export class AppsController {
    constructor(private vcsService: VcsService) {}

    @http.GET()
    async index(): Promise<IAppIndexResponse[]> {
        const apps = await AppEntity.query().filter({ deletedAt: null }).find();

        const appsWithBuildCount: IAppIndexResponse[] = await Promise.all(
            apps.map(async app => {
                const count = await BuildEntity.query().filter({ appId: app.id }).count();

                return {
                    ...app,
                    id: app.id,
                    buildCount: count
                };
            })
        );

        return appsWithBuildCount;
    }

    @http.GET('/:id')
    async show(id: string): Promise<IAppShowResponse> {
        const app = await AppEntity.query().filter({ id, deletedAt: null }).findOneOrUndefined();
        if (!app) throw new HttpNotFoundError();

        let commitUrlBase: string | null = null;
        const vcs = await VcsIntegrationEntity.query().filterField('id', app.vcsId).findOneOrUndefined();
        if (vcs?.platform === 'gitlab') {
            commitUrlBase = `${(vcs.config as IGitLabConfig).url}/${app.projectPath}/-/commit`;
        } else if (vcs?.platform === 'github') {
            commitUrlBase = `https://github.com/${app.projectPath}/commit`;
        }

        return { ...app, commitUrlBase };
    }

    @http.POST()
    @http.middleware(AdminAuthMiddleware)
    async create(body: HttpBody<IAppCreateInput>): Promise<IAppIndexResponse> {
        const appId = uuid();

        let defaultBranchId: string | undefined;
        if (body.defaultBranchName) {
            const branch = createEntity(BranchEntity, {
                id: uuid(),
                appId,
                name: body.defaultBranchName
            });
            await branch.save();
            defaultBranchId = branch.id;
        }

        const newApp = createEntity(AppEntity, {
            id: appId,
            name: body.name,
            vcsId: body.vcsId,
            projectPath: body.projectPath,
            vcsProjectId: body.vcsProjectId ?? null,
            defaultBranchId: defaultBranchId ?? ''
        });
        await newApp.save();

        return newApp;
    }

    @http.PUT('/:id')
    @http.middleware(AdminAuthMiddleware)
    async update(id: string, body: HttpBody<IAppUpdateInput>): Promise<IAppIndexResponse> {
        const app = await AppEntity.query().filter({ id }).findOneOrUndefined();
        if (!app) throw new HttpNotFoundError();

        if (body.defaultBranchId) {
            const branch = await BranchEntity.query()
                .filter({ appId: id, id: body.defaultBranchId })
                .findOneOrUndefined();
            if (!branch) throw new HttpBadRequestError('invalid defaultBranchId');
        }

        Object.assign(app, body);
        await app.save();

        return app;
    }

    @http.DELETE('/:id')
    @http.middleware(AdminAuthMiddleware)
    async delete(id: string): Promise<void> {
        const app = await AppEntity.query().filter({ id, deletedAt: null }).findOneOrUndefined();
        if (!app) throw new HttpNotFoundError();

        app.deletedAt = new Date();
        await app.save();
    }

    @http.GET('vcs-projects/search')
    @http.middleware(AdminAuthMiddleware)
    async searchVcsProjects(
        query: HttpQueries<{ vcsId: string; search: string }>,
        user: UserEntity
    ): Promise<IVcsProject[]> {
        return this.vcsService.searchProjects(user, query.vcsId, query.search);
    }

    @http.GET('vcs-projects/resolve')
    @http.middleware(AdminAuthMiddleware)
    async resolveVcsProject(
        query: HttpQueries<{ vcsId: string; url: string }>,
        user: UserEntity
    ): Promise<IVcsProject> {
        const urlObj = new URL(query.url);
        const projectPath = urlObj.pathname
            .replace(/^\//, '')
            .replace(/\/-\/.*$/, '')
            .replace(/\.git$/, '');
        if (!projectPath) {
            throw new HttpBadRequestError('Could not extract project path from URL');
        }
        return this.vcsService.getProjectByPath(user, query.vcsId, projectPath);
    }
}
