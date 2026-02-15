import { BaseAppConfig } from '@zyno-io/dk-server-foundation';

export class AppConfig extends BaseAppConfig {
    S3_ENDPOINT?: string;
    S3_REGION?: string;
    S3_BUCKET?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_ACCESS_SECRET?: string;

    DEFAULT_PIXEL_MATCH_THRESHOLD = 0.2;
    DEFAULT_PIXEL_DIFF_PCT_THRESHOLD = 1;
}
