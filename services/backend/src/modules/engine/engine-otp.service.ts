import { randomInt } from 'node:crypto';
import { getRedis } from '../../shared/redis';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { BusinessLogicError } from '../../utils/errors';

const OTP_TTL = 600;        // code valid 10 min
const RESEND_COOLDOWN = 45; // seconds between requests per contact
const MAX_VERIFY_FAILS = 6; // lock after this many wrong tries

const otpKey = (hotelId: number, c: string) => `engine:otp:${hotelId}:${c.toLowerCase()}`;
const cdKey = (hotelId: number, c: string) => `engine:otpcd:${hotelId}:${c.toLowerCase()}`;
const failKey = (hotelId: number, c: string) => `engine:otpfail:${hotelId}:${c.toLowerCase()}`;

/**
 * Email/SMS OTP for the public booking engine — bots can't create bookings
 * without proving control of a real contact. Requires Redis (the OTP store).
 */
export const EngineOtpService = {
    async request(hotelId: number, contact: string, channel: 'email' | 'sms') {
        const redis = getRedis();
        if (!redis || redis.status !== 'ready') throw new BusinessLogicError('Verification is temporarily unavailable');
        if (!contact || contact.length < 5) throw new BusinessLogicError('A valid email or phone is required');

        if (await redis.get(cdKey(hotelId, contact))) {
            throw new BusinessLogicError('Please wait a moment before requesting another code');
        }

        const code = String(randomInt(100000, 1000000)); // 6 digits
        await redis.set(otpKey(hotelId, contact), code, 'EX', OTP_TTL);
        await redis.set(cdKey(hotelId, contact), '1', 'EX', RESEND_COOLDOWN);
        await redis.del(failKey(hotelId, contact));

        if (channel === 'email') {
            await NotificationChannelService.sendBrandedEmail(hotelId, contact, 'Your verification code', {
                heading: 'Verify your booking',
                intro: 'Use this code to confirm your booking. It expires in 10 minutes.',
                highlight: code,
                footerNote: 'If you did not request this, you can safely ignore this email.',
            });
        } else {
            await NotificationChannelService.send(hotelId, contact, undefined, `Your booking verification code is ${code}. Valid 10 minutes.`);
        }

        return { sent: true, cooldownSeconds: RESEND_COOLDOWN };
    },

    /** Verify + consume the code. Locks the contact after too many wrong tries. */
    async verify(hotelId: number, contact: string, code: string): Promise<boolean> {
        const redis = getRedis();
        if (!redis || redis.status !== 'ready') return false;

        const fails = parseInt((await redis.get(failKey(hotelId, contact))) || '0');
        if (fails >= MAX_VERIFY_FAILS) return false;

        const stored = await redis.get(otpKey(hotelId, contact));
        if (stored && stored === code) {
            await redis.del(otpKey(hotelId, contact));
            await redis.del(failKey(hotelId, contact));
            return true;
        }
        await redis.set(failKey(hotelId, contact), String(fails + 1), 'EX', OTP_TTL);
        return false;
    },
};
