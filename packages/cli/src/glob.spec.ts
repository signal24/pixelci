import assert from 'node:assert/strict';
import { describe, it, mock, beforeEach } from 'node:test';

const mockGlob = mock.fn<(pattern: string, cb: (err: Error | null, files: string[]) => void) => void>();

mock.module('fs', {
    namedExports: { glob: mockGlob }
});

const { getImages, getScreenName } = await import('./glob.js');

describe('getImages', () => {
    beforeEach(() => {
        mockGlob.mock.resetCalls();
    });

    it('should return png files matching the glob pattern', async () => {
        const files = ['src/a.png', 'src/sub/b.png'];
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) => cb(null, files));

        const result = await getImages('src');

        assert.equal(mockGlob.mock.callCount(), 1);
        assert.equal(mockGlob.mock.calls[0].arguments[0], 'src/**/*.png');
        assert.deepStrictEqual(result, files);
    });

    it('should reject on glob error', async () => {
        const error = new Error('glob failed');
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) => cb(error, []));

        await assert.rejects(() => getImages('bad/path'), { message: 'glob failed' });
    });

    it('should return empty array when no files match', async () => {
        mockGlob.mock.mockImplementation((_pattern: string, cb: (err: Error | null, files: string[]) => void) => cb(null, []));

        const result = await getImages('empty');

        assert.deepStrictEqual(result, []);
    });
});

describe('getScreenName', () => {
    // `fs.glob` normalizes its results, so the paths it returns do not necessarily start with the
    // source path the caller passed. These are the forms a CI job actually invokes the CLI with.
    it('should be unaffected by how the source path is written', () => {
        for (const srcPath of ['screenshots', './screenshots', 'screenshots/', './screenshots/']) {
            assert.equal(
                getScreenName(srcPath, 'screenshots/010-store-home.png'),
                '010-store-home',
                `source path "${srcPath}" changed the screen name`
            );
        }
    });

    it('should not truncate leading characters (regression)', () => {
        // The bug this replaced trimmed `srcPath.length + 1` off the front, which silently ate two
        // characters when the source path was written `./screenshots`. Names with a numeric prefix
        // made it visible — `555-…` arrived as `5-…` — but it corrupted every name equally.
        assert.equal(getScreenName('./screenshots', 'screenshots/555-move-envelope-not-found.png'), '555-move-envelope-not-found');
        assert.equal(getScreenName('./screenshots', 'screenshots/900-ui-kit.png'), '900-ui-kit');
        assert.equal(getScreenName('screenshots/', 'screenshots/010-store-home.png'), '010-store-home');
    });

    it('should flatten nested directories into the name', () => {
        assert.equal(getScreenName('screenshots', 'screenshots/admin/settings.png'), 'admin - settings');
        assert.equal(getScreenName('./screenshots', 'screenshots/a/b/c.png'), 'a - b - c');
    });

    it('should handle a source path outside the working directory', () => {
        assert.equal(getScreenName('../build/screenshots', '../build/screenshots/home.png'), 'home');
    });

    it('should only strip the .png extension, whatever its case', () => {
        assert.equal(getScreenName('src', 'src/Home.PNG'), 'Home');
        // A dot in the name is not an extension boundary — this used to be handled by a regex
        // anchored to the end, and still must be.
        assert.equal(getScreenName('src', 'src/v1.2-home.png'), 'v1.2-home');
    });
});
