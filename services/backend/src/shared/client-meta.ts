/** Extract client IP and device class from incoming request headers. */
export function extractClientMeta(req: Request) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = req.headers.get('cf-connecting-ip')
        || req.headers.get('x-real-ip')
        || (forwarded ? forwarded.split(',')[0]?.trim() : null)
        || 'unknown';

    const ua = req.headers.get('user-agent') || '';
    const explicit = req.headers.get('x-client-type');
    let clientType = explicit || 'web';
    if (!explicit) {
        if (/Expo|ReactNative|okhttp|CFNetwork/i.test(ua)) clientType = 'mobile';
        else if (/Mobile|Android|iPhone|iPad/i.test(ua)) clientType = 'mobile-web';
    }

    const isMobile = clientType === 'mobile' || clientType === 'mobile-web';
    return { ip, clientType, isMobile, userAgent: ua };
}
