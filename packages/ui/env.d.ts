/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_ENV: 'development' | 'alpha' | 'uat' | 'production';
    readonly VITE_APP_API_URL: string;
    readonly VITE_APP_SENTRY_DSN: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
