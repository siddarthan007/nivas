/**
 * Schema helpers for Elysia / TypeBox validation.
 *
 * Elysia 1.4 re-exports TypeBox's `t`, but its bundled TS declarations
 * omit some JSON-Schema options (e.g. `minLength`, `maxLength`) on
 * `t.String() even though they work perfectly at runtime.  We centralise
 * the `as any` workaround here so the rest of the codebase stays clean.
 */

import { t } from 'elysia';

export const s = {
  /** String with optional min / max length (runtime-validated by TypeBox) */
  string(opts?: { minLength?: number; maxLength?: number; pattern?: string; format?: string }) {
    return t.String(opts as any);
  },

  /** Numeric string that must match a given length (e.g. OTP) */
  fixedLengthString(length: number) {
    return t.String({ minLength: length, maxLength: length } as any);
  },

  /** Positive integer (>= 1) */
  positiveInteger() {
    return t.Number({ minimum: 1 } as any);
  },
};
