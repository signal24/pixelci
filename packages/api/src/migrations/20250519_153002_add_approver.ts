import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE builds ADD COLUMN approvedById CHAR(36) NULL,
        ADD COLUMN approvedAt DATETIME NULL;

        UPDATE builds SET approvedById=(SELECT id FROM users WHERE id <> '00000000-0000-0000-0000-000000000000' ORDER BY createdAt LIMIT 1), approvedAt=createdAt WHERE status='changes approved';
    `);
}
