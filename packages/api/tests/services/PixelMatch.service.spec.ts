import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs/browser';

// pixelmatch is ESM-only and requires dynamic import. Monkey-patch lodash.memoize
// before requiring the service so its module-level memoize() call uses our mock.
const mockPixelmatch = (
    img1: Uint8Array,
    img2: Uint8Array,
    output: Uint8Array | null,
    width: number,
    height: number
) => {
    let diffCount = 0;
    for (let i = 0; i < width * height; i++) {
        const idx = i << 2;
        if (img1[idx] !== img2[idx] || img1[idx + 1] !== img2[idx + 1] || img1[idx + 2] !== img2[idx + 2]) {
            diffCount++;
            if (output) {
                output[idx] = 255;
                output[idx + 1] = 0;
                output[idx + 2] = 0;
                output[idx + 3] = 255;
            }
        }
    }
    return diffCount;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lodash = require('lodash');
const originalMemoize = lodash.memoize;
lodash.memoize = () => () => Promise.resolve(mockPixelmatch);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PixelMatchService } = require('../../src/services/PixelMatch.service');

// Restore after module is loaded
lodash.memoize = originalMemoize;

function createPng(width: number, height: number, fill: [number, number, number, number]): Buffer {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            png.data[idx] = fill[0];
            png.data[idx + 1] = fill[1];
            png.data[idx + 2] = fill[2];
            png.data[idx + 3] = fill[3];
        }
    }
    return PNG.sync.write(png);
}

function createMockLogger() {
    return {
        info: mock.fn(),
        error: mock.fn(),
        warn: mock.fn(),
        debug: mock.fn()
    } as any;
}

describe('PixelMatchService', () => {
    it('should report no differences for identical images', async () => {
        const service = new PixelMatchService(createMockLogger());

        const img = createPng(4, 4, [255, 0, 0, 255]);
        const result = await service.getDiff(img, img);

        assert.equal(result.diffPixels, 0);
        assert.equal(result.diffPct, 0);
        assert.equal(result.totalPixels, 16);
    });

    it('should detect differences between images', async () => {
        const service = new PixelMatchService(createMockLogger());

        const red = createPng(4, 4, [255, 0, 0, 255]);
        const blue = createPng(4, 4, [0, 0, 255, 255]);
        const result = await service.getDiff(red, blue);

        assert.equal(result.diffPixels, 16);
        assert.equal(result.diffPct, 100);
        assert.equal(result.totalPixels, 16);
    });

    it('should return a valid diff PNG', async () => {
        const service = new PixelMatchService(createMockLogger());

        const red = createPng(4, 4, [255, 0, 0, 255]);
        const blue = createPng(4, 4, [0, 0, 255, 255]);
        const result = await service.getDiff(red, blue);

        const diffPng = result.getDiffPng();
        assert.ok(diffPng instanceof Uint8Array);

        const parsed = PNG.sync.read(Buffer.from(diffPng));
        assert.equal(parsed.width, 4);
        assert.equal(parsed.height, 4);
    });

    it('should calculate correct diff percentage for partial differences', async () => {
        const service = new PixelMatchService(createMockLogger());

        const img1 = new PNG({ width: 4, height: 4 });
        const img2 = new PNG({ width: 4, height: 4 });
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const idx = (4 * y + x) << 2;
                img1.data[idx] = 255;
                img1.data[idx + 1] = 0;
                img1.data[idx + 2] = 0;
                img1.data[idx + 3] = 255;
                img2.data[idx] = 255;
                img2.data[idx + 1] = 0;
                img2.data[idx + 2] = 0;
                img2.data[idx + 3] = 255;
            }
        }
        for (let y = 2; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                const idx = (4 * y + x) << 2;
                img2.data[idx] = 0;
                img2.data[idx + 1] = 0;
                img2.data[idx + 2] = 255;
            }
        }

        const buf1 = PNG.sync.write(img1);
        const buf2 = PNG.sync.write(img2);
        const result = await service.getDiff(buf1, buf2);

        assert.equal(result.diffPixels, 8);
        assert.equal(result.diffPct, 50);
        assert.equal(result.totalPixels, 16);
    });

    it('should log diff metrics', async () => {
        const logger = createMockLogger();
        const service = new PixelMatchService(logger);

        const img = createPng(4, 4, [255, 0, 0, 255]);
        await service.getDiff(img, img);

        assert.equal(logger.info.mock.callCount(), 1);
        const [message, data] = logger.info.mock.calls[0].arguments;
        assert.equal(message, 'Diff completed');
        assert.equal(data.sizesDiffer, false);
        assert.equal(data.totalPixels, 16);
        assert.equal(data.diffPixels, 0);
        assert.equal(data.diffPct, 0);
    });

    it('should handle images with different sizes by normalizing to max dimensions', async () => {
        const service = new PixelMatchService(createMockLogger());

        const small = createPng(2, 2, [255, 0, 0, 255]);
        const large = createPng(4, 4, [255, 0, 0, 255]);
        const result = await service.getDiff(small, large);

        // canvas is 4x4 = 16 pixels; the 2x2 overlap matches, but the padded area differs
        assert.equal(result.totalPixels, 16);
        assert.ok(result.diffPixels > 0);
        assert.ok(result.diffPct > 0);

        const diffPng = result.getDiffPng();
        const parsed = PNG.sync.read(Buffer.from(diffPng));
        assert.equal(parsed.width, 4);
        assert.equal(parsed.height, 4);
    });

    it('should report sizesDiffer in log when images have different sizes', async () => {
        const logger = createMockLogger();
        const service = new PixelMatchService(logger);

        const small = createPng(2, 2, [255, 0, 0, 255]);
        const large = createPng(4, 4, [255, 0, 0, 255]);
        await service.getDiff(small, large);

        const [message, data] = logger.info.mock.calls[0].arguments;
        assert.equal(message, 'Diff completed');
        assert.equal(data.sizesDiffer, true);
    });
});
