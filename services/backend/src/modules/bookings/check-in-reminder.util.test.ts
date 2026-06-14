import { describe, expect, test } from 'bun:test';
import { computeCheckInReminderDelayMinutes } from './check-in-reminder.util';

describe('computeCheckInReminderDelayMinutes', () => {
    test('schedules reminder for day before check-in at 18:00', () => {
        const now = new Date('2026-06-10T10:00:00');
        const checkIn = new Date('2026-06-12T14:00:00');
        const delay = computeCheckInReminderDelayMinutes(checkIn, now);
        // June 11 18:00 minus June 10 10:00 = 32 hours = 1920 minutes
        expect(delay).toBe(1920);
    });

    test('returns null when reminder time has passed', () => {
        const now = new Date('2026-06-11T19:00:00');
        const checkIn = new Date('2026-06-12T14:00:00');
        expect(computeCheckInReminderDelayMinutes(checkIn, now)).toBeNull();
    });

    test('returns null for same-day check-in', () => {
        const now = new Date('2026-06-12T08:00:00');
        const checkIn = new Date('2026-06-12T14:00:00');
        expect(computeCheckInReminderDelayMinutes(checkIn, now)).toBeNull();
    });

    test('returns null for invalid check-in date', () => {
        expect(computeCheckInReminderDelayMinutes('not-a-date')).toBeNull();
    });
});
