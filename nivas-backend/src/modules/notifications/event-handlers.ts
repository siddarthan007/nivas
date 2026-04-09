import { EventBus, type DomainEvent } from '../../shared/event-bus';
import { NotificationsService } from './notifications.service';
import { WSService } from './ws.service';
import { logger } from '../../shared/logger';

export function registerNotificationHandlers(): void {
    EventBus.on('OrderPlaced', async (event: DomainEvent) => {
        const { orderId, orderNumber, orderType, itemCount, roomId } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'NEW_ORDER', {
            orderId, orderNumber, roomId,
        }, { roles: ['Kitchen', 'Chef'] }).catch(err =>
            logger.error({ err }, 'Failed to send NEW_ORDER notification'));

        NotificationsService.send(event.hotelId, 'ORDER_CREATED', {
            orderNumber,
        }, { roles: ['Receptionist'] }).catch(err =>
            logger.error({ err }, 'Failed to send ORDER_CREATED notification'));

        WSService.broadcastToHotel(event.hotelId, 'KITCHEN_NEW_ORDER', {
            orderId, orderNumber, orderType, status: 'PENDING', itemCount,
        });
    });

    EventBus.on('OrderStatusChanged', async (event: DomainEvent) => {
        const { orderId, orderNumber, status } = event.payload as Record<string, any>;

        if (status === 'READY') {
            NotificationsService.send(event.hotelId, 'ORDER_READY', {
                orderId, orderNumber,
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
            taskId, roomNumber: roomId, type: taskType, priority,
            message: `Room ${roomId} requests ${taskType}`,
        }, { roles: ['House Keeping', 'Manager'] }).catch(err =>
            logger.error({ err }, 'Failed to send HOUSEKEEPING_ALERT notification'));
    });

    EventBus.on('NightAuditCompleted', async (event: DomainEvent) => {
        const { auditDate, roomRevenue, fnbRevenue, occupancy, bookingsProcessed } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Manager', 'Owner'], 'NIGHT_AUDIT_COMPLETED', {
            date: auditDate, roomRevenue, fnbRevenue, occupancy, bookingsProcessed,
        });
    });

    EventBus.on('BookingConfirmed', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        WSService.broadcastToHotel(event.hotelId, 'BOOKING_CONFIRMED', {
            bookingId, guestName, roomId,
            message: `New booking confirmed for ${guestName}`,
        });
    });

    EventBus.on('BookingCheckedOut', async (event: DomainEvent) => {
        const { bookingId, guestName, roomId } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Housekeeping Supervisor', 'Housekeeper'], 'CHECKOUT_ROOM_READY', {
            bookingId, guestName, roomId,
            message: `Room ${roomId} is ready for cleaning after checkout`,
        });
    });

    EventBus.on('GuestDndToggled', async (event: DomainEvent) => {
        const { roomId, enabled } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Receptionist', 'House Keeping'], 'DND_UPDATE', {
            roomId, status: enabled ? 'ON' : 'OFF',
        });
    });

    EventBus.on('GuestCheckoutRequested', async (event: DomainEvent) => {
        const { roomId, guestName, bookingId } = event.payload as Record<string, any>;

        WSService.broadcastToRole(event.hotelId, ['Receptionist'], 'CHECKOUT_REQUEST', {
            roomId, guestName, bookingId,
        });
    });

    EventBus.on('GuestHousekeepingRequested', async (event: DomainEvent) => {
        const { taskId, roomId, taskType, notes } = event.payload as Record<string, any>;

        NotificationsService.send(event.hotelId, 'HOUSEKEEPING_REQUEST', {
            taskId, roomId, taskType, notes,
            message: `Room ${roomId} requests ${taskType} service`,
        }, { roles: ['House Keeping', 'Receptionist'] }).catch(err =>
            logger.error({ err }, 'Failed to send HOUSEKEEPING_REQUEST notification'));
    });

    logger.info('Notification event handlers registered');
}
