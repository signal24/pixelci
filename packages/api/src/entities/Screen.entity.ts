import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, UuidString } from '@zyno-io/dk-server-foundation';

@entity.name('screens')
export class ScreenEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    appId!: UuidString;
    name!: string;
}
