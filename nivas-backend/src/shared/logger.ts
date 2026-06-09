import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
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

export const logRequest = (req: Request) => {
    logger.info({
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent')
    }, 'Incoming Request');
};
