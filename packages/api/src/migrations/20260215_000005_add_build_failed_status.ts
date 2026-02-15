import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE builds MODIFY COLUMN \`status\` enum('draft','processing','no changes','needs review','changes approved','canceled','failed') NOT NULL;
    `);
}
