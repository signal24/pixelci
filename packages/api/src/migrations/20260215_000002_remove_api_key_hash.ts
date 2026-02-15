import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE apps DROP COLUMN apiKeyHash;
    `);
}
