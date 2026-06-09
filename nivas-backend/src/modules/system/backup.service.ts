import { Client } from 'minio';
import { statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db } from '../../db';
import { platformSettings, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { NotificationChannelService } from '../notifications/notification-channel.service';

/**
 * Full-database backups for SaaS admin. Uses `pg_dump -Fc` (custom format =
 * compressed AND restorable with `pg_restore`). Stored in a PRIVATE object-storage
 * bucket, only the newest few kept (disk stays bounded), and handed back as a
 * time-limited download link (12h). Requires the `pg_dump`/`pg_restore` client
 * binaries on PATH where the backend runs (installed in the production image).
 */
const BACKUP_BUCKET = process.env.MINIO_BACKUP_BUCKET || 'nivas-backups';
const KEEP = Number(process.env.BACKUP_KEEP || 3);     // how many to retain
const LINK_TTL = 12 * 3600;                             // download link valid 12h

const ACCESS = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const SECRET = process.env.MINIO_SECRET_KEY || 'minioadmin';

// I/O client — talks to MinIO over the INTERNAL endpoint (reachable by the backend,
// e.g. "minio" inside Docker). Used for put/list/get/remove.
const client = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: ACCESS, secretKey: SECRET,
});

// Presign-only client — configured with the PUBLIC host. presignedGetObject is a
// purely local HMAC computation (no network), so this produces a link the admin's
// browser can actually open, without the backend needing to reach the public host.
const presignClient: Client = (() => {
    const pub = process.env.MINIO_PUBLIC_URL;
    if (!pub) return client;
    try {
        const u = new URL(pub);
        return new Client({
            endPoint: u.hostname,
            port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
            useSSL: u.protocol === 'https:',
            accessKey: ACCESS, secretKey: SECRET,
        });
    } catch { return client; }
})();

// If MINIO_PUBLIC_URL includes a sub-path (e.g. https://domain/storage for the
// nginx proxy), minio-js drops it (it signs host + /bucket/obj only). We re-insert
// the prefix into the signed URL — nginx strips it again before MinIO, so the
// signature (over /bucket/obj) still validates.
const PUBLIC_PATH = (() => { try { return new URL(process.env.MINIO_PUBLIC_URL || '').pathname.replace(/\/+$/, ''); } catch { return ''; } })();
const presignedUrl = async (name: string) => {
    const signed = await presignClient.presignedGetObject(BACKUP_BUCKET, name, LINK_TTL);
    if (!PUBLIC_PATH || PUBLIC_PATH === '') return signed;
    try { const u = new URL(signed); u.pathname = PUBLIC_PATH + u.pathname; return u.toString(); } catch { return signed; }
};

async function ensureBucket() {
    if (!(await client.bucketExists(BACKUP_BUCKET))) {
        await client.makeBucket(BACKUP_BUCKET, 'us-east-1'); // no public policy → private
    }
}

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

