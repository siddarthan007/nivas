import { db } from '../../db';
import { bookings, rooms, hotels, channelManagerSettings, channelSyncLogs, tenantFeatures, users, guests } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { BusinessLogicError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { JobService } from '../system/job.service';
import { RevenueService } from '../revenue/revenue.service';
import { logger } from '../../shared/logger';
import { getPaginationResult } from '../../utils/response.helper';

export class BookingsService {
    static async createBooking(hotelId: number, userId: string, data: any, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            // Check availability
            const conflictingBookings = await tx.query.bookings.findMany({
                where: and(
                    eq(bookings.roomId, data.roomId),
                    eq(bookings.hotelId, hotelId),
                )
            });

            const isConflicting = conflictingBookings.some(b =>
                b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'
            );

            if (isConflicting) {
                throw new ConflictError('Room not available for selected dates');
            }

            // Verify room belongs to this hotel
            const room = await tx.query.rooms.findFirst({
                where: and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId))
            });
            if (!room) throw new NotFoundError('Room');

            // Apply dynamic pricing if no explicit totalAmount provided
            let finalAmount = data.totalAmount;
            if (!finalAmount || finalAmount <= 0) {
                if (room) {
                    const basePrice = parseFloat(room.rate || '0');
                    try {
                        const pricing = await RevenueService.calculateDynamicPrice(
                            hotelId,
                            basePrice,
                            data.checkIn,
                            room.type || 'STANDARD'
                        );
                        const nights = Math.max(1, Math.ceil(
                            (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / (1000 * 60 * 60 * 24)
                        ));
                        finalAmount = pricing.adjustedPrice * nights;
                    } catch {
                        const nights = Math.max(1, Math.ceil(
                            (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / (1000 * 60 * 60 * 24)
                        ));
                        finalAmount = basePrice * nights;
                    }
                }
            }

            // Handle Guest Profile (Find or Create)
            let guestId = data.guestId;

            if (!guestId && data.guestPhone) {
                const existingGuest = await tx.query.guests.findFirst({
                    where: and(
                        eq(guests.hotelId, hotelId),
                        eq(guests.phone, data.guestPhone)
                    )
                });

                if (existingGuest) {
                    guestId = existingGuest.id;
                    const updateFields: Record<string, any> = {};
                    if (data.nationality) updateFields.nationality = data.nationality;
                    if (data.idNumber && !existingGuest.idNumber) {
                        updateFields.idNumber = data.idNumber;
                        updateFields.idType = data.idType;
                    }
                    if (Object.keys(updateFields).length > 0) {
                        updateFields.updatedAt = new Date();
                        await tx.update(guests)
                            .set(updateFields)
                            .where(eq(guests.id, guestId));
                    }
                } else {
                    const [newGuest] = await tx.insert(guests).values({
                        hotelId,
                        fullName: data.guestName,
                        phone: data.guestPhone,
                        email: data.guestEmail,
                        nationality: data.nationality,
                        idNumber: data.idNumber,
                        idType: data.idType,
                    }).returning();
                    if (!newGuest) throw new Error('Failed to create guest profile');
                    guestId = newGuest.id;
                }
            } else if (guestId && data.nationality) {
                await tx.update(guests)
                    .set({ nationality: data.nationality, updatedAt: new Date() })
                    .where(eq(guests.id, guestId));
            }

            // Create Booking
            const [newBooking] = await tx.insert(bookings).values({
                hotelId,
                roomId: data.roomId,
                guestId: guestId,
                guestName: data.guestName,
                guestPhone: data.guestPhone,
                guestEmail: data.guestEmail,
                guestCount: data.guestCount,
                checkIn: new Date(data.checkIn),
                checkOut: new Date(data.checkOut),
                totalAmount: (finalAmount || data.totalAmount || 0).toString(),
                advancePayment: data.advancePayment?.toString() || '0',
                source: data.source || 'WALK_IN',
                status: 'CONFIRMED',
                createdById: userId,
                corporateAccountId: data.corporateAccountId,
                travelAgentId: data.travelAgentId,
            }).returning();

            // Side Effects
            await this.handleBookingSideEffects(hotelId, userId, newBooking, data.roomId, ipAddress);

            return newBooking;
        });
    }

    static async getBookings(hotelId: number, page: number = 1, limit: number = 20) {
        const offset = (page - 1) * limit;

        const [bookingsList, countResult] = await Promise.all([
            db.query.bookings.findMany({
                where: eq(bookings.hotelId, hotelId),
                with: {
                    room: true,
                    createdBy: {
                        columns: {
                            fullName: true,
                            email: true
                        }
                    }
                },
                orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
                limit,
                offset
            }),
            db.select({ count: sql<number>`count(*)` })
                .from(bookings)
                .where(eq(bookings.hotelId, hotelId))
        ]);

        const total = Number(countResult[0]?.count || 0);
        return getPaginationResult(bookingsList, total, page, limit);
    }

    static async checkIn(hotelId: number, userId: string, bookingId: string, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const [updatedBooking] = await tx.update(bookings)
                .set({
                    status: 'CHECKED_IN',
                    updatedAt: new Date()
                })
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            if (!updatedBooking) throw new NotFoundError('Booking');

            const guestPin = updatedBooking.guestPhone.slice(-4);

            await tx.update(rooms)
                .set({
                    status: 'OCCUPIED',
                    currentGuestPin: guestPin,
                    updatedAt: new Date()
                })
                .where(eq(rooms.id, updatedBooking.roomId));

            // Log Action
            await logAction(
                hotelId,
                userId,
                'CHECK_IN',
                'BOOKING',
                bookingId,
                { guestName: updatedBooking.guestName, roomId: updatedBooking.roomId },
                ipAddress
            );

            return { updatedBooking, guestPin };
        });
    }

    static async checkOut(hotelId: number, userId: string, bookingId: string, ipAddress?: string) {
        const result = await db.transaction(async (tx) => {
            const [updatedBooking] = await tx.update(bookings)
                .set({
                    status: 'CHECKED_OUT',
                    updatedAt: new Date()
                })
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            if (!updatedBooking) throw new NotFoundError('Booking');

            await tx.update(rooms)
                .set({
                    status: 'CLEANING',
                    currentGuestPin: null,
                    updatedAt: new Date()
                })
                .where(eq(rooms.id, updatedBooking.roomId));

            return updatedBooking;
        });

        // Side Effects
        await this.handleCheckoutSideEffects(hotelId, userId, result, ipAddress);

        return result;
    }

    static async getBookingById(hotelId: number, bookingId: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.id, bookingId),
                eq(bookings.hotelId, hotelId)
            ),
            with: {
                room: true,
                createdBy: {
                    columns: {
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        if (!booking) throw new NotFoundError('Booking');
        return booking;
    }

    static async findActiveByRoom(hotelId: number, roomId: number) {
        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, roomId),
                eq(bookings.hotelId, hotelId),
                eq(bookings.status, 'CHECKED_IN')
            )
        });
        if (!booking) throw new NotFoundError('Active booking for this room');
        return booking;
    }

    static async updateBooking(hotelId: number, userId: string, bookingId: string, data: any, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                )
            });

            if (!existing) throw new NotFoundError('Booking');

            if (existing.status === 'CHECKED_OUT' || existing.status === 'CANCELLED') {
                throw new BusinessLogicError('Cannot edit a checked-out or cancelled booking');
            }

            const updateData: Record<string, any> = { updatedAt: new Date() };
            if (data.guestName !== undefined) updateData.guestName = data.guestName;
            if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone;
            if (data.guestEmail !== undefined) updateData.guestEmail = data.guestEmail;
            if (data.guestCount !== undefined) updateData.guestCount = data.guestCount;
            if (data.checkIn !== undefined) updateData.checkIn = new Date(data.checkIn);
            if (data.checkOut !== undefined) updateData.checkOut = new Date(data.checkOut);
            if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount.toString();
            if (data.advancePayment !== undefined) updateData.advancePayment = data.advancePayment.toString();
            if (data.source !== undefined) updateData.source = data.source;

            if (data.roomId !== undefined && data.roomId !== existing.roomId) {
                const conflicting = await tx.query.bookings.findMany({
                    where: and(
                        eq(bookings.roomId, data.roomId),
                        eq(bookings.hotelId, hotelId),
                    )
                });
                const isConflicting = conflicting.some(b =>
                    b.id !== bookingId && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')
                );
                if (isConflicting) {
                    throw new ConflictError('Target room is not available');
                }
                updateData.roomId = data.roomId;
            }

            const [updated] = await tx.update(bookings)
                .set(updateData)
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            await logAction(hotelId, userId, 'UPDATE_BOOKING', 'BOOKING', bookingId, {
                before: existing,
                after: updated
            }, ipAddress);

            return updated;
        });
    }

    static async cancelBooking(hotelId: number, userId: string, bookingId: string, reason?: string, cancellationFee?: number, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                )
            });

            if (!existing) throw new NotFoundError('Booking');

            if (existing.status === 'CHECKED_OUT' || existing.status === 'CANCELLED') {
                throw new BusinessLogicError('Booking is already checked out or cancelled');
            }

            const [cancelled] = await tx.update(bookings)
                .set({
                    status: 'CANCELLED',
                    updatedAt: new Date()
                })
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            if (existing.status === 'CHECKED_IN') {
                await tx.update(rooms)
                    .set({
                        status: 'CLEANING',
                        currentGuestPin: null,
                        updatedAt: new Date()
                    })
                    .where(eq(rooms.id, existing.roomId));
            }

            await logAction(hotelId, userId, 'CANCEL_BOOKING', 'BOOKING', bookingId, {
                guestName: existing.guestName,
                reason: reason || 'No reason provided',
                cancellationFee: cancellationFee || 0
            }, ipAddress);

            return cancelled;
        });
    }

    static async extendStay(hotelId: number, userId: string, bookingId: string, newCheckOut: string, newTotalAmount?: number, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                )
            });

            if (!existing) throw new NotFoundError('Booking');

            if (existing.status !== 'CHECKED_IN' && existing.status !== 'CONFIRMED') {
                throw new BusinessLogicError('Can only extend active or confirmed bookings');
            }

            const newDate = new Date(newCheckOut);
            if (newDate <= existing.checkOut) {
                throw new ValidationError('New check-out date must be after current check-out date');
            }

            const updateData: Record<string, any> = {
                checkOut: newDate,
                updatedAt: new Date()
            };
            if (newTotalAmount !== undefined) {
                updateData.totalAmount = newTotalAmount.toString();
            }

            const [updated] = await tx.update(bookings)
                .set(updateData)
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            await logAction(hotelId, userId, 'EXTEND_STAY', 'BOOKING', bookingId, {
                guestName: existing.guestName,
                previousCheckOut: existing.checkOut,
                newCheckOut: newDate
            }, ipAddress);

            return updated;
        });
    }

    static async changeRoom(hotelId: number, userId: string, bookingId: string, newRoomId: number, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                )
            });

            if (!existing) throw new NotFoundError('Booking');

            if (existing.status !== 'CHECKED_IN' && existing.status !== 'CONFIRMED') {
                throw new BusinessLogicError('Can only change room for active or confirmed bookings');
            }

            const conflicting = await tx.query.bookings.findMany({
                where: and(
                    eq(bookings.roomId, newRoomId),
                    eq(bookings.hotelId, hotelId),
                )
            });
            const isConflicting = conflicting.some(b =>
                b.id !== bookingId && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN')
            );
            if (isConflicting) {
                throw new ConflictError('Target room is not available');
            }

            const newRoom = await tx.query.rooms.findFirst({
                where: and(eq(rooms.id, newRoomId), eq(rooms.hotelId, hotelId))
            });
            if (!newRoom) throw new NotFoundError('Room');

            const [updated] = await tx.update(bookings)
                .set({
                    roomId: newRoomId,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(bookings.id, bookingId),
                    eq(bookings.hotelId, hotelId)
                ))
                .returning();

            if (existing.status === 'CHECKED_IN') {
                await tx.update(rooms)
                    .set({ status: 'CLEANING', currentGuestPin: null, updatedAt: new Date() })
                    .where(eq(rooms.id, existing.roomId));

                const guestPin = existing.guestPhone.slice(-4);
                await tx.update(rooms)
                    .set({ status: 'OCCUPIED', currentGuestPin: guestPin, updatedAt: new Date() })
                    .where(eq(rooms.id, newRoomId));
            }

            await logAction(hotelId, userId, 'CHANGE_ROOM', 'BOOKING', bookingId, {
                guestName: existing.guestName,
                previousRoomId: existing.roomId,
                newRoomId
            }, ipAddress);

            return updated;
        });
    }

    // --- Private / Helper Methods ---

    private static async handleBookingSideEffects(hotelId: number, userId: string, booking: any, roomId: number, ipAddress?: string) {
        try {
            const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId) });
            const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomId) });

            // Audit Log
            await logAction(
                hotelId,
                userId,
                'CREATE_BOOKING',
                'BOOKING',
                booking.id,
                { guestName: booking.guestName, roomId, totalAmount: booking.totalAmount },
                ipAddress
            );

            // Notification
            NotificationChannelService.sendBookingConfirmation(
                hotelId,
                booking.guestPhone,
                booking.guestEmail,
                {
                    hotelName: hotel?.name || 'Hotel',
                    checkIn: booking.checkIn,
                    roomNumber: room?.number?.toString() || '',
                    bookingId: booking.id
                }
            ).catch(err => logger.error({ err }, '[Booking] Notification failed'));

            // Channel Sync
            this.syncBookingToChannels(hotelId, booking, room)
                .catch(err => logger.error({ err }, '[Booking] Channel sync failed'));

        } catch (error) {
            logger.error({ error }, 'Error processing booking side effects');
        }
    }

    private static async handleCheckoutSideEffects(hotelId: number, userId: string, booking: any, ipAddress?: string) {
        try {
            const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId) });

            await logAction(
                hotelId,
                userId,
                'CHECK_OUT',
                'BOOKING',
                booking.id,
                { guestName: booking.guestName, roomId: booking.roomId },
                ipAddress
            );

            // Review Request (Delayed)
            JobService.enqueue(
                hotelId,
                'SEND_REVIEW_REQUEST',
                {
                    guestName: booking.guestName,
                    guestPhone: booking.guestPhone,
                    guestEmail: booking.guestEmail,
                    hotelId
                },
                120 // 2 hours
            ).catch(err => logger.error({ err }, '[Job] Failed to enqueue review request'));

            // Checkout Notification
            NotificationChannelService.sendCheckoutNotification(
                hotelId,
                booking.guestPhone,
                booking.guestEmail || undefined,
                {
                    hotelName: hotel?.name || 'Hotel',
                    invoiceNumber: 'GENERATED_AT_BILLING',
                    bookingId: booking.id
                }
            ).catch(err => logger.error({ err }, '[Notification] Checkout msg failed'));

        } catch (error) {
            logger.error({ error }, 'Error processing checkout side effects');
        }
    }

    private static async syncBookingToChannels(hotelId: number, booking: any, room: any) {
        try {
            const features = await db.query.tenantFeatures.findFirst({
                where: eq(tenantFeatures.hotelId, hotelId)
            });

            if (!features?.enableChannelManager) return;

            const channels = await db.query.channelManagerSettings.findMany({
                where: and(
                    eq(channelManagerSettings.hotelId, hotelId),
                    eq(channelManagerSettings.isActive, true),
                    eq(channelManagerSettings.syncAvailability, true)
                )
            });

            for (const channel of channels) {
                await db.insert(channelSyncLogs).values({
                    hotelId,
                    channelSettingId: channel.id,
                    syncType: 'AVAILABILITY_PUSH',
                    direction: 'OUTBOUND',
                    status: 'SUCCESS',
                    recordsProcessed: 1,
                    requestPayload: {
                        bookingId: booking.id,
                        roomType: room?.type,
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        action: 'BLOCK'
                    }
                });

                await db.update(channelManagerSettings)
                    .set({ lastSyncAt: new Date() })
                    .where(eq(channelManagerSettings.id, channel.id));
            }
        } catch (err) {
            logger.error({ err }, '[Channel Manager] Sync failed');
        }
    }
}
