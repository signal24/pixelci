import { Db } from '../database';

export default async function (db: Db) {
    await db.rawExecute(`
        ALTER TABLE apps DROP COLUMN apiKeyHash;
    `);
}
