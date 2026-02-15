import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, UuidString } from '@zyno-io/dk-server-foundation';

@entity.name('builds')
export class BuildEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    appId!: UuidString;
    branchId!: UuidString;
    createdAt!: Date;
    commitHash!: string;
    commitSubject!: string;
    commitAuthor!: string;
    ciJobId!: string;
    ciTokenHash!: string | null;
    status!: 'draft' | 'processing' | 'no changes' | 'needs review' | 'changes approved' | 'canceled' | 'failed';
    approvedById!: UuidString | null;
    approvedAt!: Date | null;
}
