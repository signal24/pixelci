import { Db } from '../database';

export default async function (db: Db) {
    await db.rawExecute(`
        ALTER TABLE apps ADD COLUMN deletedAt DATETIME NULL;
    `);
}
