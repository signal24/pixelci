import { DB } from '../database';

export default async function (db: DB) {
    await db.rawQuery(`
        CREATE TABLE \`apps\` (
        \`id\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
        \`vcsId\` char(36) NOT NULL,
        \`projectPath\` varchar(255) NOT NULL,
        \`defaultBranchId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`branches\` (
        \`id\` char(36) NOT NULL,
        \`appId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`branches_appId_idx\` (\`appId\`) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`builds\` (
        \`id\` char(36) NOT NULL,
        \`appId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`branchId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`commitHash\` char(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`commitSubject\` varchar(255) NOT NULL,
        \`commitAuthor\` varchar(255) NOT NULL,
        \`ciJobId\` varchar(255) NOT NULL,
        \`status\` enum('draft','processing','no changes','needs review','changes approved','canceled') NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`builds_branchId_idx\` (\`branchId\`) USING BTREE,
        KEY \`builds_appId_idx\` (\`appId\`) USING BTREE,
        KEY \`builds_commitHash_idx\` (\`commitHash\`) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`builds_screens\` (
        \`id\` char(36) NOT NULL,
        \`appId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`buildId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`screenId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`matchedBuildId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
        \`approvalBuildId\` char(36) DEFAULT NULL,
        \`status\` enum('new','no changes','needs review','changes approved') DEFAULT NULL,
        \`storageStatus\` enum('stored','pendingDeletion') DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`builds_screens_appId_idx\` (\`appId\`) USING BTREE,
        KEY \`builds_screens_buildId_idx\` (\`buildId\`) USING BTREE,
        KEY \`builds_screens_screenId_idx\` (\`screenId\`) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`screens\` (
        \`id\` char(36) NOT NULL,
        \`appId\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`screens_appId_name_idx\` (\`appId\`,\`name\`) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`users\` (
        \`id\` char(36) NOT NULL,
        \`vcsId\` char(36) NOT NULL,
        \`userId\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
        \`isAdmin\` tinyint(1) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`users_vcsId_userId_idx\` (\`vcsId\`,\`userId\`) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

        CREATE TABLE \`vcsIntegrations\` (
        \`id\` char(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`platform\` enum('gitlab','github') NOT NULL,
        \`config\` json NOT NULL,
        PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
}
