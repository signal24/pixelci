import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE users ADD COLUMN vcsSession JSON NULL DEFAULT NULL;
        ALTER TABLE users ADD COLUMN lastLoginAt DATETIME NULL DEFAULT NULL AFTER createdAt;
        ALTER TABLE users RENAME COLUMN userId TO vcsUserId;
    `);
}
