/** Drizzle `with` relations may type as T | T[] — normalize to a single row. */
export function relationOne<T>(value: T | T[] | null | undefined): T | null {
    if (value == null) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}
