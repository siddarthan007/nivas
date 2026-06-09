import { db } from '../../db';
import { bookings, rooms, hotels, channelManagerSettings, channelSyncLogs, tenantFeatures, users, guests, folioCharges } from '../../db/schema';
import { eq, and, or, ilike, desc, asc, gt, lte, lt, ne, inArray, sql, type SQL } from 'drizzle-orm';
import { BusinessLogicError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { JobService } from '../system/job.service';
import { RevenueService } from '../revenue/revenue.service';
import { logger } from '../../shared/logger';
import { GuestService } from '../crm/guest.service';
import { getPaginationResult } from '../../utils/response.helper';

export class BookingsService {
    static async createBooking(hotelId: number, userId: string, data: any, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            // Serialize bookings for this specific room so two concurrent requests
            // can't both pass the overlap check and double-book. Released at commit.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${data.roomId})`);

            // Check availability (date overlap)
            const checkInDate = new Date(data.checkIn);
            const checkOutDate = new Date(data.checkOut);
            if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
                throw new ValidationError('Invalid check-in / check-out date');
            }
            if (checkOutDate <= checkInDate) {
                throw new ValidationError('Check-out must be after check-in');
            }
            const conflictingBookings = await tx.query.bookings.findMany({
                where: and(
                    eq(bookings.roomId, data.roomId),
                    eq(bookings.hotelId, hotelId),
                )
            });

            const isConflicting = conflictingBookings.some(b =>
                (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') &&
                checkInDate < new Date(b.checkOut) &&
                checkOutDate > new Date(b.checkIn)
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
                groupRef: data.groupRef,
                corporateAccountId: data.corporateAccountId,
                travelAgentId: data.travelAgentId,
            }).returning();

            // Side Effects
            await this.handleBookingSideEffects(hotelId, userId, newBooking, data.roomId, ipAddress);

            return newBooking;
        });
    }

    /**
     * Group / block booking — reserve several rooms in one logical reservation
     * (shared groupRef), e.g. a corporate block or a wedding party. Each room is
     * created with its own advisory lock + overlap guard; an unavailable room
     * aborts with the rooms booked so far reported in the error.
     */
    static async createGroupBooking(hotelId: number, userId: string, data: any, ipAddress?: string) {
        const roomIds: number[] = Array.isArray(data.roomIds) ? data.roomIds : [];
        if (roomIds.length === 0) throw new BusinessLogicError('Select at least one room');
        const groupRef = `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const created: any[] = [];
        try {
            for (const roomId of roomIds) {
                const booking = await this.createBooking(hotelId, userId, { ...data, roomId, groupRef }, ipAddress);
                created.push(booking);
            }
        } catch (err) {
            // All-or-nothing: a room failed (taken/invalid) → roll back the rooms
            // already booked in this group so no partial block is left behind.
            for (const b of created) {
                await this.cancelBooking(hotelId, userId, b.id, 'Group booking rolled back', 0, ipAddress).catch(() => { /* best effort */ });
            }
            throw err;
        }
        return { groupRef, count: created.length, bookings: created };
    }

    /**
     * Booking list with PMS lifecycle segmentation. Segments mirror the front-desk
     * workflow so booking and check-in stay distinct concerns:
     *   - arrivals     : CONFIRMED reservations due today or overdue (the check-in queue)
     *   - reservations : CONFIRMED reservations arriving in the future
     *   - inhouse      : guests currently CHECKED_IN
     *   - departures   : in-house guests due to check out today or overstaying
     *   - all (default): every booking
     */
    static async getBookings(
        hotelId: number,
        page: number = 1,
        limit: number = 20,
        segment: string = 'all',
        search: string = ''
    ) {
        const offset = (page - 1) * limit;

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const conditions: SQL[] = [eq(bookings.hotelId, hotelId)];

        // Server-side search across guest name / phone so results aren't limited
        // to the current page (was client-filtering only the fetched page).
        const term = (search || '').trim();
        if (term) {
            const like = `%${term}%`;
            conditions.push(or(ilike(bookings.guestName, like), ilike(bookings.guestPhone, like)) as SQL);
        }
        // Per-segment sort: queues read best in chronological arrival/departure order.
        let orderBy: SQL[] = [desc(bookings.createdAt)];

        switch (segment) {
            case 'arrivals':
                conditions.push(eq(bookings.status, 'CONFIRMED'), lte(bookings.checkIn, endOfToday));
                orderBy = [asc(bookings.checkIn)];
                break;
            case 'reservations':
                conditions.push(eq(bookings.status, 'CONFIRMED'), gt(bookings.checkIn, endOfToday));
                orderBy = [asc(bookings.checkIn)];
                break;
            case 'inhouse':
                conditions.push(eq(bookings.status, 'CHECKED_IN'));
                orderBy = [asc(bookings.checkOut)];
                break;
            case 'departures':
                conditions.push(eq(bookings.status, 'CHECKED_IN'), lte(bookings.checkOut, endOfToday));
                orderBy = [asc(bookings.checkOut)];
                break;
            // 'all' → no extra filter
        }

        const where = and(...conditions);

        const [bookingsList, countResult] = await Promise.all([
            db.query.bookings.findMany({
                where,
                with: {
                    room: true,
                    createdBy: {
                        columns: {
                            fullName: true,
                            email: true
                        }
                    }
                },
                orderBy,
                limit,
                offset
            }),
            db.select({ count: sql<number>`count(*)` })
                .from(bookings)
                .where(where)
        ]);

        const total = Number(countResult[0]?.count || 0);
        return getPaginationResult(bookingsList, total, page, limit);
    }

    static async checkIn(hotelId: number, userId: string, bookingId: string, ipAddress?: string) {
        return await db.transaction(async (tx) => {
            const existing = await tx.query.bookings.findFirst({
                where: and(eq(bookings.id, bookingId), eq(bookings.hotelId, hotelId))
            });
            if (!existing) throw new NotFoundError('Booking');
            if (existing.status !== 'CONFIRMED') {
                throw new BusinessLogicError(`Cannot check in a booking with status: ${existing.status}`);
            }

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

            // guestPhone is nullable (guestId-only bookings). Fall back so check-in
            // never crashes; derive a 4-digit PIN from phone or booking id.
            const guestPin = ((updatedBooking.guestPhone || '').slice(-4) || updatedBooking.id.replace(/\D/g, '').slice(-4) || '0000');
            const hashedPin = await Bun.password.hash(guestPin);

            await tx.update(rooms)
                .set({
                    status: 'OCCUPIED',
                    currentGuestPin: hashedPin,
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
                // Lock the target room to avoid a room-change double-booking race.
                await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${data.roomId})`);
                const conflicting = await tx.query.bookings.findMany({
                    where: and(
                        eq(bookings.roomId, data.roomId),
                        eq(bookings.hotelId, hotelId),
                    )
                });
                const checkInDate = data.checkIn ? new Date(data.checkIn) : existing.checkIn;
                const checkOutDate = data.checkOut ? new Date(data.checkOut) : existing.checkOut;
                const isConflicting = conflicting.some(b =>
                    b.id !== bookingId &&
                    (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') &&
                    checkInDate < new Date(b.checkOut) &&
                    checkOutDate > new Date(b.checkIn)
                );
                if (isConflicting) {
                    throw new ConflictError('Target room is not available');
                }
                updateData.roomId = data.roomId;
            } else if (data.checkIn !== undefined || data.checkOut !== undefined) {
                // Same room, but the dates changed → re-validate against the room's
                // other bookings so an edit can't overrun a neighbouring reservation.
                await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${existing.roomId})`);
                const checkInDate = data.checkIn ? new Date(data.checkIn) : existing.checkIn;
                const checkOutDate = data.checkOut ? new Date(data.checkOut) : existing.checkOut;
                if (checkOutDate <= checkInDate) throw new ValidationError('Check-out must be after check-in');
                const others = await tx.query.bookings.findMany({
                    where: and(eq(bookings.roomId, existing.roomId), eq(bookings.hotelId, hotelId)),
                });
                const clash = others.some(b =>
                    b.id !== bookingId &&
                    (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') &&
                    checkInDate < new Date(b.checkOut) &&
                    checkOutDate > new Date(b.checkIn)
                );
                if (clash) throw new ConflictError('Room is not available for the new dates');
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

            // Free the room. A checked-in booking holds the room → send to cleaning.
            // A CONFIRMED booking never occupies the room (availability is computed
            // from live bookings), so cancelling alone frees it.
            if (existing.status === 'CHECKED_IN') {
                await tx.update(rooms)
                    .set({
                        status: 'CLEANING',
                        currentGuestPin: null,
                        updatedAt: new Date()
                    })
                    .where(eq(rooms.id, existing.roomId));
            }

            // Cancellation fee — hotel-wide policy unless the caller passes an
            // explicit override. Recorded as a folio charge so finance tracks it.
            let fee = cancellationFee;
            if (fee === undefined) {
                const hotel = await tx.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { paymentConfig: true } });
                const policy = ((hotel?.paymentConfig as any) || {}).cancellation || {};
                if (policy.enabled && policy.value > 0) {
                    fee = policy.type === 'PERCENT'
                        ? Math.round(parseFloat(existing.totalAmount || '0') * (policy.value / 100) * 100) / 100
                        : policy.value;
                }
            }
            if (fee && fee > 0) {
                await tx.insert(folioCharges).values({
                    hotelId, bookingId,
                    date: new Date().toISOString().slice(0, 10),
                    description: 'Cancellation fee',
                    amount: String(fee),
                    type: 'CANCELLATION_FEE',
                });
            }

            const advance = parseFloat(existing.advancePayment || '0');
            const refundDue = Math.max(0, advance - (fee || 0));

            await logAction(hotelId, userId, 'CANCEL_BOOKING', 'BOOKING', bookingId, {
                guestName: existing.guestName,
                reason: reason || 'No reason provided',
                cancellationFee: fee || 0,
                refundDue,
            }, ipAddress);

            return { ...cancelled, cancellationFee: fee || 0, refundDue };
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

            // Guard: the extended window [oldCheckOut, newCheckOut) must not collide
            // with the next reservation on this room.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${existing.roomId})`);
            const clash = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.hotelId, hotelId),
                    eq(bookings.roomId, existing.roomId),
                    ne(bookings.id, bookingId),
                    inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN']),
                    lt(bookings.checkIn, newDate),
                    gt(bookings.checkOut, existing.checkOut),
                ),
                columns: { id: true },
            });
            if (clash) throw new BusinessLogicError('Cannot extend — the room has another booking in that period');

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

            // Lock the target room so two concurrent change-room/book requests
            // can't both pass the overlap check and double-occupy it.
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${hotelId}, ${newRoomId})`);

            const conflicting = await tx.query.bookings.findMany({
                where: and(
                    eq(bookings.roomId, newRoomId),
                    eq(bookings.hotelId, hotelId),
                )
            });
            const isConflicting = conflicting.some(b =>
                b.id !== bookingId &&
                (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') &&
                new Date(existing.checkIn) < new Date(b.checkOut) &&
                new Date(existing.checkOut) > new Date(b.checkIn)
            );
            if (isConflicting) {
                throw new ConflictError('Target room is not available for these dates');
            }

            const newRoom = await tx.query.rooms.findFirst({
                where: and(eq(rooms.id, newRoomId), eq(rooms.hotelId, hotelId))
            });
            if (!newRoom) throw new NotFoundError('Room');

            // Recalculate totalAmount from new room rate * nights
            const nights = Math.max(1, Math.ceil(
                (new Date(existing.checkOut).getTime() - new Date(existing.checkIn).getTime()) / (1000 * 60 * 60 * 24)
            ));
            const newTotal = parseFloat(newRoom.rate || '0') * nights;

            const [updated] = await tx.update(bookings)
                .set({
                    roomId: newRoomId,
                    totalAmount: newTotal.toFixed(2),
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

                const guestPin = ((existing.guestPhone || '').slice(-4) || existing.id.replace(/\D/g, '').slice(-4) || '0000');
                const hashedPin = await Bun.password.hash(guestPin);
                await tx.update(rooms)
                    .set({ status: 'OCCUPIED', currentGuestPin: hashedPin, updatedAt: new Date() })
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

            // Auto-populate the CRM with this guest (matched by phone).
            GuestService.upsertFromBooking(hotelId, {
                fullName: booking.guestName, phone: booking.guestPhone,
                email: booking.guestEmail, nationality: booking.nationality,
            }).catch(() => { /* best-effort */ });

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
