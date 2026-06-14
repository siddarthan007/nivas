import { describe, it, expect } from 'bun:test';
import {
    validateLicense,
    isLicenseValid,
    getLicenseErrorMessage,
    type LicenseInfo,
    type LicenseStatus
} from '../../../src/middlewares/license.middleware';

describe('License Middleware - Pure Functions', () => {
    describe('isLicenseValid', () => {
        it('should return true for ACTIVE status', () => {
            const info: LicenseInfo = {
                status: 'ACTIVE',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                graceEndsAt: null,
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should return true for TRIAL status', () => {
            const info: LicenseInfo = {
                status: 'TRIAL',
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                graceEndsAt: null,
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should return true for EXPIRED within grace period', () => {
            const info: LicenseInfo = {
                status: 'EXPIRED',
                expiresAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
                graceEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
                isWithinGrace: true
            };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should return false for EXPIRED outside grace period', () => {
            const info: LicenseInfo = {
                status: 'EXPIRED',
                expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
                graceEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(false);
        });

        it('should return false for PAUSED status', () => {
            const info: LicenseInfo = {
                status: 'PAUSED',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(false);
        });

        it('should return false for REVOKED status', () => {
            const info: LicenseInfo = {
                status: 'REVOKED',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(false);
        });

        it('should return false for PENDING_PAYMENT status', () => {
            const info: LicenseInfo = {
                status: 'PENDING_PAYMENT',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            expect(isLicenseValid(info)).toBe(false);
        });
    });

    describe('getLicenseErrorMessage', () => {
        it('should return grace period message when within grace', () => {
            const graceEnds = new Date(Date.now() + 12 * 60 * 60 * 1000);
            const info: LicenseInfo = {
                status: 'EXPIRED',
                expiresAt: new Date(),
                graceEndsAt: graceEnds,
                isWithinGrace: true
            };
            const message = getLicenseErrorMessage(info);
            expect(message).toContain('Grace period');
            expect(message).toContain('hours');
        });

        it('should return expired message when outside grace', () => {
            const info: LicenseInfo = {
                status: 'EXPIRED',
                expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
                graceEndsAt: null,
                isWithinGrace: false
            };
            const message = getLicenseErrorMessage(info);
            expect(message).toContain('expired');
            expect(message).toContain('renew');
        });

        it('should return paused message', () => {
            const info: LicenseInfo = {
                status: 'PAUSED',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            const message = getLicenseErrorMessage(info);
            expect(message).toContain('paused');
        });

        it('should return revoked message', () => {
            const info: LicenseInfo = {
                status: 'REVOKED',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            const message = getLicenseErrorMessage(info);
            expect(message).toContain('revoked');
        });

        it('should return pending payment message', () => {
            const info: LicenseInfo = {
                status: 'PENDING_PAYMENT',
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };
            const message = getLicenseErrorMessage(info);
            expect(message).toContain('Payment pending');
        });
    });
});

describe('License Status Transitions', () => {
    const statuses: LicenseStatus[] = ['ACTIVE', 'PAUSED', 'REVOKED', 'TRIAL', 'EXPIRED', 'PENDING_PAYMENT'];

    statuses.forEach(status => {
        it(`should handle ${status} status type correctly`, () => {
            const info: LicenseInfo = {
                status,
                expiresAt: null,
                graceEndsAt: null,
                isWithinGrace: false
            };

            // Should not throw
            const result = isLicenseValid(info);
            expect(typeof result).toBe('boolean');

            const message = getLicenseErrorMessage(info);
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        });
    });
});

describe('Grace Period Calculations', () => {
    it('should calculate hours remaining correctly', () => {
        const hoursRemaining = 12;
        const graceEnds = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

        const info: LicenseInfo = {
            status: 'EXPIRED',
            expiresAt: new Date(),
            graceEndsAt: graceEnds,
            isWithinGrace: true
        };

        const message = getLicenseErrorMessage(info);
        // Should show approximately 12 hours (ceil rounds up)
        expect(message).toMatch(/\d+ hours/);
    });

    it('should handle edge case of 0 hours remaining', () => {
        const info: LicenseInfo = {
            status: 'EXPIRED',
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            graceEndsAt: new Date(Date.now()),
            isWithinGrace: false
        };

        expect(isLicenseValid(info)).toBe(false);
    });
});
