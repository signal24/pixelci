import { ScopedLogger } from '@deepkit/logger';
import { memoize } from 'lodash';
import { PNG } from 'pngjs/browser';

const loadPixelMatch = memoize(async () => {
    return (await import('pixelmatch')).default;
});

export interface IPixelMatchDiffResult {
    totalPixels: number;
    diffPixels: number;
    diffPct: number;
    getDiffPng: () => Buffer;
}

function normalizeToCanvas(img: PNG, targetWidth: number, targetHeight: number): PNG {
    const canvas = new PNG({ width: targetWidth, height: targetHeight, fill: true });
    // fill with magenta (255, 0, 255, 255) so size differences are obvious
    for (let i = 0; i < canvas.data.length; i += 4) {
        canvas.data[i] = 255;
        canvas.data[i + 1] = 0;
        canvas.data[i + 2] = 255;
        canvas.data[i + 3] = 255;
    }
    // copy the original image onto the top-left of the canvas
    PNG.bitblt(img, canvas, 0, 0, img.width, img.height, 0, 0);
    return canvas;
}

export class PixelMatchService {
    constructor(private logger: ScopedLogger) {}

    async getDiff(img1Buf: Buffer, img2Buf: Buffer, pixelMatchThreshold = 0.2): Promise<IPixelMatchDiffResult> {
        const pixelmatch = await loadPixelMatch();

        const diffStart = performance.now();

        const img1 = PNG.sync.read(img1Buf);
        const img2 = PNG.sync.read(img2Buf);

        const sizesDiffer = img1.width !== img2.width || img1.height !== img2.height;

        const width = Math.max(img1.width, img2.width);
        const height = Math.max(img1.height, img2.height);

        const norm1 = sizesDiffer ? normalizeToCanvas(img1, width, height) : img1;
        const norm2 = sizesDiffer ? normalizeToCanvas(img2, width, height) : img2;

        const diffTarget = new PNG({ width, height });
        const diffPixels = pixelmatch(norm1.data, norm2.data, diffTarget.data, width, height, {
            threshold: pixelMatchThreshold,
            includeAA: false
        });

        const totalPixels = width * height;
        const diffPct = (diffPixels / totalPixels) * 100;

        const diffEnd = performance.now();
        const diffTime = diffEnd - diffStart;

        this.logger.info('Diff completed', { sizesDiffer, diffTime, totalPixels, diffPixels, diffPct });

        return {
            totalPixels,
            diffPixels,
            diffPct,
            getDiffPng: () => PNG.sync.write(diffTarget)
        };
    }
}
