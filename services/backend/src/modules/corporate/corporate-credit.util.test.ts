import { describe, expect, test } from 'bun:test';
import { evaluateCreditLimit } from './corporate-credit.util';

describe('evaluateCreditLimit', () => {
    test('allows any amount when credit limit is zero or unset', () => {
        expect(evaluateCreditLimit(50_000, 0, 100_000).ok).toBe(true);
        expect(evaluateCreditLimit(50_000, -1, 100_000).ok).toBe(true);
    });

    test('allows when projected balance stays within limit', () => {
        const result = evaluateCreditLimit(40_000, 100_000, 50_000);
        expect(result.ok).toBe(true);
        expect(result.projected).toBe(90_000);
    });

    test('allows when projected balance equals limit exactly', () => {
        const result = evaluateCreditLimit(40_000, 100_000, 60_000);
        expect(result.ok).toBe(true);
        expect(result.projected).toBe(100_000);
    });

    test('warns when projected balance exceeds limit', () => {
        const result = evaluateCreditLimit(80_000, 100_000, 25_000, 'Acme Corp');
        expect(result.ok).toBe(false);
        expect(result.warning).toContain('Acme Corp');
        expect(result.warning).toContain('105000.00');
        expect(result.projected).toBe(105_000);
    });

    test('handles zero balance with new charge at limit boundary', () => {
        expect(evaluateCreditLimit(0, 50_000, 50_001).ok).toBe(false);
        expect(evaluateCreditLimit(0, 50_000, 50_000).ok).toBe(true);
    });
});
