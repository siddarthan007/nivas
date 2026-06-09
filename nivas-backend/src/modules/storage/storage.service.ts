import { Client } from 'minio';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { ValidationError, BusinessLogicError } from '../../utils/errors';

// Low-resource tuning: libvips defaults to one thread PER CPU + a large pixel
// cache — heavy on a small VM. Cap both so image uploads can't spike RAM/threads.
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 50 });

// Raster images we re-encode to compressed WebP (GIF excluded to keep animation).
const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_DIMENSION = 1600; // px — plenty for menu photos, logos, room images

// Sniff the REAL content type from magic bytes — never trust the client-declared
// file.type/extension (a .html renamed .png would otherwise pass the allowlist).
function sniffType(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length < 12) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { mime: 'image/gif', ext: 'gif' };
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
    return null;
}

// Initialize MinIO Client
const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'nivas';

// Lazy, self-healing bucket init. The backend may boot before MinIO is ready
// (a one-shot startup attempt would then fail forever). Instead we ensure the
// bucket once and CACHE the success; if it fails (MinIO not up yet), the next
// upload retries — so it heals automatically without a restart.
let bucketReady: Promise<void> | null = null;
async function ensureBucketReady(): Promise<void> {
    const exists = await minioClient.bucketExists(BUCKET_NAME).catch(() => false);
    if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
        const policy = {
            Version: '2012-10-17',
            Statement: [{ Action: ['s3:GetObject'], Effect: 'Allow', Principal: '*', Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`] }],
        };
        await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
        console.log(`[Storage] Created public bucket: ${BUCKET_NAME}`);
    }
}
async function ensureBucket(): Promise<void> {
    if (!bucketReady) {
        bucketReady = ensureBucketReady().catch((err) => {
            bucketReady = null; // allow the next call to retry
            console.error('[Storage] bucket init failed (will retry):', (err as any)?.message || err);
            throw err;
        });
    }
    return bucketReady;
}
// Warm attempt at boot (best-effort — ignored if MinIO isn't up yet).
ensureBucket().catch(() => { /* retried lazily on first upload */ });

export const StorageService = {
    async uploadFile(file: File, hotelId: number, allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'], maxSize: number = 5 * 1024 * 1024) {
        if (!file) {
            throw new ValidationError('No file provided');
        }
        await ensureBucket(); // self-healing if MinIO came up after the backend

        // Validate file size
        if (file.size > maxSize) {
            throw new ValidationError(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
        }

        let buffer: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()));

        // Validate by ACTUAL content (magic bytes), not the client-declared type.
        const sniffed = sniffType(buffer);
        if (!sniffed) {
            throw new ValidationError('Unsupported or unrecognized file content (expected JPEG, PNG, GIF, WebP or PDF)');
        }
        if (!allowedTypes.includes(sniffed.mime)) {
            throw new ValidationError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
        }

        // Unguessable, crypto-random object key (prevents cross-tenant enumeration).
        const uniqueSuffix = `${Date.now()}-${randomBytes(12).toString('hex')}`;
        let contentType = sniffed.mime;
        let extension = sniffed.ext;

        // Compress raster images: auto-orient, downscale to a sane max, re-encode
        // to WebP@80. Big space saving for a mid-resource launch. Falls back to the
        // original bytes if processing fails (e.g. a corrupt image).
        if (COMPRESSIBLE_IMAGE_TYPES.includes(sniffed.mime)) {
            try {
                buffer = await sharp(buffer)
                    .rotate()
                    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();
                contentType = 'image/webp';
                extension = 'webp';
            } catch (err) {
                console.warn('[Storage] Image compression failed, storing original:', err);
            }
        }

        const filename = `${uniqueSuffix}.${extension}`;
        // Organize by hotel to prevent cross-tenant access logically in the path
        const objectName = `${hotelId}/${filename}`;

        try {
            await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
                'Content-Type': contentType,
                // Stop the browser from MIME-sniffing the asset into something
                // executable, and force inline display (never download-and-run).
                'X-Content-Type-Options': 'nosniff',
                'Content-Disposition': 'inline',
                // Uploaded assets are immutable (unique object names) — let browsers
                // and any CDN cache them for a year.
                'Cache-Control': 'public, max-age=31536000, immutable',
            });
        } catch (error) {
            console.error('[Storage] Upload failed:', error);
            throw new BusinessLogicError('Failed to save file to object storage');
        }

        // Public URL for browser access. In Docker, MINIO_ENDPOINT is internal (e.g. "minio"),
        // so MINIO_PUBLIC_URL must point to a host-resolvable address (e.g. http://localhost:9000).
        const url = process.env.MINIO_PUBLIC_URL
            ? `${process.env.MINIO_PUBLIC_URL}/${BUCKET_NAME}/${objectName}`
            : (() => {
                const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
                const host = process.env.MINIO_ENDPOINT || 'localhost';
                const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : '';
                return `${protocol}://${host}${port}/${BUCKET_NAME}/${objectName}`;
            })();

        return {
            url,
            filename,
            mimetype: contentType,
            size: buffer.length
        };
    },

    /**
     * Delete an uploaded object given its public URL. Best-effort — never throws
     * (a failed cleanup must not block the entity delete). Only touches objects in
     * OUR bucket (ignores external URLs). Call when an entity is HARD-deleted.
     */
    async deleteByUrl(url: string | null | undefined): Promise<void> {
        if (!url || typeof url !== 'string') return;
        try {
            const marker = `/${BUCKET_NAME}/`;
            const idx = url.indexOf(marker);
            if (idx === -1) return; // not one of our objects
            const objectName = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]!);
            if (!objectName) return;
            await minioClient.removeObject(BUCKET_NAME, objectName);
        } catch (err) {
            console.warn('[Storage] Image cleanup failed (ignored):', (err as any)?.message || err);
        }
    },

    /** Delete several object URLs (e.g. a gallery). Best-effort. */
    async deleteManyByUrl(urls: (string | null | undefined)[]): Promise<void> {
        await Promise.all((urls || []).map(u => this.deleteByUrl(u)));
    },

    /**
     * Total object-storage usage for ONE hotel. Optimized: lists only the hotel's
     * own prefix (`<hotelId>/`) — it never scans other tenants' files.
     */
    async getUsageByHotel(hotelId: number): Promise<{ objects: number; bytes: number }> {
        return new Promise((resolve) => {
            let objects = 0, bytes = 0;
            const stream = minioClient.listObjectsV2(BUCKET_NAME, `${hotelId}/`, true);
            stream.on('data', (o: any) => { objects++; bytes += o.size || 0; });
            stream.on('end', () => resolve({ objects, bytes }));
            stream.on('error', () => resolve({ objects, bytes })); // best-effort
        });
    },
};
