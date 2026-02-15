import { S3Client, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mariadb from 'mariadb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', 'integration', 'fixtures');

// IDs
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const APP_ID = '00000000-0000-0000-0000-000000000001';
const MAIN_BRANCH_ID = '00000000-0000-0000-0000-000000000002';
const FEAT_BRANCH_ID = '00000000-0000-0000-0000-000000000030';

// Build IDs
const BUILD_003_ID = '00000000-0000-0000-0000-000000000003';
const BUILD_004_ID = '00000000-0000-0000-0000-000000000004';
const BUILD_005_ID = '00000000-0000-0000-0000-000000000005';
const BUILD_006_ID = '00000000-0000-0000-0000-000000000006';
const BUILD_007_ID = '00000000-0000-0000-0000-000000000007';

// Screen IDs
const SCREEN_HOMEPAGE_ID = '00000000-0000-0000-0000-000000000010';
const SCREEN_DASHBOARD_ID = '00000000-0000-0000-0000-000000000011';
const SCREEN_SETTINGS_ID = '00000000-0000-0000-0000-000000000012';
const SCREEN_LOGIN_ID = '00000000-0000-0000-0000-000000000013';

// Build-screen IDs
const BS_020 = '00000000-0000-0000-0000-000000000020';
const BS_021 = '00000000-0000-0000-0000-000000000021';
const BS_022 = '00000000-0000-0000-0000-000000000022';
const BS_023 = '00000000-0000-0000-0000-000000000023';
const BS_024 = '00000000-0000-0000-0000-000000000024';
const BS_025 = '00000000-0000-0000-0000-000000000025';
const BS_026 = '00000000-0000-0000-0000-000000000026';
const BS_027 = '00000000-0000-0000-0000-000000000027';
const BS_028 = '00000000-0000-0000-0000-000000000028';
const BS_029 = '00000000-0000-0000-0000-000000000029';
const BS_02A = '00000000-0000-0000-0000-00000000002a';
const BS_02B = '00000000-0000-0000-0000-00000000002b';
const BS_02C = '00000000-0000-0000-0000-00000000002c';
const BS_02D = '00000000-0000-0000-0000-00000000002d';

// Load real fixture images
const FINDER_1 = fs.readFileSync(path.join(fixturesDir, 'finder-1.png'));
const FINDER_1_CHANGED = fs.readFileSync(path.join(fixturesDir, 'finder-1-changed.png'));
const FINDER_2 = fs.readFileSync(path.join(fixturesDir, 'finder-2.png'));
const FINDER_2_CHANGED = fs.readFileSync(path.join(fixturesDir, 'finder-2-changed.png'));
const FINDER_2_CHANGED_2 = fs.readFileSync(path.join(fixturesDir, 'finder-2-changed-2.png'));
const FINDER_1_DIFF = fs.readFileSync(path.join(fixturesDir, 'finder-1-diff.png'));