export const BackupService = {
    async getSettings() {
        const ps: any = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { backupConfig: true } });
        const cfg = (ps?.backupConfig || {}) as any;
        return { autoEnabled: !!cfg.autoEnabled, frequency: cfg.frequency || 'WEEKLY', lastRunAt: cfg.lastRunAt || null, keep: KEEP };
    },

    async patchConfig(patch: Record<string, any>) {
        const ps: any = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1), columns: { backupConfig: true } });
        const next = { ...((ps?.backupConfig || {}) as any), ...patch };
        await db.insert(platformSettings).values({ id: 1, backupConfig: next } as any)
            .onConflictDoUpdate({ target: platformSettings.id, set: { backupConfig: next, updatedAt: new Date() } });
    },

    async setSettings(data: { autoEnabled?: boolean; frequency?: 'DAILY' | 'WEEKLY' }) {
        const patch: any = {};
        if (data.autoEnabled !== undefined) patch.autoEnabled = data.autoEnabled;
        if (data.frequency) patch.frequency = data.frequency;
        if (Object.keys(patch).length) await this.patchConfig(patch);
        return this.getSettings();
    },

    /** Run pg_dump, upload, rotate, email admins, return a download link. */
    async create(): Promise<{ filename: string; sizeBytes: number; createdAt: string; downloadUrl: string }> {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL is not set');
        await ensureBucket();

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${stamp}.dump`;
        const tmpPath = join(process.env.BACKUP_TMP_DIR || tmpdir(), filename);

        try {
            // STREAM pg_dump → temp file on disk (never buffer the whole dump in RAM —
            // a large DB would OOM the container). Then upload the file (also streamed).
            const proc = Bun.spawn(['pg_dump', '-Fc', '--no-owner', '--no-acl', url], { stdout: 'pipe', stderr: 'pipe', env: process.env });
            await Bun.write(tmpPath, new Response(proc.stdout));
            await proc.exited;
            if (proc.exitCode !== 0) {
                const err = await new Response(proc.stderr).text();
                throw new Error(`Backup failed — database tools unavailable or unreachable. ${err.slice(0, 250)}`);
            }
            const sizeBytes = statSync(tmpPath).size;
            if (sizeBytes === 0) throw new Error('Backup produced an empty file');

            await client.fPutObject(BACKUP_BUCKET, filename, tmpPath, { 'Content-Type': 'application/octet-stream' });

            await this.rotate();
            await this.patchConfig({ lastRunAt: new Date().toISOString() });

            const downloadUrl = await presignedUrl(filename);
            this.emailAdmins(filename, sizeBytes, downloadUrl).catch(() => { /* best-effort */ });
            return { filename, sizeBytes, createdAt: new Date().toISOString(), downloadUrl };
        } finally {
            // Always remove the local temp file (keep disk usage near zero).
            try { unlinkSync(tmpPath); } catch { /* already gone */ }
        }
    },

    /** Keep only the newest KEEP backups; delete the rest (bounds disk usage). */
    async rotate() {
        const all = await this.listObjects();
        for (const o of all.slice(KEEP)) {
            try { await client.removeObject(BACKUP_BUCKET, o.name); } catch { /* ignore */ }
        }
    },

    async listObjects(): Promise<{ name: string; size: number; lastModified: Date }[]> {
        await ensureBucket();
        const out: { name: string; size: number; lastModified: Date }[] = [];
        await new Promise<void>((resolve, reject) => {
            const stream = client.listObjects(BACKUP_BUCKET, '', true);
            stream.on('data', (o: any) => { if (o.name) out.push({ name: o.name, size: o.size, lastModified: o.lastModified }); });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        return out.sort((a, b) => b.name.localeCompare(a.name)); // ISO stamp in name → name sort = time sort
    },

    async list() {
        const objs = await this.listObjects();
        return Promise.all(objs.map(async o => ({
            filename: o.name,
            sizeBytes: o.size,
            createdAt: o.lastModified,
            downloadUrl: await presignedUrl(o.name),
        })));
    },

    /** Email the download link to every super-admin (key for unattended auto-backups). */
    async emailAdmins(filename: string, sizeBytes: number, downloadUrl: string) {
        const ps: any = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1) });
        if (!ps?.smtpHost) return;
        const settings = { ...ps, smtpUsername: ps.smtpUser }; // sendEmail expects smtpUsername
        const admins = await db.query.users.findMany({ where: eq(users.userType, 'SUPER_ADMIN'), columns: { email: true } });
        const html = `<div style="font-family:sans-serif;font-size:14px;color:#222">
            <h2>Database backup ready</h2>
            <p>A new backup <b>${filename}</b> (${mb(sizeBytes)}) is ready.</p>
            <p><a href="${downloadUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Download backup</a></p>
            <p style="color:#888;font-size:12px">This link expires in 12 hours. Keep this file safe — it contains all hotel data.</p>
        </div>`;
        for (const a of admins) {
            if (a.email) await NotificationChannelService.sendEmail(settings, a.email, 'Nivas — Database backup ready', html).catch(() => { });
        }
    },

    /** Cron helper — run a backup if auto is enabled and due. */
    async runIfDue() {
        const s = await this.getSettings();
        if (!s.autoEnabled) return { skipped: 'auto disabled' };
        const last = s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0;
        const dueMs = s.frequency === 'DAILY' ? 86400000 : 7 * 86400000;
        if (Date.now() - last < dueMs - 3600000) return { skipped: 'not due' }; // 1h slack
        const r = await this.create();
        return { ran: r.filename };
    },
};
