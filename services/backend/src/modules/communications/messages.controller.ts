import { Elysia, t } from 'elysia';
import { s } from '../../lib/schema';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { MessagesService } from './messages.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const messagesController = new Elysia({ prefix: '/messages' })
    .use(authMiddleware)
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const msg = await MessagesService.sendMessage(user.hotelId, user.id, body);
        return createResponse(msg, 'Message sent successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        body: t.Object({
            receiverId: t.Optional(t.String()),
            roomId: t.Optional(t.Number()),
            content: s.string({ minLength: 1, maxLength: 5000 }),
            messageType: t.Optional(t.Union([
                t.Literal('TEXT'), t.Literal('ANNOUNCEMENT'), t.Literal('ALERT'), t.Literal('TASK'),
            ]))
        }),
        detail: {
            summary: 'Send a message',
            tags: ['Communications']
        }
    })
    .get('/inbox', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const inbox = await MessagesService.getUserInbox(user.hotelId, user.id);
        return createResponse(inbox, 'Inbox fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        detail: { summary: 'Get user inbox', tags: ['Communications'] }
    })
    .get('/conversations', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const conversations = await MessagesService.getConversations(user.hotelId, user.id);
        return createResponse(conversations, 'Conversations fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        detail: { summary: 'Get conversation threads', tags: ['Communications'] }
    })
    .get('/conversations/:participantId', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await MessagesService.getConversationById(user.hotelId, user.id, params.participantId);
        return createResponse(result, 'Conversation loaded');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        detail: { summary: 'Get conversation with a specific user', tags: ['Communications'] }
    })
    .patch('/conversations/:participantId/read', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await MessagesService.markConversationAsRead(user.hotelId, user.id, params.participantId);
        return createResponse(result, 'Conversation marked as read');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        detail: { summary: 'Mark all messages in a conversation as read', tags: ['Communications'] }
    })
    .get('/staff', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const staff = await MessagesService.getStaffList(user.hotelId, user.id);
        return createResponse(staff, 'Staff list fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        detail: { summary: 'Get staff list for new conversation', tags: ['Communications'] }
    })
    .patch('/:id/read', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await MessagesService.markAsRead(user.hotelId, user.id, params.id);
        return createResponse(updated, 'Message marked as read');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES,
        detail: { summary: 'Mark message as read', tags: ['Communications'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await MessagesService.deleteMessage(user.hotelId, user.id, params.id);
        return createResponse(null, 'Message deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.COMMUNICATIONS.SEND_MESSAGE,
        detail: { summary: 'Delete a message', tags: ['Communications'] }
    });
