import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { getGitLabCiInfo } from './ci-gitlab.js';

describe('getGitLabCiInfo', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    after(() => {
        process.env = originalEnv;
    });

    it('should return CI info when all required env vars are present', () => {
        process.env.CI_PROJECT_URL = 'https://gitlab.com/test/project';
        process.env.CI_JOB_TOKEN = 'glcbt-test-token';

        const result = getGitLabCiInfo();

        assert.deepStrictEqual(result, {
            projectUrl: 'https://gitlab.com/test/project',
            ciToken: 'glcbt-test-token'
        });
    });

    it('should return null when CI_PROJECT_URL is missing', () => {
        delete process.env.CI_PROJECT_URL;
        process.env.CI_JOB_TOKEN = 'glcbt-test-token';

        assert.equal(getGitLabCiInfo(), null);
    });

    it('should return null when CI_JOB_TOKEN is missing', () => {
        process.env.CI_PROJECT_URL = 'https://gitlab.com/test/project';
        delete process.env.CI_JOB_TOKEN;

        assert.equal(getGitLabCiInfo(), null);
    });
});
