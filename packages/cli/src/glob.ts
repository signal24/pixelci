import { glob } from 'fs';
import { relative, sep } from 'path';

export function getImages(srcPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        glob(`${srcPath}/**/*.png`, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

/**
 * The screen name for an image, relative to the source directory.
 *
 * Nested directories are flattened into the name with " - " so `admin/settings.png` becomes
 * `admin - settings`.
 *
 * **Uses `relative()` rather than trimming `srcPath.length` off the front.** `fs.glob` returns
 * *normalized* paths, so the string it hands back does not necessarily start with the source path
 * the caller passed: invoke the CLI with `./screenshots` and the results come back as
 * `screenshots/…`. Subtracting the untrimmed length then ate the first two characters of every
 * screen name — `010-store-home` was uploaded as `0-store-home` — and a trailing slash on the
 * source path ate one.
 *
 * That was silent, and worse than cosmetic: the API keys screens by `{ appId, name }`, so a
 * truncated name is a different screen identity. Review history attached to the wrong record, and
 * correcting the invocation would have orphaned every prior approval against a name nothing
 * uploads any more.
 */
export function getScreenName(srcPath: string, imageFile: string): string {
    return relative(srcPath, imageFile)
        .split(sep)
        .join(' - ')
        .replace(/\.png$/i, '');
}
