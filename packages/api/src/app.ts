import { createApp, CreateAppOptions } from '@zyno-io/dk-server-foundation';
import { compact } from 'lodash';

import { AdminAuthMiddleware, BuildCiTokenMiddleware, UserAuthMiddleware, VcsTokenAuthMiddleware } from './accessories/AuthMiddleware.accessory';
import { UserResolver } from './accessories/Controller.accessory';
import { AppConfig } from './config';
import { AppsController } from './controllers/Apps.controller';
import { BranchesController } from './controllers/Branches.controller';
import { BuildsController } from './controllers/Builds.controller';
import { BuildScreensController } from './controllers/BuildScreens.controller';
import { ExternalReadController } from './controllers/ExternalRead.controller';
import { SessionController } from './controllers/Session.controller';
import { UsersController } from './controllers/Users.controller';
import { VcsIntegrationsController } from './controllers/VcsIntegrations.controller';
import { DB } from './database';
import { ProcessBuildJob } from './jobs/ProcessBuild.job';
import { StaticContentListener } from './listener';
import { AppAccessService } from './services/AppAccess.service';
import { PixelMatchService } from './services/PixelMatch.service';
import { S3Service } from './services/S3.service';
import { VcsService } from './services/Vcs.service';

export const CoreAppOptions: CreateAppOptions<AppConfig> = {
    config: AppConfig,
    db: DB,
    cors: _appConfig => ({
        hosts: compact(['http://localhost:7925', 'http://localhost:4173']),
        credentials: true
    }),
    frameworkConfig: {
        port: 7924
    },
    enableWorker: true,
    controllers: [
        SessionController,
        AppsController,
        BranchesController,
        BuildsController,
        BuildScreensController,
        VcsIntegrationsController,
        UsersController,
        ExternalReadController
    ],
    providers: [
        UserResolver,
        AdminAuthMiddleware,
        BuildCiTokenMiddleware,
        UserAuthMiddleware,
        VcsTokenAuthMiddleware,
        ProcessBuildJob,
        PixelMatchService,
        VcsService,
        AppAccessService,
        S3Service
    ],
    listeners: [StaticContentListener]
};

export const createPixelCIApp = () => createApp(CoreAppOptions);
