import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE apps ADD COLUMN apiKeyHash VARCHAR(64) NULL;
    `);
}
