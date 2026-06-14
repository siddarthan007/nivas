import { logger } from './logger';

export interface DomainEvent {
    type: string;
    hotelId: number;
    payload: Record<string, unknown>;
    timestamp: Date;
    source: string;
}

export interface BookingConfirmedEvent extends DomainEvent {
    type: 'BookingConfirmed';
    payload: {
        bookingId: string;
        guestName: string;
        roomId: number;
        checkIn: Date;
        checkOut: Date;
        totalAmount: string;
    };
}

export interface BookingCheckedInEvent extends DomainEvent {
    type: 'BookingCheckedIn';
    payload: {
        bookingId: string;
        guestName: string;
        roomId: number;
    };
}

export interface BookingCheckedOutEvent extends DomainEvent {
    type: 'BookingCheckedOut';
    payload: {
        bookingId: string;
        guestName: string;
        roomId: number;
    };
}

export interface OrderPlacedEvent extends DomainEvent {
    type: 'OrderPlaced';
    payload: {
        orderId: string;
        orderNumber: string;
        orderType: string;
        totalAmount: string;
        itemCount: number;
        roomId?: number;
    };
}

export interface OrderStatusChangedEvent extends DomainEvent {
    type: 'OrderStatusChanged';
    payload: {
        orderId: string;
        orderNumber: string;
        status: string;
    };
}

export interface NightAuditCompletedEvent extends DomainEvent {
    type: 'NightAuditCompleted';
    payload: {
        auditDate: string;
        roomRevenue: number;
        fnbRevenue: number;
        occupancy: number;
        bookingsProcessed: number;
    };
}

export interface HousekeepingTaskCreatedEvent extends DomainEvent {
    type: 'HousekeepingTaskCreated';
    payload: {
        taskId: string;
        roomId: number;
        taskType: string;
        priority: string;
    };
}

export interface GuestDndToggledEvent extends DomainEvent {
    type: 'GuestDndToggled';
    payload: {
        roomId: number;
        enabled: boolean;
    };
}

export interface GuestCheckoutRequestedEvent extends DomainEvent {
    type: 'GuestCheckoutRequested';
    payload: {
        roomId: number;
        guestName: string;
        bookingId: string;
    };
}

export interface GuestHousekeepingRequestedEvent extends DomainEvent {
    type: 'GuestHousekeepingRequested';
    payload: {
        taskId: string;
        roomId: number;
        taskType: string;
        notes?: string;
    };
}

export type TypedDomainEvent =
    | BookingConfirmedEvent
    | BookingCheckedInEvent
    | BookingCheckedOutEvent
    | OrderPlacedEvent
    | OrderStatusChangedEvent
    | NightAuditCompletedEvent
    | HousekeepingTaskCreatedEvent
    | GuestDndToggledEvent
    | GuestCheckoutRequestedEvent
    | GuestHousekeepingRequestedEvent;

type EventHandler = (event: DomainEvent) => void | Promise<void>;

class EventBusImpl {
    private handlers = new Map<string, Set<EventHandler>>();

    on(eventType: string, handler: EventHandler): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType)!.add(handler);

        return () => {
            this.handlers.get(eventType)?.delete(handler);
        };
    }

    async emit(event: DomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.type);
        if (!handlers || handlers.size === 0) return;

        const promises = [...handlers].map(async (handler) => {
            try {
                await handler(event);
            } catch (err) {
                logger.error({ err, eventType: event.type, hotelId: event.hotelId },
                    `EventBus handler error for ${event.type}`);
            }
        });

        await Promise.allSettled(promises);
    }

    listenerCount(eventType: string): number {
        return this.handlers.get(eventType)?.size ?? 0;
    }

    removeAllListeners(): void {
        this.handlers.clear();
    }
}

export const EventBus = new EventBusImpl();
