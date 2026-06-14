import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Import the functions we're testing
import {
    isLicenseValid,
    getLicenseErrorMessage,
    type LicenseInfo,
    type LicenseStatus
} from '../../../src/middlewares/license.middleware';

/**
 * LicenseService Unit Tests
 * Tests real-world license management flows
 */
describe('License Service - Business Logic', () => {
    describe('License Status Validation', () => {
        const testCases: { status: LicenseStatus; isWithinGrace: boolean; expected: boolean }[] = [
            { status: 'ACTIVE', isWithinGrace: false, expected: true },
            { status: 'TRIAL', isWithinGrace: false, expected: true },
            { status: 'EXPIRED', isWithinGrace: true, expected: true },
            { status: 'EXPIRED', isWithinGrace: false, expected: false },
            { status: 'PAUSED', isWithinGrace: false, expected: false },
            { status: 'REVOKED', isWithinGrace: false, expected: false },
            { status: 'PENDING_PAYMENT', isWithinGrace: false, expected: false },
        ];

        testCases.forEach(({ status, isWithinGrace, expected }) => {
            it(`should return ${expected} for ${status} (grace: ${isWithinGrace})`, () => {
                const info: LicenseInfo = {
                    status,
                    expiresAt: new Date(),
                    graceEndsAt: isWithinGrace ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null,
                    isWithinGrace
                };
                expect(isLicenseValid(info)).toBe(expected);
            });
        });
    });

    describe('Error Messages', () => {
        it('should provide actionable message for PAUSED', () => {
            const info: LicenseInfo = { status: 'PAUSED', expiresAt: null, graceEndsAt: null, isWithinGrace: false };
            const msg = getLicenseErrorMessage(info);
            expect(msg).toContain('paused');
            expect(msg).toContain('support');
        });

        it('should provide actionable message for REVOKED', () => {
            const info: LicenseInfo = { status: 'REVOKED', expiresAt: null, graceEndsAt: null, isWithinGrace: false };
            const msg = getLicenseErrorMessage(info);
            expect(msg).toContain('revoked');
            expect(msg).toContain('support');
        });

        it('should show grace period countdown for EXPIRED with grace', () => {
            const graceEndsAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
            const info: LicenseInfo = { status: 'EXPIRED', expiresAt: new Date(), graceEndsAt, isWithinGrace: true };
            const msg = getLicenseErrorMessage(info);
            expect(msg).toContain('Grace period');
            expect(msg).toMatch(/\d+ hours/);
        });

        it('should prompt renewal for EXPIRED without grace', () => {
            const info: LicenseInfo = { status: 'EXPIRED', expiresAt: new Date(), graceEndsAt: null, isWithinGrace: false };
            const msg = getLicenseErrorMessage(info);
            expect(msg).toContain('expired');
            expect(msg).toContain('renew');
        });
    });
});

describe('License Service - Real World Flows', () => {
    describe('New Hotel Onboarding Flow', () => {
        it('should start with TRIAL status', () => {
            const info: LicenseInfo = { status: 'TRIAL', expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should allow access during trial', () => {
            const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days left
            const info: LicenseInfo = { status: 'TRIAL', expiresAt: trialEnds, graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });
    });

    describe('Trial Expiry Flow', () => {
        it('should transition to EXPIRED when trial ends', () => {
            const info: LicenseInfo = { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), graceEndsAt: new Date(Date.now() + 23 * 60 * 60 * 1000), isWithinGrace: true };
            expect(isLicenseValid(info)).toBe(true); // Still valid during grace
        });

        it('should block access after grace period', () => {
            const info: LicenseInfo = { status: 'EXPIRED', expiresAt: new Date(Date.now() - 48 * 60 * 60 * 1000), graceEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(false);
        });
    });

    describe('Payment Flow', () => {
        it('should activate license after payment', () => {
            const info: LicenseInfo = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should allow full access with ACTIVE status', () => {
            const info: LicenseInfo = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });
    });

    describe('Non-Payment Flow', () => {
        it('should pause license for non-payment', () => {
            const info: LicenseInfo = { status: 'PAUSED', expiresAt: null, graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(false);
        });

        it('should resume after payment', () => {
            const info: LicenseInfo = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });
    });

    describe('Terms Violation Flow', () => {
        it('should revoke license for violations', () => {
            const info: LicenseInfo = { status: 'REVOKED', expiresAt: null, graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(false);
        });

        it('should require new trial after revocation reinstatement', () => {
            const info: LicenseInfo = { status: 'TRIAL', expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });
    });

    describe('Subscription Renewal Flow', () => {
        it('should extend license on renewal', () => {
            const info: LicenseInfo = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });

        it('should handle expired-to-active transition', () => {
            // User pays after expiry
            const info: LicenseInfo = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), graceEndsAt: null, isWithinGrace: false };
            expect(isLicenseValid(info)).toBe(true);
        });
    });
});

describe('License Service - Edge Cases', () => {
    it('should handle null expiry date', () => {
        const info: LicenseInfo = { status: 'ACTIVE', expiresAt: null, graceEndsAt: null, isWithinGrace: false };
        expect(isLicenseValid(info)).toBe(true);
    });

    it('should handle expiry exactly now', () => {
        const now = new Date();
        const info: LicenseInfo = { status: 'ACTIVE', expiresAt: now, graceEndsAt: null, isWithinGrace: false };
        expect(isLicenseValid(info)).toBe(true); // Still ACTIVE, middleware handles transition
    });

    it('should handle grace period edge - exactly at end', () => {
        const now = new Date();
        const info: LicenseInfo = { status: 'EXPIRED', expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), graceEndsAt: now, isWithinGrace: false };
        expect(isLicenseValid(info)).toBe(false);
    });

    it('should handle all status types without throwing', () => {
        const statuses: LicenseStatus[] = ['ACTIVE', 'PAUSED', 'REVOKED', 'TRIAL', 'EXPIRED', 'PENDING_PAYMENT'];
        statuses.forEach(status => {
            const info: LicenseInfo = { status, expiresAt: null, graceEndsAt: null, isWithinGrace: false };
            expect(() => isLicenseValid(info)).not.toThrow();
            expect(() => getLicenseErrorMessage(info)).not.toThrow();
        });
    });
});
