import { describe, expect, test } from 'bun:test';
import { applyMessageTemplate } from './message-template.util';

describe('applyMessageTemplate', () => {
    test('supports single-brace variables', () => {
        const out = applyMessageTemplate('Hi {guestName}, welcome to {hotelName}', { guestName: 'Sam', hotelName: 'Himalaya' }, 'fb');
        expect(out).toBe('Hi Sam, welcome to Himalaya');
    });

    test('supports double-brace variables', () => {
        const out = applyMessageTemplate('Room {{roomNumber}}', { roomNumber: '204' }, 'fb');
        expect(out).toBe('Room 204');
    });

    test('uses fallback when template empty', () => {
        expect(applyMessageTemplate('', { a: '1' }, 'default')).toBe('default');
    });
});
