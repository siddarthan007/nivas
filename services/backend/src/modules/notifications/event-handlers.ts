import { EventBus, type DomainEvent } from '../../shared/event-bus';
import { NotificationsService } from './notifications.service';
import { WSService } from './ws.service';
import { logger } from '../../shared/logger';
import { NOTIFY_ROLES } from './notification-roles';

export function registerNotificationHandlers(): void {
    EventBus.on('OrderPlaced', async (event: DomainEvent) => {
        const { orderId, orderNumber, orderType, itemCount, roomId } = event.payload as Record<string, any>;
        const dedupeKey = `order-placed-${orderId}`;

        // Kitchen-facing notification (Kitchen/Chef prepare the order).
        NotificationsService.send(event.hotelId, 'NEW_ORDER', {
            orderId, orderNumber, roomId, dedupeKey,
            title: `New order ${orderNumber || ''}`.trim(),
            message: `${itemCount || ''} item(s) to prepare${roomId ? ` · Room ${roomId}` : ''}`.trim(),
        }, { roles: NOTIFY_ROLES.KITCHEN as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send NEW_ORDER notification'));

        // Front-desk facing notification.
        NotificationsService.send(event.hotelId, 'ORDER_CREATED', {
            orderId, orderNumber, dedupeKey,
            title: `Order ${orderNumber || ''} created`.trim(),
            message: orderType ? `${orderType} order received` : 'New order received',
        }, { roles: NOTIFY_ROLES.FRONT_DESK as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send ORDER_CREATED notification'));

        // Transient live event for KDS / dashboards (not a bell notification).
        WSService.broadcastToHotel(event.hotelId, 'KITCHEN_NEW_ORDER', {
            orderId, orderNumber, orderType, status: 'PENDING', itemCount,
        }, { staffOnly: true });

        if (roomId) {
            WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_ORDER_UPDATE', {
                orderId, orderNumber, status: 'PENDING',
            });
        }
    });

    EventBus.on('OrderStatusChanged', async (event: DomainEvent) => {
        const { orderId, orderNumber, status, roomId } = event.payload as Record<string, any>;

        if (status === 'READY') {
            // KDS live update only — no bell / push for "order ready" (too noisy).
        }

        WSService.broadcastToHotel(event.hotelId, 'KITCHEN_ORDER_STATUS', {
            orderId, orderNumber, status,
        }, { staffOnly: true });

        if (roomId) {
            WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_ORDER_UPDATE', {
                orderId, orderNumber, status,
            });
            if (status === 'SERVED') {
                WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_BILL_UPDATE', { reason: 'order_served' });
            }
        }
    });

    EventBus.on('HousekeepingTaskCreated', async (event: DomainEvent) => {
        const { taskId, roomId, taskType, priority } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'HOUSEKEEPING_ALERT', {
            taskId, roomNumber: roomId, roomId, type: taskType, priority,
            dedupeKey: `hk-task-${taskId}`,
            title: `Housekeeping: Room ${roomId}`,
            message: `Room ${roomId} requests ${taskType}`,
        }, { roles: [...NOTIFY_ROLES.HOUSEKEEPING, ...NOTIFY_ROLES.MANAGEMENT] as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send HOUSEKEEPING_ALERT notification'));
    });

    EventBus.on('NightAuditCompleted', async (event: DomainEvent) => {
        const { auditDate, roomRevenue, fnbRevenue, occupancy, bookingsProcessed } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Manager', 'Owner'], 'NIGHT_AUDIT_COMPLETED', {
            date: auditDate, roomRevenue, fnbRevenue, occupancy, bookingsProcessed,
            dedupeKey: `night-audit-${auditDate}`,
            title: 'Night audit completed',
            message: `Audit for ${auditDate} processed${typeof bookingsProcessed === 'number' ? ` · ${bookingsProcessed} bookings` : ''}`,
        }).catch(err => logger.error({ err }, 'Failed to send NIGHT_AUDIT_COMPLETED notification'));
    });

    EventBus.on('BookingConfirmed', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        // Front-desk bell notification.
        NotificationsService.send(event.hotelId, 'BOOKING_CONFIRMED', {
            bookingId, guestName, roomId,
            dedupeKey: `booking-confirmed-${bookingId}`,
            title: 'New booking confirmed',
            message: `Booking confirmed for ${guestName}${roomId ? ` · Room ${roomId}` : ''}`,
        }, { roles: NOTIFY_ROLES.FRONT_DESK as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send BOOKING_CONFIRMED notification'));

        // Transient live event for dashboards / room board.
        WSService.broadcastToHotel(event.hotelId, 'BOOKING_CONFIRMED', {
            bookingId, guestName, roomId,
        }, { staffOnly: true });
    });

    EventBus.on('BookingCheckedIn', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'VIP_ARRIVAL', {
            bookingId, guestName, roomId,
            dedupeKey: `checkin-${bookingId}`,
            title: `Guest checked in — Room ${roomId}`,
            message: `${guestName} has checked in to Room ${roomId}`,
        }, { roles: [...NOTIFY_ROLES.FRONT_DESK, ...NOTIFY_ROLES.HOUSEKEEPING, ...NOTIFY_ROLES.MANAGEMENT] as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send CHECK_IN notification'));

        WSService.broadcastToHotel(event.hotelId, 'BOOKING_CHECKED_IN', {
            bookingId, guestName, roomId,
        }, { staffOnly: true });
    });

    EventBus.on('BookingCheckedOut', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        if (roomId) {
            WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_STAY_ENDED', {
                bookingId, guestName,
            });
        }

        WSService.broadcastToRole(event.hotelId, [...NOTIFY_ROLES.HOUSEKEEPING] as unknown as string[], 'CHECKOUT_ROOM_READY', {
            bookingId, guestName, roomId,
            dedupeKey: `checkout-clean-${bookingId}`,
            title: `Room ${roomId} ready to clean`,
            message: `Room ${roomId} is ready for cleaning after checkout`,
        }).catch(err => logger.error({ err }, 'Failed to send CHECKOUT_ROOM_READY notification'));
    });

    EventBus.on('GuestDndToggled', async (event: DomainEvent) => {
        const { roomId, enabled } = event.payload as Record<string, any>;

        // Transient live event only (frequent toggle, not a bell notification).
        WSService.broadcastToHotel(event.hotelId, 'DND_UPDATE', {
            roomId, status: enabled ? 'ON' : 'OFF',
        }, { staffOnly: true });
    });

    EventBus.on('GuestCheckoutRequested', async (event: DomainEvent) => {
        const { roomId, guestName, bookingId } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, NOTIFY_ROLES.FRONT_DESK as unknown as string[], 'CHECKOUT_REQUEST', {
            roomId, guestName, bookingId,
            dedupeKey: `checkout-request-${bookingId || roomId}`,
            title: `Checkout requested · Room ${roomId}`,
            message: `${guestName || 'Guest'} in Room ${roomId} requested checkout`,
        }).catch(err => logger.error({ err }, 'Failed to send CHECKOUT_REQUEST notification'));
    });

    EventBus.on('HousekeepingTaskCompleted', async (event: DomainEvent) => {
        const { taskId, roomId } = event.payload as Record<string, any>;
        WSService.broadcastToHotel(event.hotelId, 'HOUSEKEEPING_TASK_COMPLETED', {
            taskId, roomId,
        }, { staffOnly: true });
        if (roomId) {
            WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_SERVICE_UPDATE', {
                taskId, status: 'COMPLETED',
            });
        }
    });

    EventBus.on('GuestHousekeepingRequested', async (event: DomainEvent) => {
        const { taskId, roomId, taskType, notes } = event.payload as Record<string, any>;

        if (roomId) {
            WSService.broadcastToGuestRoom(event.hotelId, Number(roomId), 'GUEST_SERVICE_UPDATE', {
                taskId, taskType, status: 'PENDING', notes,
            });
        }

        NotificationsService.send(event.hotelId, 'HOUSEKEEPING_REQUEST', {
            taskId, roomId, taskType, notes,
            dedupeKey: `hk-request-${taskId || roomId}`,
            title: `Service request · Room ${roomId}`,
            message: `Room ${roomId} requests ${taskType} service`,
        }, { roles: [...NOTIFY_ROLES.HOUSEKEEPING, ...NOTIFY_ROLES.FRONT_DESK] as unknown as string[] }).catch(err =>
            logger.error({ err }, 'Failed to send HOUSEKEEPING_REQUEST notification'));
    });

    logger.info('Notification event handlers registered');
}
