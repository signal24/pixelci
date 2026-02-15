import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, UuidString } from '@zyno-io/dk-server-foundation';

@entity.name('builds_screens')
export class BuildScreenEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    appId!: UuidString;
    buildId!: UuidString;
    screenId!: UuidString;
    matchedBuildId!: UuidString | null; // when a screen matches a previous build's, we can reference that build instead of storing identical images
    approvalBuildId!: UuidString | null; // when a screen is previously approved, we point to the build that approved it
    status!: 'new' | 'no changes' | 'needs review' | 'changes approved' | null;
    storageStatus!: 'stored' | 'pendingDeletion' | null;
}
