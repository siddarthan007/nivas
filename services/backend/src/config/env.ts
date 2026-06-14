import { z } from 'zod';

/**
 * Environment Configuration
 * Core application settings only - service credentials are stored per-hotel in database
 * (notification_settings table)
 */
const envSchema = z.object({
    // Core
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),

    // Database
    DATABASE_URL: z.string().optional(),

    // JWT
    JWT_SECRET: z.string().min(32, 'JWT_SECRET should be at least 32 characters').default('nivas-secret-key-dev-only-change-in-production'),
    JWT_EXPIRY: z.string().default('7d'),

    // Guest Portal
    GUEST_PORTAL_URL: z.string().url().optional(),

    // File Storage
    UPLOAD_DIR: z.string().default('public/uploads'),
    MAX_FILE_SIZE: z.string().default('10485760'), // 10MB

    // Super Admin
    SUPER_ADMIN_EMAIL: z.string().email().optional(),

    // CORS
    ALLOWED_ORIGINS: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.warn('[Config] Environment validation warnings:', parsed.error.format());
}

const env = parsed.success ? parsed.data : envSchema.parse({});

/**
 * Application Configuration
 * Use this exported config object throughout the application
 */
export const config = {
    env: env.NODE_ENV,
    port: parseInt(env.PORT),
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',

    jwt: {
        secret: env.JWT_SECRET,
        expiry: env.JWT_EXPIRY
    },

    database: {
        url: env.DATABASE_URL
    },

    app: {
        guestPortalUrl: env.GUEST_PORTAL_URL || 'http://localhost:5173'
    },

    storage: {
        uploadDir: env.UPLOAD_DIR,
        maxFileSize: parseInt(env.MAX_FILE_SIZE)
    },

    superAdmin: {
        email: env.SUPER_ADMIN_EMAIL
    },

    cors: {
        origins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000', 'http://localhost:5173', 'exp://*', 'http://+']
    }
};

/**
 * Validate critical configuration on startup
 */
export function validateConfig(): void {
    if (config.isProduction) {
        if (config.jwt.secret === 'nivas-secret-key-dev-only-change-in-production') {
            throw new Error('JWT_SECRET must be changed in production!');
        }
        if (!config.database.url) {
            throw new Error('DATABASE_URL is required in production!');
        }
    }
}
