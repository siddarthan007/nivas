import { db } from '../../db';
import { folioCharges, payments, bookings, orders, guestProfiles, invoices, guests } from '../../db/schema';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { AuditService } from '../system/audit.service';
import { WSService } from '../notifications/ws.service';
import { relationOne } from '../../utils/relation';

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

/** Tax-inclusive billable amount for POS orders (prefer totalAmount over subTotal). */
function orderBillableAmount(o: { subTotal?: string | null; totalAmount?: string | null }) {
    return parseFloat(o.totalAmount || o.subTotal || '0');
}

function computeBillingTotals(
    folioList: Array<{ amount?: string | null; invoiceId?: string | number | null; orderId?: string | null }>,
    guestOrders: Array<{ id: string; status: string | null; bookingId?: string | null; subTotal?: string | null; totalAmount?: string | null }>,
    activeInvoices: Array<{ bookingId?: string | null; grandTotal?: string | null }>,
) {
    const chargedOrderIds = new Set(
        folioList.filter((c) => c.orderId).map((c) => c.orderId as string),
    );
    const bookingsWithInvoice = new Set(
        activeInvoices.filter((i) => i.bookingId).map((i) => i.bookingId as string),
    );
    const invoiceTotal = activeInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal || '0'), 0);
    const folioUninvoiced = folioList
        .filter((c) => !c.invoiceId)
        .reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);
    const standaloneOrders = guestOrders
        .filter(
            (o) =>
                o.status === 'SERVED' &&
                !chargedOrderIds.has(o.id) &&
                (!o.bookingId || !bookingsWithInvoice.has(o.bookingId)),
        )
        .reduce((sum, o) => sum + orderBillableAmount(o), 0);
    const totalCharges = invoiceTotal + folioUninvoiced + standaloneOrders;
    return { invoiceTotal, folioUninvoiced, standaloneOrders, totalCharges, chargedOrderIds, bookingsWithInvoice };
}

