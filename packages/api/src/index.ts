#!/usr/bin/env npx ts-node
/* eslint-disable @typescript-eslint/no-require-imports */
import type { IncomingMessage } from 'http';

// otel must be initialized before all else

require('@zyno-io/dk-server-foundation/telemetry/otel/index.js').init({
    httpIncomingRequestAttributeHook(request: IncomingMessage) {
        return {
            'openreplay.sid': request.headers['x-openreplay-sessionid'] ?? 'unk'
        };
    }
});

const { createPixelCIApp } = require('./app');
const app = createPixelCIApp();
app.run();
