import { IUserVcsSession, UserEntity } from '../entities/User.entity';
import { IGitLabConfig, VcsIntegrationEntity } from '../entities/VcsIntegration.entity';
import { VcsGitLabService } from './VcsGitLab.service';

export interface IVcsLoginSessionResponse extends IUserVcsSession {
    id: string;
    name: string;
}

export interface IVcsProject {
    id: string;
    name: string;
    projectPath: string;
    webUrl: string;
    description: string;
    defaultBranch?: string;
}

export interface IVcsServiceImpl {
    getProviderLoginUrl(redirectUri: string, state?: string): Promise<string>;
    exchangeProviderCode(redirectUri: string, code: string): Promise<IVcsLoginSessionResponse>;
    rerunCiJob(user: UserEntity, projectPath: string, jobId: string): Promise<string>;
    getProjectPath(user: UserEntity, projectPath: string): Promise<string>;
    searchProjects(user: UserEntity, search: string): Promise<IVcsProject[]>;
    getProjectByPath(user: UserEntity, projectPath: string): Promise<IVcsProject>;
}

export class VcsService {
    async getProviderLoginUrl(providerId: string, redirectUri: string, state?: string): Promise<string> {
        return this.runWithProvider(providerId, provider => provider.getProviderLoginUrl(redirectUri, state));
    }

    async exchangeProviderCode(
        providerId: string,
        redirectUri: string,
        code: string
    ): Promise<IVcsLoginSessionResponse> {
        return this.runWithProvider(providerId, provider => provider.exchangeProviderCode(redirectUri, code));
    }

    async rerunCiJob(user: UserEntity, vcsId: string, projectPath: string, jobId: string): Promise<string> {
        return this.runWithProvider(vcsId, provider => provider.rerunCiJob(user, projectPath, jobId));
    }

    async getProjectPath(user: UserEntity, vcsId: string, projectPath: string): Promise<string> {
        return this.runWithProvider(vcsId, provider => provider.getProjectPath(user, projectPath));
    }

    async searchProjects(user: UserEntity, vcsId: string, search: string): Promise<IVcsProject[]> {
        return this.runWithProvider(vcsId, provider => provider.searchProjects(user, search));
    }

    async getProjectByPath(user: UserEntity, vcsId: string, projectPath: string): Promise<IVcsProject> {
        return this.runWithProvider(vcsId, provider => provider.getProjectByPath(user, projectPath));
    }

    // eslint-disable-next-line no-explicit-any
    private async runWithProvider(id: string, action: (provider: IVcsServiceImpl) => Promise<any>): Promise<any> {
        const provider = await this.getProvider(id);
        return action(provider);
    }

    private async getProvider(id: string): Promise<IVcsServiceImpl> {
        const provider = await VcsIntegrationEntity.query().filterField('id', id).findOneOrUndefined();
        if (!provider) {
            throw new Error(`VCS provider with ID ${id} not found`);
        }

        if (provider.platform === 'gitlab') {
            return new VcsGitLabService(provider.config as IGitLabConfig);
        }

        throw new Error(`VCS provider with ID ${id} is not supported`);
    }
}
