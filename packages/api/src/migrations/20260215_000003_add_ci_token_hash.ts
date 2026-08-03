import { Db } from '../database';

export default async function (db: Db) {
    await db.rawExecute(`
        ALTER TABLE builds ADD COLUMN ciTokenHash VARCHAR(64) NULL;
    `);
}
