import { Db } from '../database';

export default async function (db: Db) {
    await db.rawExecute(`
        ALTER TABLE apps ADD COLUMN apiKeyHash VARCHAR(64) NULL;
    `);
}
