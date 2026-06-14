export type NotificationPlatform = 'web' | 'mobile';

export interface NotificationRouteInput {
    type?: string;
    metadata?: Record<string, unknown> | null;
}

function upperType(type?: string): string {
    return (type || '').toUpperCase();
}

/** Resolve a notification to a navigable route for web or mobile. */
export function deriveNotificationRoute(
    platform: NotificationPlatform,
    input: NotificationRouteInput,
): string | undefined {
    const m = input.metadata || {};
    if (typeof m.href === 'string' && m.href) return m.href;
    if (typeof m.path === 'string' && m.path) return m.path;
    if (typeof m.route === 'string' && m.route) return m.route;

    const t = upperType(input.type);

    if (platform === 'web') {
        if (t.startsWith('LICENSE') || t.startsWith('TRIAL')) return '/hotel/billing';
        if (t.includes('PAYMENT') || t.includes('PAYROLL')) return '/hotel/finance?tab=payments';
        if (t.includes('KITCHEN')) return '/hotel/kitchen';
        if (t.includes('ORDER')) return '/hotel/orders';
        if (t.includes('HOUSEKEEPING') || t.includes('CHECKOUT_ROOM')) return '/hotel/housekeeping';
        if (t.includes('CHECKOUT_REQUEST') || t.includes('BOOKING') || t === 'VIP_ARRIVAL') return '/hotel/bookings';
        if (t.includes('NIGHT_AUDIT')) return '/hotel/finance?tab=night-audit';
        if (t.includes('DND')) return '/hotel/rooms';
        if (t.includes('INVENTORY') || t.includes('LOW_STOCK') || t.includes('PROCUREMENT')) return '/hotel/inventory';
        if (t.includes('MESSAGE')) return '/hotel/messages';

        if (m.guestId) return `/hotel/guests/${m.guestId}`;
        if (m.bookingId) return `/hotel/bookings?bookingId=${m.bookingId}`;
        if (m.orderId) return `/hotel/orders?orderId=${m.orderId}`;
        if (m.tableId) return '/hotel/operations/tables';
        if (m.invoiceId) return '/hotel/finance?tab=invoices';
        if (m.paymentId) return '/hotel/finance?tab=payments';
        if (m.taskId) return '/hotel/housekeeping';
        if (m.roomId) return `/hotel/rooms`;
        return undefined;
    }

    // Mobile (Expo Router paths)
    if (t.includes('MESSAGE')) return '/(app)/messages';
    if (t.includes('KITCHEN') || t === 'NEW_ORDER' || t === 'ORDER_CREATED' || t === 'ORDER_READY') {
        if (m.tableId) return `/(app)/orders/pos/${m.tableId}`;
        return '/(app)/kitchen';
    }
    if (t.includes('ORDER')) return '/(app)/orders';
    if (t.includes('HOUSEKEEPING') || t.includes('CHECKOUT_ROOM')) {
        if (m.roomId) return `/(app)/housekeeping/room/${m.roomId}`;
        return '/(app)/housekeeping';
    }
    if (t.includes('CHECKOUT_REQUEST') || t.includes('BOOKING') || t === 'VIP_ARRIVAL') {
        return '/(app)/manager/bookings';
    }
    if (t.includes('NIGHT_AUDIT') || t.includes('PAYMENT') || t.includes('PAYROLL')) {
        return '/(app)/analytics';
    }
    if (t.includes('INVENTORY') || t.includes('LOW_STOCK') || t.includes('PROCUREMENT')) {
        return '/(app)/procurement';
    }
    if (t.startsWith('LICENSE') || t.startsWith('TRIAL') || t.includes('PAYMENT_DUE')) {
        return '/(app)/more';
    }
    if (m.roomId) return `/(app)/housekeeping/room/${m.roomId}`;
    if (m.orderId && m.tableId) return `/(app)/orders/pos/${m.tableId}`;
    if (m.bookingId) return '/(app)/manager/bookings';
    return '/(app)/notifications';
}

/** Build push notification data payload with route for deep linking. */
export function buildNotificationPushData(
    type?: string,
    metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
    const meta = metadata || {};
    const webRoute = deriveNotificationRoute('web', { type, metadata: meta });
    const mobileRoute = deriveNotificationRoute('mobile', { type, metadata: meta });
    return {
        ...meta,
        type: type || meta.type,
        notifType: type || meta.notifType,
        route: mobileRoute,
        href: webRoute,
        path: webRoute,
    };
}

export interface NotificationRouter {
    push: (href: string) => void;
}

/** Navigate from push/local notification payload. */
export function navigateFromNotificationData(
    platform: NotificationPlatform,
    data: Record<string, unknown> | undefined | null,
    router: NotificationRouter,
): boolean {
    if (!data) return false;

    const type = String(data.notifType || data.type || '');
    const metadata = { ...data };
    delete metadata.notifType;

    const explicitRoute = platform === 'mobile'
        ? (data.route as string | undefined)
        : ((data.href || data.path || data.route) as string | undefined);

    const route = explicitRoute || deriveNotificationRoute(platform, { type, metadata });
    if (!route) return false;

    try {
        router.push(route);
        return true;
    } catch {
        return false;
    }
}
