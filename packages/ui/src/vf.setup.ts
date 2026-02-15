import { configureVf, createFilters, installVf } from '@zyno-io/vue-foundation';
import type { App } from 'vue';

// configure Vue Foundation
configureVf({});

// create base filters + any custom filters
export const filters = createFilters(() => ({}));

// attach filters to Vue
declare module 'vue' {
    export interface ComponentCustomProperties {
        $filters: typeof filters;
    }
}

// global Vue Foundation setup helper
export function setupVf(app: App) {
    installVf(app);
    app.config.globalProperties.$filters = filters;
}
