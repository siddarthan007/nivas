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
    .post('/login', async ({ body, jwt, cookie: { auth } }) => {
        const result = await GuestAuthService.login(body.token, body.roomNumber, body.pin, jwt);

        auth?.set({
            value: result.token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
        });

        return createResponse({ room: result.room }, `Welcome to Room ${result.room.number}`);
    }, {
        body: t.Object({
            token: t.Optional(t.String()),
            roomNumber: t.Optional(t.String()),
            pin: t.String()
        }),
        detail: {
            summary: 'Guest login via QR code',
            tags: ['Auth']
        }
    });