async function seedDatabase() {
    const conn = await mariadb.createConnection({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD_SECRET || 'secret',
        database: process.env.MYSQL_DATABASE || 'pixelci'
    });

    // VCS Integration
    await conn.query(
        `INSERT IGNORE INTO vcsIntegrations (id, name, platform, config)
         VALUES (?, ?, ?, ?)`,
        [
            ZERO_ID,
            'Test VCS',
            'gitlab',
            JSON.stringify({ url: 'https://git.example', clientId: 'client-id', clientSecret: 'client-secret' })
        ]
    );

    // User
    await conn.query(
        `INSERT IGNORE INTO users (id, vcsId, vcsUserId, name, isAdmin, createdAt, lastLoginAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [ZERO_ID, ZERO_ID, ZERO_ID, 'E2E Test User', true]
    );

    // App
    await conn.query(
        `INSERT IGNORE INTO apps (id, vcsId, projectPath, defaultBranchId, name)
         VALUES (?, ?, ?, ?, ?)`,
        [APP_ID, ZERO_ID, 'test/project', MAIN_BRANCH_ID, 'E2E Test App']
    );

    // Branches
    await conn.query(
        `INSERT IGNORE INTO branches (id, appId, name)
         VALUES (?, ?, ?)`,
        [MAIN_BRANCH_ID, APP_ID, 'main']
    );
    await conn.query(
        `INSERT IGNORE INTO branches (id, appId, name)
         VALUES (?, ?, ?)`,
        [FEAT_BRANCH_ID, APP_ID, 'feature/redesign']
    );

    // Screens
    await conn.query(`INSERT IGNORE INTO screens (id, appId, name) VALUES (?, ?, ?)`, [
        SCREEN_HOMEPAGE_ID,
        APP_ID,
        'Homepage'
    ]);
    await conn.query(`INSERT IGNORE INTO screens (id, appId, name) VALUES (?, ?, ?)`, [
        SCREEN_DASHBOARD_ID,
        APP_ID,
        'Dashboard'
    ]);
    await conn.query(`INSERT IGNORE INTO screens (id, appId, name) VALUES (?, ?, ?)`, [
        SCREEN_SETTINGS_ID,
        APP_ID,
        'Settings'
    ]);
    await conn.query(`INSERT IGNORE INTO screens (id, appId, name) VALUES (?, ?, ?)`, [
        SCREEN_LOGIN_ID,
        APP_ID,
        'Login'
    ]);

    // ── Build 003: main, "changes approved", Jan 10 ──
    // First build, just Homepage
    await conn.query(
        `INSERT IGNORE INTO builds (id, appId, branchId, createdAt, commitHash, commitSubject, commitAuthor, ciJobId, status, approvedById, approvedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            BUILD_003_ID,
            APP_ID,
            MAIN_BRANCH_ID,
            new Date('2025-01-10T10:00:00Z'),
            'a1b2c3d',
            'Initial layout',
            'Test User',
            '100',
            'changes approved',
            ZERO_ID,
            new Date('2025-01-10T10:30:00Z')
        ]
    );
    // Build 003 screens: Homepage (no changes - baseline)
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_020, APP_ID, BUILD_003_ID, SCREEN_HOMEPAGE_ID, null, null, 'no changes', 'stored']
    );

    // ── Build 004: main, "changes approved", Jan 15 ──
    // Adds Dashboard and Settings
    await conn.query(
        `INSERT IGNORE INTO builds (id, appId, branchId, createdAt, commitHash, commitSubject, commitAuthor, ciJobId, status, approvedById, approvedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            BUILD_004_ID,
            APP_ID,
            MAIN_BRANCH_ID,
            new Date('2025-01-15T14:00:00Z'),
            'e4f5a6b',
            'Add dashboard and settings',
            'Test User',
            '101',
            'changes approved',
            ZERO_ID,
            new Date('2025-01-15T14:30:00Z')
        ]
    );
    // Build 004 screens: Homepage (no changes), Dashboard (no changes), Settings (no changes)
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_021, APP_ID, BUILD_004_ID, SCREEN_HOMEPAGE_ID, BUILD_003_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_022, APP_ID, BUILD_004_ID, SCREEN_DASHBOARD_ID, null, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_023, APP_ID, BUILD_004_ID, SCREEN_SETTINGS_ID, null, null, 'no changes', 'stored']
    );

    // ── Build 005: feature/redesign, "changes approved", Jan 18 ──
    // Homepage changed, Dashboard and Settings unchanged
    await conn.query(
        `INSERT IGNORE INTO builds (id, appId, branchId, createdAt, commitHash, commitSubject, commitAuthor, ciJobId, status, approvedById, approvedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            BUILD_005_ID,
            APP_ID,
            FEAT_BRANCH_ID,
            new Date('2025-01-18T09:00:00Z'),
            'c7d8e9f',
            'Update homepage styles',
            'Test User',
            '102',
            'changes approved',
            ZERO_ID,
            new Date('2025-01-18T09:30:00Z')
        ]
    );
    // Build 005 screens: Homepage (approved after review), Dashboard (no changes), Settings (no changes)
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_024, APP_ID, BUILD_005_ID, SCREEN_HOMEPAGE_ID, null, BUILD_005_ID, 'approved', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_025, APP_ID, BUILD_005_ID, SCREEN_DASHBOARD_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_026, APP_ID, BUILD_005_ID, SCREEN_SETTINGS_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );

    // ── Build 006: main, "no changes", Jan 20 ──
    await conn.query(
        `INSERT IGNORE INTO builds (id, appId, branchId, createdAt, commitHash, commitSubject, commitAuthor, ciJobId, status, approvedById, approvedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            BUILD_006_ID,
            APP_ID,
            MAIN_BRANCH_ID,
            new Date('2025-01-20T16:00:00Z'),
            'b2c3d4e',
            'Fix responsive breakpoints',
            'Test User',
            '103',
            'no changes',
            null,
            null
        ]
    );
    // Build 006 screens: Homepage (no changes), Dashboard (no changes), Settings (no changes)
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_027, APP_ID, BUILD_006_ID, SCREEN_HOMEPAGE_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_028, APP_ID, BUILD_006_ID, SCREEN_DASHBOARD_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_029, APP_ID, BUILD_006_ID, SCREEN_SETTINGS_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );

    // ── Build 007: feature/redesign, "needs review", Jan 22 ──
    // Homepage changed, Dashboard/Settings unchanged, Login is new
    await conn.query(
        `INSERT IGNORE INTO builds (id, appId, branchId, createdAt, commitHash, commitSubject, commitAuthor, ciJobId, status, approvedById, approvedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            BUILD_007_ID,
            APP_ID,
            FEAT_BRANCH_ID,
            new Date('2025-01-22T11:00:00Z'),
            'f0a1b2c',
            'Redesign login page',
            'Test User',
            '104',
            'needs review',
            null,
            null
        ]
    );
    // Build 007 screens: Homepage (needs review), Dashboard (no changes), Settings (no changes), Login (new)
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_02A, APP_ID, BUILD_007_ID, SCREEN_HOMEPAGE_ID, null, null, 'needs review', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_02B, APP_ID, BUILD_007_ID, SCREEN_DASHBOARD_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_02C, APP_ID, BUILD_007_ID, SCREEN_SETTINGS_ID, BUILD_004_ID, null, 'no changes', 'stored']
    );
    await conn.query(
        `INSERT IGNORE INTO builds_screens (id, appId, buildId, screenId, matchedBuildId, approvalBuildId, status, storageStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [BS_02D, APP_ID, BUILD_007_ID, SCREEN_LOGIN_ID, null, null, 'new', 'stored']
    );

    await conn.end();
    console.log('Database seeded.');
}

async function seedS3() {
    const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:29444',
        region: process.env.S3_REGION || 'us-east-1',
        forcePathStyle: true,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
            secretAccessKey: process.env.S3_ACCESS_SECRET || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
    });

    const bucket = process.env.S3_BUCKET || 'pixelci';

    // Ensure bucket exists
    try {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err) {
        if (err.name !== 'BucketAlreadyExists' && err.name !== 'BucketAlreadyOwnedByYou') throw err;
    }

    const uploads = [
        // ── Build 003: Homepage (finder-1) ──
        { key: `screens/${APP_ID}/${BUILD_003_ID}/${SCREEN_HOMEPAGE_ID}.png`, body: FINDER_1 },

        // ── Build 004: Homepage (finder-1), Dashboard (finder-2), Settings (finder-2-changed) ──
        { key: `screens/${APP_ID}/${BUILD_004_ID}/${SCREEN_HOMEPAGE_ID}.png`, body: FINDER_1 },
        { key: `screens/${APP_ID}/${BUILD_004_ID}/${SCREEN_DASHBOARD_ID}.png`, body: FINDER_2 },
        { key: `screens/${APP_ID}/${BUILD_004_ID}/${SCREEN_SETTINGS_ID}.png`, body: FINDER_2_CHANGED },

        // ── Build 005: Homepage (finder-1-changed), Dashboard (finder-2), Settings (finder-2-changed) ──
        { key: `screens/${APP_ID}/${BUILD_005_ID}/${SCREEN_HOMEPAGE_ID}.png`, body: FINDER_1_CHANGED },
        { key: `screens/${APP_ID}/${BUILD_005_ID}/${SCREEN_DASHBOARD_ID}.png`, body: FINDER_2 },
        { key: `screens/${APP_ID}/${BUILD_005_ID}/${SCREEN_SETTINGS_ID}.png`, body: FINDER_2_CHANGED },

        // ── Build 006: Homepage (finder-1), Dashboard (finder-2), Settings (finder-2-changed) ──
        { key: `screens/${APP_ID}/${BUILD_006_ID}/${SCREEN_HOMEPAGE_ID}.png`, body: FINDER_1 },
        { key: `screens/${APP_ID}/${BUILD_006_ID}/${SCREEN_DASHBOARD_ID}.png`, body: FINDER_2 },
        { key: `screens/${APP_ID}/${BUILD_006_ID}/${SCREEN_SETTINGS_ID}.png`, body: FINDER_2_CHANGED },

        // ── Build 007: Homepage (finder-1-changed), Dashboard (finder-2), Settings (finder-2-changed), Login (finder-2-changed-2) ──
        { key: `screens/${APP_ID}/${BUILD_007_ID}/${SCREEN_HOMEPAGE_ID}.png`, body: FINDER_1_CHANGED },
        { key: `screens/${APP_ID}/${BUILD_007_ID}/${SCREEN_DASHBOARD_ID}.png`, body: FINDER_2 },
        { key: `screens/${APP_ID}/${BUILD_007_ID}/${SCREEN_SETTINGS_ID}.png`, body: FINDER_2_CHANGED },
        { key: `screens/${APP_ID}/${BUILD_007_ID}/${SCREEN_LOGIN_ID}.png`, body: FINDER_2_CHANGED_2 },

        // ── Diff image for Build 007's Homepage (needs review) ──
        { key: `screens/${APP_ID}/${BUILD_007_ID}/${SCREEN_HOMEPAGE_ID}.diff.png`, body: FINDER_1_DIFF }
    ];

    await Promise.all(
        uploads.map(({ key, body }) =>
            s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/png' }))
        )
    );

    console.log('S3 seeded with test images.');
}

async function main() {
    await seedDatabase();
    await seedS3();
    console.log('E2E seed complete.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
