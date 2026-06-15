import { DB } from '../database';

export default async function (db: DB) {
    await db.rawExecute(`
        ALTER TABLE builds_screens
        ADD COLUMN \`reviewStatus\` enum('approved','rejected') DEFAULT NULL,
        ADD COLUMN \`reviewComment\` text DEFAULT NULL,
        ADD COLUMN \`reviewedById\` char(36) DEFAULT NULL,
        ADD COLUMN \`reviewedAt\` datetime DEFAULT NULL;
    `);
}
