import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, UuidString } from '@zyno-io/dk-server-foundation';

@entity.name('apps')
export class AppEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    vcsId!: UuidString;
    projectPath!: string;
    vcsProjectId!: number | null;
    defaultBranchId!: UuidString;
    name!: string;
    deletedAt!: Date | null;
}
