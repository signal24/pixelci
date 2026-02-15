import { entity, PrimaryKey } from '@deepkit/type';
import { BaseEntity, HasDefault, UuidString } from '@zyno-io/dk-server-foundation';

export interface IUserVcsSession {
    accessToken: string;
    expiresAt: number;
    refreshToken: string;
    redirectUri: string;
}

@entity.name('users')
export class UserEntity extends BaseEntity {
    id!: UuidString & PrimaryKey;
    vcsId!: UuidString;
    vcsUserId!: string;
    name!: string;
    isAdmin: boolean & HasDefault = false;
    createdAt: Date & HasDefault = new Date();
    lastLoginAt!: Date;
    vcsSession!: IUserVcsSession | null;
}
