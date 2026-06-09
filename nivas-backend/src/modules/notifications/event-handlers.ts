import { EventBus, type DomainEvent } from '../../shared/event-bus';
import { NotificationsService } from './notifications.service';
import { WSService } from './ws.service';
import { logger } from '../../shared/logger';

export function registerNotificationHandlers(): void {
    EventBus.on('OrderPlaced', async (event: DomainEvent) => {
        const { orderId, orderNumber, orderType, itemCount, roomId } = event.payload as Record<string, any>;
        const dedupeKey = `order-placed-${orderId}`;

        // Kitchen-facing notification (Kitchen/Chef prepare the order).
        NotificationsService.send(event.hotelId, 'NEW_ORDER', {
            orderId, orderNumber, roomId, dedupeKey,
            title: `New order ${orderNumber || ''}`.trim(),
            message: `${itemCount || ''} item(s) to prepare${roomId ? ` · Room ${roomId}` : ''}`.trim(),
        }, { roles: ['Kitchen', 'Chef'] }).catch(err =>
            logger.error({ err }, 'Failed to send NEW_ORDER notification'));

        // Front-desk facing notification.
        NotificationsService.send(event.hotelId, 'ORDER_CREATED', {
            orderId, orderNumber, dedupeKey,
            title: `Order ${orderNumber || ''} created`.trim(),
            message: orderType ? `${orderType} order received` : 'New order received',
        }, { roles: ['Receptionist'] }).catch(err =>
            logger.error({ err }, 'Failed to send ORDER_CREATED notification'));

        // Transient live event for KDS / dashboards (not a bell notification).
        WSService.broadcastToHotel(event.hotelId, 'KITCHEN_NEW_ORDER', {
            orderId, orderNumber, orderType, status: 'PENDING', itemCount,
        });
    });

    EventBus.on('OrderStatusChanged', async (event: DomainEvent) => {
        const { orderId, orderNumber, status } = event.payload as Record<string, any>;

        if (status === 'READY') {
            NotificationsService.send(event.hotelId, 'ORDER_READY', {
                orderId, orderNumber,
                dedupeKey: `order-ready-${orderId}`,
                title: `Order ${orderNumber || ''} ready`.trim(),
                message: `Order ${orderNumber} is ready to serve!`,
            }, { roles: ['Waiter', 'Receptionist'] }).catch(err =>
                logger.error({ err }, 'Failed to send ORDER_READY notification'));
        }

        WSService.broadcastToHotel(event.hotelId, 'KITCHEN_ORDER_STATUS', {
            orderId, orderNumber, status,
        });
    });

    EventBus.on('HousekeepingTaskCreated', async (event: DomainEvent) => {
        const { taskId, roomId, taskType, priority } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'HOUSEKEEPING_ALERT', {
            taskId, roomNumber: roomId, roomId, type: taskType, priority,
            dedupeKey: `hk-task-${taskId}`,
            title: `Housekeeping: Room ${roomId}`,
            message: `Room ${roomId} requests ${taskType}`,
        }, { roles: ['House Keeping', 'Manager'] }).catch(err =>
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
        }, { roles: ['Receptionist', 'Front Desk'] }).catch(err =>
            logger.error({ err }, 'Failed to send BOOKING_CONFIRMED notification'));

        // Transient live event for dashboards / room board.
        WSService.broadcastToHotel(event.hotelId, 'BOOKING_CONFIRMED', {
            bookingId, guestName, roomId,
        });
    });

    EventBus.on('BookingCheckedOut', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Housekeeping Supervisor', 'Housekeeper', 'House Keeping'], 'CHECKOUT_ROOM_READY', {
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
        });
    });

    EventBus.on('GuestCheckoutRequested', async (event: DomainEvent) => {
        const { roomId, guestName, bookingId } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Receptionist', 'Front Desk'], 'CHECKOUT_REQUEST', {
            roomId, guestName, bookingId,
            dedupeKey: `checkout-request-${bookingId || roomId}`,
            title: `Checkout requested · Room ${roomId}`,
            message: `${guestName || 'Guest'} in Room ${roomId} requested checkout`,
        }).catch(err => logger.error({ err }, 'Failed to send CHECKOUT_REQUEST notification'));
    });

    EventBus.on('GuestHousekeepingRequested', async (event: DomainEvent) => {
        const { taskId, roomId, taskType, notes } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'HOUSEKEEPING_REQUEST', {
            taskId, roomId, taskType, notes,
            dedupeKey: `hk-request-${taskId || roomId}`,
            title: `Service request · Room ${roomId}`,
            message: `Room ${roomId} requests ${taskType} service`,
        }, { roles: ['House Keeping', 'Receptionist'] }).catch(err =>
            logger.error({ err }, 'Failed to send HOUSEKEEPING_REQUEST notification'));
    });

    logger.info('Notification event handlers registered');
}
