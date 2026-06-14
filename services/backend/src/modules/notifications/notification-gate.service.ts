import { db } from '../../db';
import { hotels, tenantFeatures } from '../../db/schema';
import { eq } from 'drizzle-orm';

/** In-app / Expo push toggles stored in hotels.notificationConfig.events */
export type InAppEventKey = 'newBooking' | 'checkout' | 'newOrder' | 'lowStock' | 'housekeeping';

const NOTIFICATION_TYPE_TO_EVENT: Record<string, InAppEventKey> = {
    NEW_ORDER: 'newOrder',
    ORDER_CREATED: 'newOrder',
    BOOKING_CONFIRMED: 'newBooking',
    VIP_ARRIVAL: 'newBooking',
    HOUSEKEEPING_ALERT: 'housekeeping',
    HOUSEKEEPING_REQUEST: 'housekeeping',
    CHECKOUT_ROOM_READY: 'checkout',
    CHECKOUT_REQUEST: 'checkout',
    LOW_STOCK: 'lowStock',
};

/**
 * Returns false when the hotel has disabled this in-app notification type,
 * or when the property module that owns the event is turned off.
 */
export async function isInAppNotificationEnabled(hotelId: number, notificationType: string): Promise<boolean> {
    const eventKey = NOTIFICATION_TYPE_TO_EVENT[notificationType];
    if (!eventKey) return true;

    const [hotel, features] = await Promise.all([
        db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId),
            columns: { notificationConfig: true },
        }),
        db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId),
        }),
    ]);

    const events = ((hotel?.notificationConfig || {}) as Record<string, any>).events || {};
    if (events[eventKey] === false) return false;

    switch (eventKey) {
        case 'newOrder':
            return features?.enableFoodAndBeverage !== false;
        case 'newBooking':
        case 'checkout':
            return features?.enableHotel !== false;
        case 'housekeeping':
            return features?.enableHousekeeping !== false;
        case 'lowStock':
            return features?.enableInventory !== false;
        default:
            return true;
    }
}
