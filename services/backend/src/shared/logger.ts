import pino from 'pino';
import { extractClientMeta } from './client-meta';

const isDev = process.env.NODE_ENV !== 'production';

/** Skip noisy paths that would flood logs / disk in production. */
const SKIP_LOG_PREFIXES = ['/health', '/docs', '/swagger', '/public/uploads', '/favicon.ico'];

/**
 * In production, log only a sample of successful requests to cut log volume and
 * disk I/O. Errors and slow requests are always logged when using logRequestWithTiming.
 */
const LOG_SAMPLE_RATE = (() => {
    const raw = process.env.LOG_SAMPLE_RATE;
    if (raw != null && raw !== '') {
        const n = Number(raw);
        if (!Number.isNaN(n) && n >= 0 && n <= 1) return n;
    }
    return isDev ? 1 : 0.05;
})();

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'info' : 'warn'),
    redact: {
        paths: ['req.headers.authorization', 'password', 'token', 'secret', 'creditCard'],
        censor: '[REDACTED]'
    },
    ...(isDev ? {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
    } : {})
});

function shouldSkipUrl(url: string): boolean {
    try {
        const path = new URL(url).pathname;
        return SKIP_LOG_PREFIXES.some(p => path === p || path.startsWith(p));
    } catch {
        return false;
    }
}

export const logRequest = (req: Request) => {
    if (shouldSkipUrl(req.url)) return;
    if (!isDev && Math.random() > LOG_SAMPLE_RATE) return;

    const { ip, clientType, userAgent } = extractClientMeta(req);
    logger.info({
        method: req.method,
        url: req.url,
        ip,
        clientType,
        userAgent,
    }, 'Incoming Request');
};
