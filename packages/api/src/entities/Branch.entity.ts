import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, UuidString } from '@zyno-io/dk-server-foundation';

@entity.name('branches')
export class BranchEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    appId!: UuidString;
    name!: string;
}
