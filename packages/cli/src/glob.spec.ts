import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mockGlob = mock.fn<(pattern: string, cb: (err: Error | null, files: string[]) => void) => void>();

mock.module('fs', {
    namedExports: { glob: mockGlob }
});

const { getImages } = await import('./glob.js');

describe('getImages', () => {
    beforeEach(() => {
        mockGlob.mock.resetCalls();
    });

    it('should return png files matching the glob pattern', async () => {
        const files = ['src/a.png', 'src/sub/b.png'];
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) =>
            cb(null, files)
        );

        const result = await getImages('src');

        assert.equal(mockGlob.mock.callCount(), 1);
        assert.equal(mockGlob.mock.calls[0].arguments[0], 'src/**/*.png');
        assert.deepStrictEqual(result, files);
    });

    it('should reject on glob error', async () => {
        const error = new Error('glob failed');
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) =>
            cb(error, [])
        );

        await assert.rejects(() => getImages('bad/path'), { message: 'glob failed' });
    });

    it('should return empty array when no files match', async () => {
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) =>
            cb(null, [])
        );

        const result = await getImages('empty');

        assert.deepStrictEqual(result, []);
    });
});
