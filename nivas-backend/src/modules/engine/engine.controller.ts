import { Elysia, t } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { db } from '../../db';
import { hotels, rooms, bookings, roomTypes, amenities } from '../../db/schema';
import { eq, and, inArray, lt, gt } from 'drizzle-orm';
import { createResponse } from '../../utils/response.helper';
import { ApiKeyService } from './api-key.service';
import { EngineOtpService } from './engine-otp.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationChannelService } from '../notifications/notification-channel.service';

const nights = (a: Date, b: Date) => Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86400000));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Public booking engine — authenticated by an API key (header `x-api-key`).
 * Powers a hotel's own website / partners: read hotel details, amenities, room
 * availability with full pricing, and create direct (commission-free) bookings.
 * Rate-limited per client to protect the public surface.
 */
export const engineController = new Elysia({ prefix: '/engine' })
    // Tighter public limit than the global one (abuse protection). Scoped so it
    // never leaks to the rest of the app.
    .use((app) => app.use(rateLimit({
        duration: 60_000,
        max: 120,
        scoping: 'scoped',
        generator: (req) => (req.headers.get('x-api-key') || req.headers.get('x-forwarded-for') || 'anon').slice(0, 80),
        errorResponse: 'Rate limit exceeded. Slow down.',
    })))
    .derive(async ({ headers, set }) => {
        const ctx = await ApiKeyService.verify(headers['x-api-key'] || '');
        if (!ctx) { set.status = 401; return { api: null as null | { hotelId: number; scopes: string[] } }; }
        return { api: ctx };
    })
    .onBeforeHandle(({ api, set }) => {
        if (!api) { set.status = 401; return createResponse(null, 'Invalid or missing API key'); }
    })

    // ── Hotel public profile + policies + taxes ──────────────────────────────
    .get('/hotel', async ({ api }) => {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, api!.hotelId),
            columns: {
                name: true, slug: true, address: true, phone: true, email: true, website: true,
                logoUrl: true, primaryColor: true, currency: true, checkInTime: true, checkOutTime: true,
                latitude: true, longitude: true, serviceChargeRate: true, taxRate: true,
            },
        });
        if (!hotel) return createResponse(null, 'Hotel not found');
        const extras = await db.query.amenities.findMany({
            where: and(eq(amenities.hotelId, api!.hotelId), eq(amenities.isActive, true)),
            columns: { name: true, category: true, price: true },
        });
        return createResponse({
            hotel: {
                ...hotel,
                serviceChargeRate: round2(parseFloat(hotel.serviceChargeRate || '0.10') * 100),
                taxRate: round2(parseFloat(hotel.taxRate || '0.13') * 100),
            },
            amenities: extras,
            policies: {
                checkInTime: hotel.checkInTime || '14:00',
                checkOutTime: hotel.checkOutTime || '11:00',
                serviceChargePct: round2(parseFloat(hotel.serviceChargeRate || '0.10') * 100),
                vatPct: round2(parseFloat(hotel.taxRate || '0.13') * 100),
            },
        }, 'Hotel info');
    })

    // ── Room types catalog (with a representative photo + capacity) ──────────
    .get('/room-types', async ({ api }) => {
        const [types, allRooms] = await Promise.all([
            db.query.roomTypes.findMany({
                where: and(eq(roomTypes.hotelId, api!.hotelId), eq(roomTypes.isActive, true)),
                columns: { id: true, name: true, code: true, description: true, baseRate: true },
                orderBy: (rt, { asc }) => [asc(rt.sortOrder)],
            }),
            db.query.rooms.findMany({
                where: eq(rooms.hotelId, api!.hotelId),
                columns: { type: true, imageUrl: true, capacity: true, rate: true },
            }),
        ]);
        const enriched = types.map(t => {
            const sample = allRooms.find(r => (r.type || '').toLowerCase() === (t.code || t.name || '').toLowerCase());
            return {
                ...t,
                baseRate: parseFloat(t.baseRate || '0'),
                imageUrl: sample?.imageUrl || null,
                capacity: sample?.capacity || 2,
            };
        });
        return createResponse(enriched, 'Room types');
    })

    // ── Availability with full pricing + filters (guests, price range) ───────
    .get('/availability', async ({ api, query, set }) => {
        const inD = new Date(`${query.checkIn}T00:00:00`);
        const outD = new Date(`${query.checkOut}T00:00:00`);
        if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) {
            set.status = 400; return createResponse(null, 'Invalid checkIn/checkOut');
        }
        if (inD < new Date(new Date().toDateString())) {
            set.status = 400; return createResponse(null, 'checkIn cannot be in the past');
        }
        const guests = query.guests ? parseInt(query.guests) : 1;
        const n = nights(inD, outD);

        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, api!.hotelId), columns: { serviceChargeRate: true, taxRate: true, currency: true } });
        const scRate = parseFloat(hotel?.serviceChargeRate || '0.10');
        const vatRate = parseFloat(hotel?.taxRate || '0.13');

        const allRooms = await db.query.rooms.findMany({
            where: eq(rooms.hotelId, api!.hotelId),
            columns: { id: true, type: true, rate: true, capacity: true, status: true, imageUrl: true },
        });
        const overlapping = await db.query.bookings.findMany({
            where: and(eq(bookings.hotelId, api!.hotelId), inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN']), lt(bookings.checkIn, outD), gt(bookings.checkOut, inD)),
            columns: { roomId: true },
        });
        const taken = new Set(overlapping.map(b => b.roomId));

        const byType: Record<string, any> = {};
        for (const r of allRooms) {
            if (taken.has(r.id)) continue;
            if (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER') continue;
            const cap = r.capacity || 2;
            if (cap < guests) continue; // capacity filter
            const rate = parseFloat(r.rate || '0');
            const key = r.type || 'STANDARD';
            if (!byType[key]) byType[key] = { type: key, available: 0, fromRate: rate, capacity: cap, imageUrl: r.imageUrl || null };
            byType[key].available += 1;
            if (rate > 0 && rate < byType[key].fromRate) byType[key].fromRate = rate;
            if (cap > byType[key].capacity) byType[key].capacity = cap;
            if (!byType[key].imageUrl && r.imageUrl) byType[key].imageUrl = r.imageUrl;
        }

        const minP = query.minPrice ? parseFloat(query.minPrice) : undefined;
        const maxP = query.maxPrice ? parseFloat(query.maxPrice) : undefined;

        const result = Object.values(byType)
            .filter((t: any) => t.available > 0)
            .filter((t: any) => (minP === undefined || t.fromRate >= minP) && (maxP === undefined || t.fromRate <= maxP))
            .map((t: any) => {
                const roomSubtotal = round2(t.fromRate * n);
                const serviceCharge = round2(roomSubtotal * scRate);
                const vat = round2((roomSubtotal + serviceCharge) * vatRate);
                return {
                    ...t,
                    fromRate: round2(t.fromRate),
                    pricing: { perNight: round2(t.fromRate), nights: n, roomSubtotal, serviceCharge, vat, total: round2(roomSubtotal + serviceCharge + vat) },
                };
            });

        return createResponse({ checkIn: query.checkIn, checkOut: query.checkOut, nights: n, guests, currency: hotel?.currency || 'NPR', roomTypes: result }, 'Availability');
    }, { query: t.Object({ checkIn: t.String(), checkOut: t.String(), guests: t.Optional(t.String()), minPrice: t.Optional(t.String()), maxPrice: t.Optional(t.String()) }) })

    // ── Look up a booking (confirmation page) ────────────────────────────────
    .get('/bookings/:id', async ({ api, params, set }) => {
        // Only expose bookings made THROUGH the engine — never walk-in/front-desk
        // bookings (avoids leaking other guests' PII via a public read key).
        const b = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, params.id), eq(bookings.hotelId, api!.hotelId), eq(bookings.source, 'WEBSITE')),
            columns: { id: true, status: true, guestName: true, checkIn: true, checkOut: true, totalAmount: true, roomId: true },
            with: { room: { columns: { number: true, type: true } } },
        });
        if (!b) { set.status = 404; return createResponse(null, 'Booking not found'); }
        return createResponse(b, 'Booking');
    }, { params: t.Object({ id: t.String() }) })

    // ── Request a verification code (anti-spam — gates booking) ──────────────
    .post('/otp/request', async ({ api, body }) => {
        const channel = body.channel === 'sms' ? 'sms' : 'email';
        const result = await EngineOtpService.request(api!.hotelId, body.contact, channel);
        return createResponse(result, 'Verification code sent');
    }, { body: t.Object({ contact: t.String({ minLength: 5 }), channel: t.Optional(t.Union([t.Literal('email'), t.Literal('sms')])) }) })

    // ── Create a direct booking (needs 'book' scope + a verified OTP) ────────
    .post('/bookings', async ({ api, body, set }) => {
        if (!api!.scopes.includes('book')) { set.status = 403; return createResponse(null, 'API key lacks book scope'); }

        // Anti-spam: the guest must have verified their email/phone via OTP.
        const verifyContact = body.guestEmail || body.guestPhone;
        const ok = await EngineOtpService.verify(api!.hotelId, verifyContact, body.otp);
        if (!ok) { set.status = 401; return createResponse(null, 'Invalid or expired verification code'); }

        const inD = new Date(`${body.checkIn}T00:00:00`);
        const outD = new Date(`${body.checkOut}T00:00:00`);
        if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) { set.status = 400; return createResponse(null, 'Invalid dates'); }
        if (inD < new Date(new Date().toDateString())) { set.status = 400; return createResponse(null, 'checkIn cannot be in the past'); }
        const guests = body.guests || 1;

        const free = await db.query.rooms.findMany({
            where: and(eq(rooms.hotelId, api!.hotelId), eq(rooms.type, body.roomType)),
            columns: { id: true, rate: true, status: true, capacity: true },
        });
        const overlapping = await db.query.bookings.findMany({
            where: and(eq(bookings.hotelId, api!.hotelId), inArray(bookings.status, ['CONFIRMED', 'CHECKED_IN']), lt(bookings.checkIn, outD), gt(bookings.checkOut, inD)),
            columns: { roomId: true },
        });
        const taken = new Set(overlapping.map(b => b.roomId));
        const room = free
            .filter(r => !taken.has(r.id) && r.status !== 'MAINTENANCE' && r.status !== 'OUT_OF_ORDER' && (r.capacity || 2) >= guests)
            .sort((a, b) => parseFloat(a.rate || '0') - parseFloat(b.rate || '0'))[0];
        if (!room) { set.status = 409; return createResponse(null, 'No rooms available for the selected type, dates and party size'); }

        const booking = await BookingsService.createBooking(api!.hotelId, null as any, {
            roomId: room.id, checkIn: body.checkIn, checkOut: body.checkOut,
            guestName: body.guestName, guestPhone: body.guestPhone, guestEmail: body.guestEmail,
            guestCount: guests, source: 'WEBSITE', status: 'CONFIRMED',
        });
        if (!booking) { set.status = 500; return createResponse(null, 'Failed to create booking'); }

        const confirmationNumber = String(booking.id).slice(0, 8).toUpperCase();

        // Branded confirmation email (best-effort — never fails the booking).
        if (body.guestEmail) {
            const total = parseFloat(booking.totalAmount || '0');
            NotificationChannelService.sendBrandedEmail(api!.hotelId, body.guestEmail, `Booking Confirmed — ${confirmationNumber}`, {
                heading: 'Your booking is confirmed',
                intro: `Hi ${body.guestName}, thank you for booking with us. Here are your details:`,
                rows: [
                    { label: 'Confirmation', value: confirmationNumber },
                    { label: 'Room type', value: body.roomType },
                    { label: 'Check-in', value: body.checkIn },
                    { label: 'Check-out', value: body.checkOut },
                    ...(total > 0 ? [{ label: 'Estimated total', value: total.toLocaleString() }] : []),
                ],
                footerNote: 'We look forward to hosting you. Reply to this email for any changes.',
            }).catch(() => { /* non-fatal */ });
        }

        return createResponse({
            bookingId: booking.id,
            confirmationNumber,
            status: booking.status,
            totalAmount: parseFloat(booking.totalAmount || '0'),
            checkIn: body.checkIn, checkOut: body.checkOut,
            emailSent: !!body.guestEmail,
        }, 'Booking confirmed');
    }, {
        body: t.Object({
            checkIn: t.String(),
            checkOut: t.String(),
            roomType: t.String(),
            guests: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
            guestName: t.String({ minLength: 1, maxLength: 120 }),
            guestPhone: t.String({ minLength: 5, maxLength: 20 }),
            guestEmail: t.Optional(t.String({ maxLength: 160 })),
            otp: t.String({ minLength: 4, maxLength: 8 }),
        }),
    });
