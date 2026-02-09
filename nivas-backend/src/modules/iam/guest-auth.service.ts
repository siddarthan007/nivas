import { db } from '../../db';
import { rooms } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ValidationError, UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';

export const GuestAuthService = {
    async login(token: string | undefined, roomNumber: string | undefined, pin: string, jwt: any) {
        if (!token && !roomNumber) {
            throw new ValidationError('Token or Room Number is required');
        }

        let room;

        if (token) {
            room = await db.query.rooms.findFirst({
                where: eq(rooms.qrToken, token),
            });
        } else if (roomNumber) {
            room = await db.query.rooms.findFirst({
                where: eq(rooms.number, parseInt(roomNumber)),
            });
        }

        if (!room) {
            throw new ValidationError('Invalid room or token');
        }

        if (room.currentGuestPin !== pin) {
            throw new UnauthorizedError('Invalid pin');
        }

        const accessToken = await jwt.sign({
            id: `guest-${room.id}`,
            hotelId: room.hotelId,
            roomId: room.id,
            type: 'GUEST',
            permissions: [PERMISSIONS.ORDERS.CREATE, PERMISSIONS.GUESTS.VIEW_DETAILS]
        });

        return {
            token: accessToken,
            room: {
                id: room.id,
                number: room.number,
                type: room.type
            }
        };
    }
};
