import { Db } from '../database';

export default async function (db: Db) {
    await db.rawExecute(`
        ALTER TABLE builds MODIFY COLUMN \`status\` enum('draft','processing','no changes','needs review','changes approved','changes rejected','canceled','failed') NOT NULL;
    `);
}
