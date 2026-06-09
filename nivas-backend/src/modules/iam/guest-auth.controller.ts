import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { config } from '../../config/env';
import { GuestAuthService } from './guest-auth.service';
import { createResponse } from '../../utils/response.helper';

export const guestAuthController = new Elysia({ prefix: '/guest' })
    .use(jwt({
        name: 'jwt',
        secret: config.jwt.secret
    }))
    // Brute-force protection is handled per-room inside GuestAuthService
    // (Redis INCR), so no global elysia rate-limiter here — applying one with the
    // library's default `scoping: 'global'` would throttle the ENTIRE app.
    .post('/login', async ({ body, jwt, cookie: { auth }, request }) => {
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const result = await GuestAuthService.login(body.token, body.roomNumber, body.hotelSlug, body.pin, jwt, ipAddress);

        auth?.set({
            value: result.token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
        });

        return createResponse({
            token: result.token,
            room: result.room,
            booking: result.booking,
        }, `Welcome to Room ${result.room.number}`);
    }, {
        body: t.Object({
            token: t.Optional(t.String()),
            roomNumber: t.Optional(t.String()),
            hotelSlug: t.Optional(t.String()),
            pin: t.String()
        }),
        detail: {
            summary: 'Guest login via room number/PIN or QR token',
            tags: ['Auth']
        }
    });