/** Guest portal JWTs use synthetic ids (guest-{roomId}), not user UUIDs. */
export function isGuestSessionId(id: string | null | undefined): boolean {
    return typeof id === 'string' && id.startsWith('guest-');
}
