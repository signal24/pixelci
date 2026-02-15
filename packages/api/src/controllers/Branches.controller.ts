import { http } from '@deepkit/http';

import { UserAuthMiddleware } from '../accessories/AuthMiddleware.accessory';
import { ApiController } from '../accessories/Controller.accessory';
import { BranchEntity } from '../entities/Branch.entity';

export type IBranchResponse = Pick<BranchEntity, 'id' | 'name'>;

@ApiController('/api/apps/:appId/branches')
@http.middleware(UserAuthMiddleware)
export class BranchesController {
    constructor() {}

    @http.GET()
    async index(appId: string): Promise<IBranchResponse[]> {
        return BranchEntity.query().filter({ appId }).find();
    }
}
