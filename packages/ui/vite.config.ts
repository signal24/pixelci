import vue from '@vitejs/plugin-vue';
import { openapiClientGeneratorPlugin } from '@zyno-io/vue-foundation/vite-plugins';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import oxlintPlugin from 'vite-plugin-oxlint';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
process.env.VITE_APP_VERSION = version;

// https://vitejs.dev/config/
export default defineConfig({
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    server: {
        port: 7925
    },
    build: {
        sourcemap: true,

        target: 'esnext',
        outDir: '../api/static'
    },
    plugins: [vue(), oxlintPlugin(), openapiClientGeneratorPlugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
});
