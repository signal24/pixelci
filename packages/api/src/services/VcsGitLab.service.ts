import { HttpBadRequestError } from '@deepkit/http';
import { Logger, ScopedLogger } from '@deepkit/logger';
import { assert } from '@deepkit/type';
import { JWT, r } from '@zyno-io/dk-server-foundation';
import axios from 'axios';
import { UserEntity } from '../entities/User.entity';
import { IGitLabConfig } from '../entities/VcsIntegration.entity';
import type { IVcsLoginSessionResponse, IVcsProject, IVcsServiceImpl } from './Vcs.service';

export class VcsGitLabService implements IVcsServiceImpl {
    private logger = r<ScopedLogger>(Logger);

    constructor(private config: IGitLabConfig) {}

    async getProviderLoginUrl(redirectUri: string, state?: string): Promise<string> {
        return `${this.config.url}/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${redirectUri}&state=${state ?? ''}&response_type=code&scope=openid+api`;
    }

    async exchangeProviderCode(redirectUri: string, code: string): Promise<IVcsLoginSessionResponse> {
        try {
            const response = await axios.post(
                `${this.config.url}/oauth/token`,
                {
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    redirect_uri: redirectUri,
                    code,
                    grant_type: 'authorization_code'
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            assert<{
                access_token: string;
                expires_in: number;
                refresh_token: string;
                id_token: string;
            }>(response.data);

            const idToken = await JWT.decode(response.data.id_token);
            assert<true>(idToken.isValid);
            assert<{ name: string }>(idToken.payload);

            return {
                id: idToken.subject,
                name: idToken.payload.name,
                accessToken: response.data.access_token,
                expiresAt: Date.now() + response.data.expires_in * 1000,
                refreshToken: response.data.refresh_token,
                redirectUri
            };
        } catch (err) {
            if (axios.isAxiosError(err)) {
                throw new HttpBadRequestError(err.response?.data);
            }
            throw err;
        }
    }

    async rerunCiJob(user: UserEntity, projectPath: string, jobId: string): Promise<string> {
        await this.renewToken(user);

        const response = await axios.post(
            `${this.config.url}/api/v4/projects/${encodeURIComponent(projectPath)}/jobs/${jobId}/retry`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${user.vcsSession!.accessToken}`
                }
            }
        );

        assert<{
            id: number;
            pipeline: {
                id: number;
            };
        }>(response.data);

        return `${this.config.url}/${projectPath}/-/pipelines/${response.data.pipeline.id}`;
    }

    async getProjectPath(user: UserEntity, projectPath: string): Promise<string> {
        await this.renewToken(user);

        const response = await axios.get(`${this.config.url}/api/v4/projects/${encodeURIComponent(projectPath)}`, {
            headers: {
                Authorization: `Bearer ${user.vcsSession!.accessToken}`
            }
        });

        return response.data.path_with_namespace;
    }

    async searchProjects(user: UserEntity, search: string): Promise<IVcsProject[]> {
        await this.renewToken(user);

        const response = await axios.get(`${this.config.url}/api/v4/projects`, {
            params: {
                search,
                membership: true,
                order_by: 'last_activity_at',
                per_page: 20
            },
            headers: {
                Authorization: `Bearer ${user.vcsSession!.accessToken}`
            }
        });

        return response.data.map(
            (p: {
                id: number;
                name: string;
                path_with_namespace: string;
                web_url: string;
                description: string | null;
                default_branch: string | null;
            }) => ({
                id: String(p.id),
                name: p.name,
                projectPath: p.path_with_namespace,
                webUrl: p.web_url,
                description: p.description ?? '',
                defaultBranch: p.default_branch ?? undefined
            })
        );
    }

    async getProjectByPath(user: UserEntity, projectPath: string): Promise<IVcsProject> {
        await this.renewToken(user);

        const response = await axios.get(`${this.config.url}/api/v4/projects/${encodeURIComponent(projectPath)}`, {
            headers: {
                Authorization: `Bearer ${user.vcsSession!.accessToken}`
            }
        });

        const p = response.data;
        return {
            id: String(p.id),
            name: p.name,
            projectPath: p.path_with_namespace,
            webUrl: p.web_url,
            description: p.description ?? '',
            defaultBranch: p.default_branch ?? undefined
        };
    }

    private async renewToken(user: UserEntity): Promise<void> {
        if (user.vcsSession!.expiresAt > Date.now() - 60_000) return;

        await this.logger.info('Refreshing GitLab token', { userId: user.id });

        try {
            const response = await axios.post(
                `${this.config.url}/oauth/token`,
                {
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: user.vcsSession!.refreshToken,
                    redirect_uri: user.vcsSession!.redirectUri
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            assert<{
                access_token: string;
                expires_in: number;
                refresh_token: string;
            }>(response.data);

            user.vcsSession = {
                ...user.vcsSession!,
                accessToken: response.data.access_token,
                expiresAt: Date.now() + response.data.expires_in * 1000,
                refreshToken: response.data.refresh_token
            };
            await user.save();
        } catch (err) {
            if (axios.isAxiosError(err)) {
                throw new HttpBadRequestError(err.response?.data);
            }
            throw err;
        }
    }
}
