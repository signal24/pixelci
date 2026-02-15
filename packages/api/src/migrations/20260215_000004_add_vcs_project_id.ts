import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE apps ADD COLUMN vcsProjectId INT NULL;
    `);
}
