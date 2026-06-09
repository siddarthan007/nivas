import { db } from '../../db';
import { rooms, bookings, hotels } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { ValidationError, UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { logAction } from '../system/audit.service';
import { getRedis } from '../../shared/redis';

const rateLimitMap = new Map<string, { attempts: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_SEC = WINDOW_MS / 1000;

function getRateLimitKey(roomNumber: string, hotelSlug?: string) {
    return hotelSlug ? `${hotelSlug}:${roomNumber}` : roomNumber;
}

// In-memory fallback (single-instance) when Redis is unavailable.
function checkRateLimitMemory(key: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(key);
    if (!record || now > record.resetAt) {
        rateLimitMap.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (record.attempts >= MAX_ATTEMPTS) return false;
    record.attempts += 1;
    return true;
}

// Redis-backed limiter so PIN brute-force is throttled ACROSS all app instances.
// INCR + EXPIRE is atomic per key. Falls back to in-memory if Redis is down.
async function checkRateLimit(key: string): Promise<boolean> {
    const redis = getRedis();
    if (redis && redis.status === 'ready') {
        try {
            const rk = `guestpin:${key}`;
            const n = await redis.incr(rk);
            if (n === 1) await redis.expire(rk, WINDOW_SEC);
            return n <= MAX_ATTEMPTS;
        } catch {
            // fall through to in-memory
        }
    }
    return checkRateLimitMemory(key);
}

async function verifyPin(storedPin: string | null, providedPin: string): Promise<boolean> {
    if (!storedPin) return false;

    // Try bcrypt first (new hashed PINs)
    try {
        const isMatch = await Bun.password.verify(providedPin, storedPin);
        if (isMatch) return true;
    } catch {
        // Not a bcrypt hash, fall through to plaintext
    }

    // Fallback: plaintext comparison (backward compatibility for existing PINs)
    return storedPin === providedPin;
}

export const GuestAuthService = {
    async login(
        token: string | undefined,
        roomNumber: string | undefined,
        hotelSlug: string | undefined,
        pin: string,
        jwt: any,
        ipAddress?: string
    ) {
        if (!token && !roomNumber) {
            throw new ValidationError('Token or Room Number is required');
        }

        let room;
        let hotelId: number | undefined;

        // Tenant isolation: resolve hotel from slug
        if (hotelSlug) {
            const hotel = await db.query.hotels.findFirst({
                where: eq(hotels.slug, hotelSlug),
            });
            if (!hotel) throw new ValidationError('Invalid hotel identifier');
            hotelId = hotel.id;
        }

        if (token) {
            room = await db.query.rooms.findFirst({
                where: eq(rooms.qrToken, token),
            });
        } else if (roomNumber) {
            const roomNum = parseInt(roomNumber);
            if (isNaN(roomNum)) throw new ValidationError('Invalid room number');

            if (hotelId) {
                room = await db.query.rooms.findFirst({
                    where: and(eq(rooms.number, roomNum), eq(rooms.hotelId, hotelId)),
                });
            } else {
                room = await db.query.rooms.findFirst({
                    where: eq(rooms.number, roomNum),
                });
            }
        }

        if (!room) {
            throw new ValidationError('Invalid room or token');
        }

        // Rate limiting
        const rateKey = getRateLimitKey(String(room.number), hotelSlug);
        if (!(await checkRateLimit(rateKey))) {
            throw new ForbiddenError('Too many login attempts. Please try again in 15 minutes.');
        }

        // Verify PIN (bcrypt or plaintext fallback)
        const pinValid = await verifyPin(room.currentGuestPin, pin);
        if (!pinValid) {
            await logAction(
                room.hotelId,
                null,
                'GUEST_LOGIN_FAILED',
                'ROOM',
                String(room.id),
                { roomNumber: room.number, reason: 'Invalid PIN', ipAddress },
                ipAddress
            );
            throw new UnauthorizedError('Invalid pin');
        }

        // Security: check room has an active guest (CHECKED_IN booking)
        const activeBooking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.roomId, room.id),
                eq(bookings.status, 'CHECKED_IN')
            ),
        });

        if (!activeBooking) {
            await logAction(
                room.hotelId,
                null,
                'GUEST_LOGIN_FAILED',
                'ROOM',
                String(room.id),
                { roomNumber: room.number, reason: 'No active booking', ipAddress },
                ipAddress
            );
            throw new UnauthorizedError('Room does not have an active booking');
        }

        const accessToken = await jwt.sign({
            id: `guest-${room.id}`,
            hotelId: room.hotelId,
            roomId: room.id,
            type: 'GUEST',
            permissions: [PERMISSIONS.ORDERS.CREATE, PERMISSIONS.GUESTS.VIEW_DETAILS]
        });

        await logAction(
            room.hotelId,
            null,
            'GUEST_LOGIN',
            'ROOM',
            String(room.id),
            { roomNumber: room.number, guestName: activeBooking.guestName, ipAddress },
            ipAddress
        );

        return {
            token: accessToken,
            room: {
                id: room.id,
                number: room.number,
                type: room.type,
            },
            booking: {
                id: activeBooking.id,
                guestName: activeBooking.guestName,
                checkInDate: activeBooking.checkIn.toISOString(),
                checkOutDate: activeBooking.checkOut.toISOString(),
            },
        };
    }
};
