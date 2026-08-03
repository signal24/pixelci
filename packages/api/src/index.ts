/* eslint-disable @typescript-eslint/no-require-imports */
import type { IncomingMessage } from 'http';

// otel must be initialized before all else

require('@zyno-io/ts-server-foundation/otel').init({
    httpIncomingRequestAttributeHook(request: IncomingMessage) {
        return {
            'openreplay.sid': request.headers['x-openreplay-sessionid'] ?? 'unk'
        };
    }
});

const { createPixelCIApp } = require('./app');
const app = createPixelCIApp();
app.run();
