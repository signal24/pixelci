import { describe, it, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { PixelCiApi, getApi } from './api.js';
import { AppError } from './error.js';

const mockFetch = mock.fn<typeof globalThis.fetch>();
globalThis.fetch = mockFetch;

describe('getApi', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
        mockFetch.mock.resetCalls();
    });

    after(() => {
        process.env = originalEnv;
    });

    const jobInfo = {
        projectUrl: 'https://gitlab.com/test/project',
        ciToken: 'glcbt-test-token'
    };

    it('should create API instance when both env vars are set', () => {
        process.env.PIXELCI_API_URL = 'http://localhost:7924';
        process.env.PIXELCI_APP_ID = 'test-app-id';

        const api = getApi(jobInfo);

        assert.ok(api instanceof PixelCiApi);
    });

    it('should throw error when PIXELCI_API_URL is missing', () => {
        delete process.env.PIXELCI_API_URL;
        process.env.PIXELCI_APP_ID = 'test-app-id';

        assert.throws(
            () => getApi(jobInfo),
            (err: any) => {
                assert.ok(err instanceof AppError);
                assert.equal(err.message, 'PIXELCI_API_URL environment variable is not set');
                return true;
            }
        );
    });

    it('should throw error when PIXELCI_APP_ID is missing', () => {
        process.env.PIXELCI_API_URL = 'http://localhost:7924';
        delete process.env.PIXELCI_APP_ID;

        assert.throws(
            () => getApi(jobInfo),
            (err: any) => {
                assert.ok(err instanceof AppError);
                assert.equal(err.message, 'PIXELCI_APP_ID environment variable is not set');
                return true;
            }
        );
    });
});

describe('PixelCiApi', () => {
    let api: PixelCiApi;

    beforeEach(() => {
        mockFetch.mock.resetCalls();
        api = new PixelCiApi('http://localhost:7924/', 'test-app-id', {
            projectUrl: 'https://gitlab.com/test/project',
            ciToken: 'glcbt-test-token'
        });
    });

    describe('constructor', () => {
        it('should remove trailing slashes from server URL', () => {
            const api1 = new PixelCiApi('http://localhost:7924///', 'test-app-id', {
                projectUrl: 'https://gitlab.com/test/project',
                ciToken: 'glcbt-test-token'
            });
            assert.equal(api1.getBuildUserUrl('build-123'), 'http://localhost:7924/apps/test-app-id/builds/build-123');
        });
    });

    describe('createBuild', () => {
        it('should create a build with projectUrl in body', async () => {
            const mockResponse = {
                id: 'build-123',
                status: 'draft' as const
            };

            mockFetch.mock.mockImplementation(
                async () =>
                    ({
                        ok: true,
                        json: async () => mockResponse
                    }) as any
            );

            const result = await api.createBuild();

            assert.deepStrictEqual(result, {
                buildId: 'build-123',
                status: 'draft'
            });

            assert.equal(mockFetch.mock.callCount(), 1);
            const [url, options] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'http://localhost:7924/api/apps/test-app-id/builds');
            assert.equal(options!.method, 'POST');
            assert.equal((options!.headers as Record<string, string>)['Authorization'], 'Bearer glcbt-test-token');
            assert.equal((options!.headers as Record<string, string>)['Content-Type'], 'application/json');

            const body = JSON.parse(options!.body as string);
            assert.equal(body.projectUrl, 'https://gitlab.com/test/project');
        });

        it('should throw AppError on API failure', async () => {
            mockFetch.mock.mockImplementation(
                async () =>
                    ({
                        ok: false,
                        statusText: 'Bad Request',
                        text: async () => 'Invalid request'
                    }) as any
            );

            await assert.rejects(() => api.createBuild(), AppError);
        });
    });

    describe('processBuild', () => {
        it('should process a build successfully', async () => {
            mockFetch.mock.mockImplementation(
                async () =>
                    ({
                        ok: true,
                        json: async () => ({ ok: true })
                    }) as any
            );

            await api.processBuild('build-123');

            assert.equal(mockFetch.mock.callCount(), 1);
            const [url, options] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'http://localhost:7924/api/apps/test-app-id/builds/build-123/process');
            assert.equal(options!.method, 'POST');
            assert.equal((options!.headers as Record<string, string>)['Authorization'], 'Bearer glcbt-test-token');
        });
    });

    describe('getBuildStatus', () => {
        it('should get build status successfully', async () => {
            mockFetch.mock.mockImplementation(
                async () =>
                    ({
                        ok: true,
                        json: async () => ({ status: 'processing' })
                    }) as any
            );

            const status = await api.getBuildStatus('build-123');

            assert.equal(status, 'processing');
            assert.equal(mockFetch.mock.callCount(), 1);
            const [url, options] = mockFetch.mock.calls[0].arguments;
            assert.equal(url, 'http://localhost:7924/api/apps/test-app-id/builds/build-123/status');
            assert.equal(options!.method, 'GET');
            assert.equal((options!.headers as Record<string, string>)['Authorization'], 'Bearer glcbt-test-token');
        });
    });

    describe('getBuildUserUrl', () => {
        it('should generate correct build URL', () => {
            const url = api.getBuildUserUrl('build-123');
            assert.equal(url, 'http://localhost:7924/apps/test-app-id/builds/build-123');
        });
    });
});
