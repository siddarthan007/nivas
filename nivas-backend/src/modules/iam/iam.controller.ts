import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { IamService } from './iam.service';
import { createResponse } from '../../utils/response.helper';
import { UnauthorizedError } from '../../utils/errors';

export const iamController = new Elysia({ prefix: '/iam' })
    .use(authMiddleware)
    .post('/login', async ({ body, jwt, cookie: { auth }, set, request }) => {
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const result = await IamService.login(body.email, body.password, ipAddress);

        if (result.require2FA) {
            return {
                status: 'success',
                require2FA: true,
                userId: result.userId,
                message: result.message,
                debugOtp: (result as any).debugOtp,
                testField: 'ALIVE' // Confirming reload
            };
        }

        const { user, permissions } = result;

        const token = await jwt.sign({
            id: user!.id,
            hotelId: user!.hotelId,
            type: user!.userType,
            permissions: permissions as string[]
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
            user: {
                id: user!.id,
                name: user!.fullName,
                role: user!.role?.name
            }
        }, 'Login successful');
    }, {
        body: t.Object({
            email: t.String(),
            password: t.String({ minLength: 6 }),
        }),
        detail: {
            summary: 'Login to get a JWT token.',
            tags: ['Auth']
        }
    })
    .post('/verify-otp', async ({ body, jwt, cookie: { auth }, request }) => {
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const { user, permissions } = await IamService.verifyOTP(body.userId, body.otp, ipAddress);

        const token = await jwt.sign({
            id: user.id,
            hotelId: user.hotelId,
            type: user.userType,
            permissions: permissions as string[]
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
            user: {
                id: user.id,
                name: user.fullName,
                role: user.role?.name
            }
        }, '2FA Verification Successful');
    }, {
        body: t.Object({
            userId: t.String(),
            otp: t.String({ minLength: 6, maxLength: 6 })
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
            password: t.String({ minLength: 6 }),
            roleId: t.Number(),
        }),
        detail: {
            summary: 'Register a new user.',
            tags: ['IAM']
        }
    })
    .post('/change-password', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();

        await IamService.changePassword(user.id, body.currentPassword, body.newPassword);

        return createResponse(null, 'Password changed successfully');
    }, {
        isSignedIn: true,
        body: t.Object({
            currentPassword: t.String(),
            newPassword: t.String({ minLength: 6 })
        }),
        detail: {
            summary: 'Change own password',
            tags: ['Auth']
        }
    })

    .post('/verify-password', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();
        await IamService.verifyPassword(user.id, body.password);
        return createResponse({ success: true }, 'Password verified');
    }, {
        isSignedIn: true,
        body: t.Object({ password: t.String() }),
        detail: { summary: 'Verify current password', tags: ['Auth'] }
    })
    .get('/profile', async ({ user }) => {
        if (!user) throw new UnauthorizedError();

        const profile = await IamService.getProfile(user.id);

        return createResponse(profile, 'Profile fetched successfully');
    }, {
        isSignedIn: true,
        detail: { summary: 'Get own profile', tags: ['Auth'] }
    })
    .put('/profile', async ({ body, user }) => {
        if (!user) throw new UnauthorizedError();

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