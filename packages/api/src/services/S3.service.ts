import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import assert from 'assert';
import { readFile } from 'fs/promises';
import { Readable } from 'stream';
import { AppConfig } from '../config';

export class S3Service {
    private s3Client: S3Client;

    constructor(private appConfig: AppConfig) {
        this.s3Client = new S3Client({
            endpoint: appConfig.S3_ENDPOINT,
            region: appConfig.S3_REGION,
            forcePathStyle: true,
            ...(appConfig.S3_ACCESS_KEY_ID &&
                appConfig.S3_ACCESS_SECRET && {
                    credentials: {
                        accessKeyId: appConfig.S3_ACCESS_KEY_ID,
                        secretAccessKey: appConfig.S3_ACCESS_SECRET
                    }
                })
        });
    }

    async uploadFile(localPath: string, targetPath: string, contentType: string): Promise<void>;
    async uploadFile(buffer: Buffer, targetPath: string, contentType: string): Promise<void>;
    async uploadFile(localPathOrBuffer: string | Buffer, targetPath: string, contentType: string): Promise<void> {
        // todo: figure out why createReadStream didn't work & fix it
        const command = new PutObjectCommand({
            Bucket: this.appConfig.S3_BUCKET,
            Key: targetPath,
            ContentType: contentType,
            Body: typeof localPathOrBuffer === 'string' ? await readFile(localPathOrBuffer) : localPathOrBuffer
        });
        await this.s3Client.send(command);
    }

    async deleteFile(path: string): Promise<void> {
        await this.s3Client.send(
            new DeleteObjectCommand({
                Bucket: this.appConfig.S3_BUCKET,
                Key: path
            })
        );
    }

    async getSignedUrl(path: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.appConfig.S3_BUCKET,
            Key: path
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    async getBuffer(path: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.appConfig.S3_BUCKET,
            Key: path
        });
        const response = await this.s3Client.send(command);
        assert(response.Body instanceof Readable);
        const body = response.Body as Readable;
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            body.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            body.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            body.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    getPathForScreen(appId: string, buildId: string, screenId: string): string {
        return `screens/${appId}/${buildId}/${screenId}.png`;
    }
    getPathForDiff(appId: string, buildId: string, screenId: string): string {
        return `screens/${appId}/${buildId}/${screenId}.diff.png`;
    }
}
