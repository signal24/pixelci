import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE builds ADD COLUMN ciTokenHash VARCHAR(64) NULL;
    `);
}