export class FolioService {
    static async createCharge(hotelId: number, userId: string, data: {
        bookingId: string;
        description: string;
        amount: number;
        type?: string;
        date?: string;
    }, ipAddress?: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, data.bookingId), eq(bookings.hotelId, hotelId)),
        });
        if (!booking) throw new NotFoundError('Booking');
        // Don't add charges to a closed booking — they'd never make it onto the
        // (already generated) invoice and would orphan on the folio.
        if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') {
            throw new BusinessLogicError(`Cannot add charges to a ${booking.status.toLowerCase()} booking`);
        }
        if (!data.amount || data.amount === 0) {
            throw new BusinessLogicError('Charge amount cannot be zero');
        }

        const [charge] = await db.insert(folioCharges).values({
            hotelId,
            bookingId: data.bookingId,
            description: data.description,
            amount: data.amount.toString(),
            type: data.type || 'MISCELLANEOUS',
            date: data.date || todayIsoDate(),
        }).returning();

        if (!charge) {
            throw new BusinessLogicError('Failed to create folio charge');
        }

        await AuditService.log(hotelId, userId, 'CREATE_FOLIO_CHARGE', 'FOLIO', charge.id.toString(), {
            bookingId: data.bookingId,
            description: data.description,
            amount: data.amount,
        }, ipAddress);

        if (booking.roomId && booking.status === 'CHECKED_IN') {
            WSService.broadcastToGuestRoom(hotelId, booking.roomId, 'GUEST_BILL_UPDATE', {
                reason: 'folio_charge',
                bookingId: data.bookingId,
            });
        }

        return charge;
    }

    static async getBookingFolio(hotelId: number, bookingId: string) {
        const booking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, bookingId), eq(bookings.hotelId, hotelId)),
            with: { room: true, guest: true },
        });
        if (!booking) throw new NotFoundError('Booking');

        const charges = await db.query.folioCharges.findMany({
            where: and(eq(folioCharges.bookingId, bookingId), eq(folioCharges.hotelId, hotelId)),
            orderBy: (folioChargeTable, { asc }) => [asc(folioChargeTable.date)],
        });

        // Include orders linked to this booking (room service, restaurant, etc.)
        const bookingOrders = await db.query.orders.findMany({
            where: and(
                eq(orders.hotelId, hotelId),
                eq(orders.bookingId, bookingId)
            ),
            with: { items: { with: { menuItem: true } } },
            orderBy: (o, { desc }) => [desc(o.createdAt)]
        });

        const orderIds = bookingOrders.map(o => o.id);
        const bookingPayments = await db.query.payments.findMany({
            where: and(
                eq(payments.hotelId, hotelId),
                or(
                    eq(payments.bookingId, bookingId),
                    ...(orderIds.length > 0 ? [inArray(payments.orderId, orderIds)] : [])
                )
            ),
            with: {
                recordedBy: { columns: { fullName: true } },
            },
            orderBy: (paymentTable, { desc }) => [desc(paymentTable.createdAt)],
        });

        const bookingInvoices = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                eq(invoices.bookingId, bookingId),
                eq(invoices.isVoided, false),
            ),
        });
        const billing = computeBillingTotals(charges, bookingOrders, bookingInvoices);

        const folioTotal = charges.reduce((sum, charge) => sum + parseFloat(charge.amount), 0);
        const totalPayments = bookingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

        // Guest preferences / allergies / VIP from CRM profile + guest record
        let guestContext: {
            isVip?: boolean;
            preferences?: unknown;
            allergies?: string[];
            notes?: string;
        } | null = null;

        const guestRecord = relationOne(booking.guest);
        const profile = booking.guestPhone
            ? await db.query.guestProfiles.findFirst({
                where: and(eq(guestProfiles.hotelId, hotelId), eq(guestProfiles.phone, booking.guestPhone)),
            })
            : null;

        const prefs = (profile?.preferences || {}) as Record<string, unknown>;
        const allergyList = Array.isArray(prefs.allergies)
            ? (prefs.allergies as string[])
            : typeof prefs.allergies === 'string' && prefs.allergies
                ? [prefs.allergies]
                : [];

        guestContext = {
            isVip: !!(profile?.isVip || guestRecord?.isVip),
            preferences: profile?.preferences || null,
            allergies: allergyList,
            notes: guestRecord?.notes || undefined,
        };

        return {
            booking,
            guestContext,
            charges,
            payments: bookingPayments,
            orders: bookingOrders,
            summary: {
                folioTotal,
                ordersTotal: billing.standaloneOrders,
                invoiceTotal: billing.invoiceTotal,
                totalCharges: billing.totalCharges,
                totalPayments,
                balance: billing.totalCharges - totalPayments,
            },
        };
    }

    static async updateCharge(hotelId: number, chargeId: number, data: {
        description?: string;
        amount?: number;
        type?: string;
    }) {
        const existing = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!existing) throw new NotFoundError('Folio charge');
        // Immutability: a charge already attached to an invoice can't change.
        if (existing.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be edited');
        }
        if (data.amount !== undefined && data.amount === 0) {
            throw new BusinessLogicError('Charge amount cannot be zero');
        }

        const updateData: Record<string, any> = {};
        if (data.description !== undefined) updateData.description = data.description;
        if (data.amount !== undefined) updateData.amount = data.amount.toString();
        if (data.type !== undefined) updateData.type = data.type;

        const [updated] = await db.update(folioCharges)
            .set(updateData)
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)))
            .returning();

        if (!updated) throw new NotFoundError('Folio charge');
        return updated;
    }

    static async voidCharge(hotelId: number, userId: string, chargeId: number, ipAddress?: string) {
        const existing = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!existing) throw new NotFoundError('Folio charge');
        // Immutability: never delete a charge already billed on an invoice.
        if (existing.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be voided. Issue a credit note instead.');
        }

        await db.delete(folioCharges)
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)));

        await AuditService.log(hotelId, userId, 'VOID_FOLIO_CHARGE', 'FOLIO', chargeId.toString(), {
            description: existing.description,
            amount: existing.amount,
        }, ipAddress);
    }

    /**
     * Move a folio charge to another booking — the primitive for splitting a bill
     * across guests (transfer specific charges to each payer's folio) and for
     * room transfers. Blocked once the charge is on an invoice.
     */
    static async moveCharge(hotelId: number, userId: string, chargeId: number, targetBookingId: string, ipAddress?: string) {
        const charge = await db.query.folioCharges.findFirst({
            where: and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)),
        });
        if (!charge) throw new NotFoundError('Folio charge');
        if (charge.invoiceId) {
            throw new BusinessLogicError('This charge is already on an invoice and cannot be moved');
        }
        if (charge.bookingId === targetBookingId) return charge;

        const target = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, targetBookingId), eq(bookings.hotelId, hotelId)),
            columns: { id: true, status: true, guestName: true },
        });
        if (!target) throw new NotFoundError('Target booking');
        if (target.status === 'CHECKED_OUT' || target.status === 'CANCELLED') {
            throw new BusinessLogicError(`Cannot move a charge to a ${target.status.toLowerCase()} booking`);
        }

        const [updated] = await db.update(folioCharges)
            .set({ bookingId: targetBookingId })
            .where(and(eq(folioCharges.id, chargeId), eq(folioCharges.hotelId, hotelId)))
            .returning();

        await AuditService.log(hotelId, userId, 'MOVE_FOLIO_CHARGE', 'FOLIO', chargeId.toString(), {
            from: charge.bookingId, to: targetBookingId, amount: charge.amount, description: charge.description,
        }, ipAddress);
        return updated;
    }

    static async getCustomerFolio(hotelId: number, guestId: string) {
        const profile = await db.query.guestProfiles.findFirst({
            where: and(eq(guestProfiles.id, guestId), eq(guestProfiles.hotelId, hotelId))
        });

        let linkedGuestId = profile?.guestId ?? null;
        const phone = profile?.phone;

        if (!linkedGuestId && phone) {
            const byPhone = await db.query.guests.findFirst({
                where: and(eq(guests.hotelId, hotelId), eq(guests.phone, phone)),
                columns: { id: true },
            });
            linkedGuestId = byPhone?.id ?? null;
        }

        if (!linkedGuestId) {
            linkedGuestId = guestId;
        }

        const guest = await db.query.guests.findFirst({
            where: and(eq(guests.id, linkedGuestId), eq(guests.hotelId, hotelId))
        });

        let uniqueBookings: Awaited<ReturnType<typeof db.query.bookings.findMany>> = [];

        if (!guest) {
            if (profile?.phone) {
                const byPhone = await db.query.bookings.findMany({
                    where: and(eq(bookings.hotelId, hotelId), eq(bookings.guestPhone, profile.phone)),
                    orderBy: (b, { desc }) => [desc(b.createdAt)],
                    with: {
                        room: { columns: { number: true, type: true } },
                        guest: { columns: { fullName: true, phone: true, email: true } },
                    },
                });
                uniqueBookings = [...new Map(byPhone.map(b => [b.id, b])).values()];
            }
            if (uniqueBookings.length === 0) {
                return {
                    booking: null,
                    bookings: [],
                    charges: [],
                    orders: [],
                    payments: [],
                    invoices: [],
                    summary: { folioTotal: 0, ordersTotal: 0, totalCharges: 0, totalPayments: 0, balance: 0 },
                };
            }
        } else {
            const guestBookings = await db.query.bookings.findMany({
                where: and(
                    eq(bookings.hotelId, hotelId),
                    or(
                        eq(bookings.guestId, linkedGuestId),
                        ...(guest.phone ? [eq(bookings.guestPhone, guest.phone)] : [])
                    )
                ),
                orderBy: (b, { desc }) => [desc(b.createdAt)],
                with: {
                    room: { columns: { number: true, type: true } },
                    guest: { columns: { fullName: true, phone: true, email: true } },
                },
            });
            uniqueBookings = [...new Map(guestBookings.map(b => [b.id, b])).values()];
        }

        const bookingIds = uniqueBookings.map(b => b.id);

        if (bookingIds.length === 0) {
            return {
                booking: null,
                charges: [],
                orders: [],
                payments: [],
                invoices: [],
                summary: { folioTotal: 0, ordersTotal: 0, totalCharges: 0, totalPayments: 0, balance: 0 }
            };
        }

        // 3. Fetch orders linked to these bookings (and directly by guestId or guest name)
        const orderConditions = [
            inArray(orders.bookingId, bookingIds),
            ...(linkedGuestId ? [eq(orders.guestId, linkedGuestId)] : []),
        ];
        if (guest?.fullName) {
            orderConditions.push(
                sql`(${orders.bookingId} IS NULL AND LOWER(${orders.customerName}) = LOWER(${guest.fullName}))`,
            );
        }

        const guestOrdersRaw = await db.query.orders.findMany({
            where: and(
                eq(orders.hotelId, hotelId),
                or(...orderConditions),
            ),
            with: { 
                items: { with: { menuItem: true } },
                booking: {
                    with: {
                        room: { columns: { number: true, type: true } }
                    }
                }
            },
            orderBy: (o, { desc }) => [desc(o.createdAt)]
        });
        const guestOrders = [...new Map(guestOrdersRaw.map(o => [o.id, o])).values()];

        // 4. Fetch folio charges for all bookings with booking details
        const folioList = await db.query.folioCharges.findMany({
            where: and(eq(folioCharges.hotelId, hotelId), inArray(folioCharges.bookingId, bookingIds)),
            with: {
                booking: {
                    with: {
                        room: { columns: { number: true, type: true } }
                    }
                }
            }
        });

        // 5. Fetch payments for bookings and linked orders (walk-in POS may pay by order only)
        const orderIds = guestOrders.map(o => o.id);
        const guestPayments = await db.query.payments.findMany({
            where: and(
                eq(payments.hotelId, hotelId),
                or(
                    inArray(payments.bookingId, bookingIds),
                    ...(orderIds.length > 0 ? [inArray(payments.orderId, orderIds)] : [])
                )
            ),
            with: {
                recordedBy: { columns: { fullName: true } },
            },
            orderBy: (p, { desc }) => [desc(p.createdAt)]
        });

        // 6. Fetch invoices for all bookings with booking details
        const guestInvoices = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                inArray(invoices.bookingId, bookingIds)
            ),
            with: {
                booking: {
                    with: {
                        room: { columns: { number: true, type: true } }
                    }
                }
            },
            orderBy: (i, { desc }) => [desc(i.createdAt)]
        });

        // Active invoices (exclude voided)
        const activeInvoices = guestInvoices.filter(inv => !inv.isVoided);
        const billing = computeBillingTotals(folioList, guestOrders, activeInvoices);
        const totalPaid = guestPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
        const invoiceTotal = billing.invoiceTotal;

        return {
            booking: uniqueBookings[0] || null,
            bookings: uniqueBookings,
            charges: folioList,
            orders: guestOrders,
            payments: guestPayments,
            invoices: guestInvoices,
            summary: {
                folioTotal: billing.folioUninvoiced,
                ordersTotal: billing.standaloneOrders,
                totalCharges: billing.totalCharges,
                invoiceTotal,
                totalPayments: totalPaid,
                balance: billing.totalCharges - totalPaid,
                stayCount: uniqueBookings.length,
                orderCount: guestOrders.length,
            }
        };
    }

    /** Live customer ledgers for in-house guests (folio + served orders, before checkout). */
    static async listLiveCustomerLedgers(hotelId: number) {
        const activeBookings = await db.query.bookings.findMany({
            where: and(
                eq(bookings.hotelId, hotelId),
                inArray(bookings.status, ['CHECKED_IN', 'CONFIRMED'])
            ),
            with: {
                room: { columns: { number: true } },
                guest: { columns: { id: true, fullName: true, phone: true } },
            },
            orderBy: (b, { desc }) => [desc(b.checkIn)],
        });

        const ledgers = await Promise.all(activeBookings.map(async (booking) => {
            const guest = relationOne(booking.guest);
            const room = relationOne(booking.room);
            const folio = await FolioService.getBookingFolio(hotelId, booking.id);
            return {
                guestId: booking.guestId ?? guest?.id,
                bookingId: booking.id,
                customerName: booking.guestName,
                customerPhone: booking.guestPhone ?? guest?.phone ?? '',
                roomNumber: room?.number,
                status: booking.status,
                totalCharges: folio.summary.totalCharges,
                totalPayments: folio.summary.totalPayments,
                balance: folio.summary.balance,
                isInHouse: booking.status === 'CHECKED_IN',
            };
        }));

        return ledgers.filter(l => l.totalCharges > 0 || l.balance !== 0 || l.isInHouse);
    }

    /** All customer ledgers (in-house + historical) using unified folio math. */
    static async listCustomerLedgers(hotelId: number) {
        const [bookingRows, orderRows] = await Promise.all([
            db.select({ guestId: bookings.guestId }).from(bookings).where(
                and(eq(bookings.hotelId, hotelId), sql`${bookings.guestId} IS NOT NULL`),
            ),
            db.select({ guestId: orders.guestId }).from(orders).where(
                and(eq(orders.hotelId, hotelId), sql`${orders.guestId} IS NOT NULL`),
            ),
        ]);

        const guestIds = new Set<string>();
        for (const row of [...bookingRows, ...orderRows]) {
            if (row.guestId) guestIds.add(row.guestId);
        }

        // Walk-in orders billed to a named guest (no guestId on order row)
        const namedOrders = await db.select({
            customerName: orders.customerName,
        }).from(orders).where(
            and(
                eq(orders.hotelId, hotelId),
                sql`${orders.guestId} IS NULL`,
                sql`${orders.customerName} IS NOT NULL`,
                eq(orders.status, 'SERVED'),
            ),
        );
        for (const row of namedOrders) {
            if (!row.customerName) continue;
            const match = await db.query.bookings.findFirst({
                where: and(
                    eq(bookings.hotelId, hotelId),
                    sql`LOWER(${bookings.guestName}) = LOWER(${row.customerName})`,
                    sql`${bookings.guestId} IS NOT NULL`,
                ),
                columns: { guestId: true },
            });
            if (match?.guestId) guestIds.add(match.guestId);
        }

        const ledgers = await Promise.all(
            [...guestIds].map(async (guestId) => {
                const folio = await FolioService.getCustomerFolio(hotelId, guestId);
                const { totalCharges, totalPayments, balance } = folio.summary;
                if (totalCharges === 0 && totalPayments === 0) return null;

                const bookingsList = folio.bookings?.length
                    ? folio.bookings
                    : folio.booking
                        ? [folio.booking]
                        : [];
                const primary = bookingsList[0];
                const guestRel = relationOne((primary as { guest?: { fullName?: string; phone?: string } | null })?.guest);
                const roomRel = relationOne((primary as { room?: { number?: number } | null })?.room);
                const activeInvoiceCount = (folio.invoices || []).filter(i => !i.isVoided).length;

                return {
                    guestId,
                    bookingId: primary?.id || guestId,
                    customerName: primary?.guestName || guestRel?.fullName || 'Guest',
                    customerPhone: primary?.guestPhone || guestRel?.phone || '',
                    roomNumber: roomRel?.number,
                    status: primary?.status,
                    totalCharges,
                    totalPayments,
                    balance,
                    isInHouse: primary?.status === 'CHECKED_IN',
                    transactionCount:
                        (folio.orders?.length || 0)
                        + (folio.payments?.length || 0)
                        + activeInvoiceCount,
                };
            }),
        );

        return ledgers
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
    }
}
