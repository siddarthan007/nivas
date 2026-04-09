import { EventBus, type DomainEvent } from '../../shared/event-bus';
import { AuditService } from './audit.service';
import { logger } from '../../shared/logger';

const EVENT_AUDIT_MAP: Record<string, { action: string; entity: string }> = {
    BookingConfirmed: { action: 'BOOKING_CONFIRMED', entity: 'BOOKING' },
    BookingCheckedOut: { action: 'BOOKING_CHECKED_OUT', entity: 'BOOKING' },
    OrderPlaced: { action: 'ORDER_PLACED', entity: 'ORDER' },
    OrderStatusChanged: { action: 'ORDER_STATUS_CHANGED', entity: 'ORDER' },
    NightAuditCompleted: { action: 'NIGHT_AUDIT_COMPLETED', entity: 'NIGHT_AUDIT' },
    HousekeepingTaskCreated: { action: 'HOUSEKEEPING_TASK_CREATED', entity: 'HOUSEKEEPING_TASK' },
    GuestDndToggled: { action: 'GUEST_DND_TOGGLED', entity: 'ROOM' },
    GuestCheckoutRequested: { action: 'GUEST_CHECKOUT_REQUESTED', entity: 'BOOKING' },
    GuestHousekeepingRequested: { action: 'GUEST_HOUSEKEEPING_REQUESTED', entity: 'HOUSEKEEPING_TASK' },
};

function getEntityId(event: DomainEvent): string | undefined {
    const p = event.payload as Record<string, any>;
    return p.bookingId?.toString()
        ?? p.orderId?.toString()
        ?? p.taskId?.toString()
        ?? p.roomId?.toString()
        ?? undefined;
}

export function registerAuditEventHandlers(): void {
    for (const [eventType, mapping] of Object.entries(EVENT_AUDIT_MAP)) {
        EventBus.on(eventType, async (event: DomainEvent) => {
            try {
                await AuditService.log(
                    event.hotelId,
                    null,
                    mapping.action,
                    mapping.entity,
                    getEntityId(event),
                    { ...event.payload, source: event.source, eventType: event.type }
                );
            } catch (err) {
                logger.error({ err, eventType }, 'Failed to write audit log for domain event');
            }
        });
    }

    logger.info('Audit event handlers registered');
}
