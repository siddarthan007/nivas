import { describe, expect, test } from 'bun:test';
import { canMergeOrderStatus, validateMergeSources } from './orders-pos.util';

describe('validateMergeSources', () => {
    test('rejects empty sources', () => {
        expect(validateMergeSources('a', []).ok).toBe(false);
    });

    test('rejects self-merge', () => {
        expect(validateMergeSources('a', ['a']).ok).toBe(false);
    });

    test('accepts valid merge', () => {
        expect(validateMergeSources('a', ['b', 'c']).ok).toBe(true);
    });
});

describe('canMergeOrderStatus', () => {
    test('allows open statuses', () => {
        expect(canMergeOrderStatus('PENDING')).toBe(true);
        expect(canMergeOrderStatus('PREPARING')).toBe(true);
    });

    test('blocks served', () => {
        expect(canMergeOrderStatus('SERVED')).toBe(false);
    });
});
