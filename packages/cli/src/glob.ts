import { glob } from 'fs';

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
