import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authRateLimitMiddleware } from '../../middlewares/rate-limit.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { IamService } from './iam.service';
import { createResponse } from '../../utils/response.helper';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors';
import { extractClientMeta } from '../../shared/client-meta';

const ACCESS_TOKEN_EXP = '2h';   // short-lived access token (client auto-refreshes)
const REFRESH_TOKEN_EXP = '30d'; // long-lived refresh token

export const iamController = new Elysia({ prefix: '/iam' })
    .use(authMiddleware)
    .use(
        new Elysia()
            .use(authRateLimitMiddleware)
            .post('/login', async (ctx) => {
        const { body, cookie: { auth }, request } = ctx;
        const jwt = (ctx as typeof ctx & { jwt: { sign: (payload: object) => Promise<string> } }).jwt;
        const { ip: ipAddress } = extractClientMeta(request);
        const result = await IamService.login(body.email, body.password, ipAddress);

        if (result.require2FA) {
            return createResponse({
                require2FA: true,
                userId: result.userId,
            }, result.message || 'OTP sent');
        }

        const { user, permissions } = result;

        const token = await jwt.sign({
            id: user!.id,
            hotelId: user!.hotelId,
            type: user!.userType,
            permissions: permissions as string[],
            tokenVersion: (user as any)!.tokenVersion ?? 0,
            exp: ACCESS_TOKEN_EXP,
        });
        // Long-lived refresh token (mobile): exchange at /iam/refresh for a new
        // access token without re-entering credentials.
        const refreshToken = await jwt.sign({
            id: user!.id,
            tokenUse: 'refresh',
            tokenVersion: (user as any)!.tokenVersion ?? 0,
            exp: REFRESH_TOKEN_EXP,
        });

        auth?.set({
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: "/",
        });

        return createResponse({
            token,
            refreshToken,
            user: {
                id: user!.id,
                name: user!.fullName,
                role: user!.role?.name
            }
        }, 'Login successful');
        }, {
        body: t.Object({
            email: t.String(),
            password: s.string({ minLength: 6 }),
        }),
        detail: {
            summary: 'Login to get a JWT token.',
            tags: ['Auth']
        }
    }))
    // Exchange a refresh token for a fresh access token (no credentials needed).
    .post('/refresh', async ({ body, jwt, cookie: { auth }, set }) => {
        const decoded: any = await jwt.verify(body.refreshToken);
        if (!decoded || decoded.tokenUse !== 'refresh' || !decoded.id) {
            set.status = 401;
            throw new UnauthorizedError('Invalid or expired refresh token');
        }

        // Re-validate the user (revokes access for deactivated / deleted accounts).
        const { user, permissions } = await IamService.refreshSession(decoded.id);

        // Reject refresh tokens issued before a "log out all devices".
        if ((decoded.tokenVersion ?? 0) !== ((user as any).tokenVersion ?? 0)) {
            set.status = 401;
            throw new UnauthorizedError('Session expired. Please sign in again.');
        }
        const tv = (user as any).tokenVersion ?? 0;

        const token = await jwt.sign({
            id: user.id,
            hotelId: user.hotelId,
            type: user.userType,
            permissions: permissions as string[],
            tokenVersion: tv,
            exp: ACCESS_TOKEN_EXP,
        });
        // Rotate the refresh token too.
        const refreshToken = await jwt.sign({
            id: user.id,
            tokenUse: 'refresh',
            tokenVersion: tv,
            exp: REFRESH_TOKEN_EXP,
        });

        auth?.set({
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
        });

        return createResponse({ token, refreshToken }, 'Token refreshed');
    }, {
        body: t.Object({ refreshToken: t.String() }),
        detail: { summary: 'Exchange a refresh token for a new access token', tags: ['Auth'] }
    })
    // Log out of every device/session: bumps the user's tokenVersion so all
    // existing access + refresh tokens stop validating immediately.
    .post('/logout-all', async ({ user, cookie: { auth } }) => {
        if (!user?.id) throw new UnauthorizedError('Not signed in');
        await IamService.logoutAllDevices(user.id);
        auth?.remove();
        return createResponse({ success: true }, 'Signed out of all devices');
    }, { isSignedIn: true, detail: { summary: 'Log out of all devices', tags: ['Auth'] } })
    .post('/verify-otp', async ({ body, jwt, cookie: { auth }, request }) => {
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const { user, permissions } = await IamService.verifyOTP(body.userId, body.otp, ipAddress);

        const token = await jwt.sign({
            id: user.id,
            hotelId: user.hotelId,
            type: user.userType,
            permissions: permissions as string[],
            tokenVersion: (user as any).tokenVersion ?? 0,
            exp: ACCESS_TOKEN_EXP,
        });
        const refreshToken = await jwt.sign({
            id: user.id,
            tokenUse: 'refresh',
            tokenVersion: (user as any).tokenVersion ?? 0,
            exp: REFRESH_TOKEN_EXP,
        });

        auth?.set({
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: "/",
        });

        return createResponse({
            token,
            refreshToken,
            user: {
                id: user.id,
                name: user.fullName,
                role: user.role?.name
            }
        }, '2FA Verification Successful');
    }, {
        body: t.Object({
            userId: t.String(),
            otp: s.fixedLengthString(6)
        }),
        detail: {
            summary: 'Verify OTP for Super Admin 2FA',
            tags: ['Auth']
        }
    })
    .post('/register', async ({ body, user, set, request }) => {
        if (!user || !user.hotelId) {
            throw new UnauthorizedError('User must be associated with a hotel');
        }

        const ipAddress = request.headers.get('x-forwarded-for') || undefined;

        const newUser = await IamService.register(
            user.hotelId,
            body,
            user.id,
            ipAddress
        );

        return createResponse(newUser, 'New user registered successfully.');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.CREATE,
        body: t.Object({
            fullName: t.String(),
            email: t.String(),
            phone: t.String(),
            password: s.string({ minLength: 6 }),
            roleId: s.positiveInteger(),
        }),
        detail: {
            summary: 'Register a new user.',
            tags: ['IAM']
        }
    })
    .post('/change-password', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();
        if (user.type === 'GUEST' || user.id.startsWith('guest-')) throw new ForbiddenError('Not available for guest portal sessions');

        await IamService.changePassword(user.id, body.currentPassword, body.newPassword);

        return createResponse(null, 'Password changed successfully');
    }, {
        isSignedIn: true,
        body: t.Object({
            currentPassword: t.String(),
            newPassword: s.string({ minLength: 6 })
        }),
        detail: {
            summary: 'Change own password',
            tags: ['Auth']
        }
    })

    .post('/verify-password', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();
        if (user.type === 'GUEST' || user.id.startsWith('guest-')) throw new ForbiddenError('Not available for guest portal sessions');
        await IamService.verifyPassword(user.id, body.password);
        return createResponse({ success: true }, 'Password verified');
    }, {
        isSignedIn: true,
        body: t.Object({ password: t.String() }),
        detail: { summary: 'Verify current password', tags: ['Auth'] }
    })
    .get('/profile', async ({ user }) => {
        if (!user) throw new UnauthorizedError();

        if (user.type === 'GUEST' || user.id.startsWith('guest-')) {
            const profile = IamService.buildGuestProfile({
                id: user.id,
                hotelId: user.hotelId,
                roomId: user.roomId,
                permissions: user.permissions,
            });
            return createResponse(profile, 'Profile fetched successfully');
        }

        const profile = await IamService.getProfile(user.id);

        return createResponse(profile, 'Profile fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get own profile', tags: ['Auth'] }
    })
    .put('/profile', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();
        if (user.type === 'GUEST' || user.id.startsWith('guest-')) throw new ForbiddenError('Not available for guest portal sessions');

        const updatedProfile = await IamService.updateProfile(user.id, body);

        return createResponse(updatedProfile, 'Profile updated successfully');
    }, {
        isSignedIn: true,
        body: t.Object({
            fullName: t.String(),
            phone: t.String()
        }),
        detail: {
            summary: 'Update own profile',
            tags: ['Auth']
        }
    });
