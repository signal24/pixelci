import { createHash } from 'crypto';

import { HttpRequest, HttpUnauthorizedError } from '@deepkit/http';
import { Logger } from '@deepkit/logger';
import { createAuthMiddleware, HttpDetailedAccessDeniedError, HttpMiddleware } from '@zyno-io/dk-server-foundation';

import { BuildEntity } from '../entities/Build.entity';
import { UserEntity } from '../entities/User.entity';
import { IGitLabConfig, VcsIntegrationEntity } from '../entities/VcsIntegration.entity';

/**
 * User authentication
 */
export class UserAuthMiddleware extends createAuthMiddleware(UserEntity) {}
export class AdminAuthMiddleware extends UserAuthMiddleware {
    async validateEntity(_request: HttpRequest, entity: UserEntity) {
        if (!entity.isAdmin) throw new HttpDetailedAccessDeniedError('Insufficient permissions');
    }
}

/**
 * Data extracted from the CI provider during token validation.
 */
export interface ICiJobData {
    jobId: string;
    branch: string;
    commitHash: string;
    commitSubject: string;
    commitAuthor: string;
    vcsProjectId: number;
}

/**
 * Hashes a CI token for storage/comparison.
 */
export function hashCiToken(ciToken: string): string {
    return createHash('sha256').update(ciToken).digest('hex');
}

/**
 * Middleware for build-level CI token authentication.
 * Verifies that the Bearer token's SHA-256 hash matches the build's stored ciTokenHash.
 * Used on upload, process, and getBuildStatus endpoints.
 */
export class BuildCiTokenMiddleware extends HttpMiddleware {
    constructor(private logger: Logger) {
        super();
    }

    async handle(request: HttpRequest) {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            this.logger.warn('CI token auth failed: missing or malformed Authorization header');
            throw new HttpUnauthorizedError();
        }

        const ciToken = authHeader.slice(7);
        const tokenHash = hashCiToken(ciToken);

        const match = request.url?.match(/^\/api\/apps\/[^/]+\/builds\/([^/]+)/);
        if (!match) {
            this.logger.warn('CI token auth failed: could not extract buildId from URL');
            throw new HttpUnauthorizedError();
        }
        const buildId = match[1];

        const build = await BuildEntity.query().filter({ id: buildId }).findOneOrUndefined();
        if (!build || build.ciTokenHash !== tokenHash) {
            this.logger.warn(`CI token auth failed: build not found or token hash mismatch for buildId=${buildId}`);
            throw new HttpUnauthorizedError();
        }
    }
}

/**
 * Validates a CI job token against the VCS provider (GitLab).
 * Returns extracted job data including the project path from GitLab.
 */
export async function validateCiToken(ciToken: string, vcsId: string, logger: Logger): Promise<ICiJobData> {
    const vcs = await VcsIntegrationEntity.query().filterField('id', vcsId).findOneOrUndefined();
    if (!vcs || vcs.platform !== 'gitlab') {
        logger.warn(`CI token validation failed: VCS integration not found or not GitLab (vcsId=${vcsId})`);
        throw new HttpUnauthorizedError();
    }

    const gitlabUrl = (vcs.config as IGitLabConfig).url;

    let jobResponse: Response;
    try {
        jobResponse = await fetch(`${gitlabUrl}/api/v4/job`, {
            headers: { 'JOB-TOKEN': ciToken }
        });
    } catch (err) {
        logger.warn(`CI token validation failed: GitLab /api/v4/job request failed (${err})`);
        throw new HttpUnauthorizedError();
    }

    if (!jobResponse.ok) {
        logger.warn(
            `CI token validation failed: GitLab /api/v4/job returned ${jobResponse.status} ${jobResponse.statusText}`
        );
        throw new HttpUnauthorizedError();
    }

    const jobData = (await jobResponse.json()) as {
        id?: number;
        ref?: string;
        pipeline?: { project_id?: number; sha?: string };
        commit?: { title?: string; author_name?: string };
    };

    const vcsProjectId = jobData.pipeline?.project_id;
    if (!vcsProjectId) {
        logger.warn('CI token validation failed: GitLab job response missing pipeline.project_id');
        throw new HttpUnauthorizedError();
    }

    return {
        jobId: String(jobData.id ?? ''),
        branch: jobData.ref ?? '',
        commitHash: jobData.pipeline?.sha ?? '',
        commitSubject: jobData.commit?.title ?? '',
        commitAuthor: jobData.commit?.author_name ?? '',
        vcsProjectId
    };
}
