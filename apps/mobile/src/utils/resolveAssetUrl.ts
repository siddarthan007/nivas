const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const STORAGE_URL = process.env.EXPO_PUBLIC_STORAGE_URL;

const UNREACHABLE_HOSTS = new Set(['localhost', '127.0.0.1', 'minio']);

function rewriteOrigin(url: URL, origin: string): string {
    return `${origin.replace(/\/$/, '')}${url.pathname}${url.search}`;
}

/** Rewrite MinIO / localhost asset URLs so physical devices can load images. */
export function resolveAssetUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;

    if (STORAGE_URL) {
        try {
            const asset = new URL(trimmed);
            if (UNREACHABLE_HOSTS.has(asset.hostname)) {
                return rewriteOrigin(asset, STORAGE_URL);
            }
        } catch {
            if (trimmed.startsWith('/')) {
                return `${STORAGE_URL.replace(/\/$/, '')}${trimmed}`;
            }
        }
        return trimmed;
    }

    if (!API_URL) return trimmed;

    try {
        const api = new URL(API_URL);
        const asset = new URL(trimmed);
        if (UNREACHABLE_HOSTS.has(asset.hostname)) {
            const storageOrigin = `${api.protocol}//${api.hostname}:9000`;
            return rewriteOrigin(asset, storageOrigin);
        }
    } catch {
        /* keep original */
    }

    return trimmed;
}
