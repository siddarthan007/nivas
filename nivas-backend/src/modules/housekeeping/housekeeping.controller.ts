import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { HousekeepingService } from './housekeeping.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const housekeepingController = new Elysia({ prefix: '/housekeeping' })
    .use(authMiddleware)
    .get('/', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const tasks = await HousekeepingService.getTasks(user.hotelId);
        return createResponse(tasks, 'Housekeeping tasks fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.MANAGE_CLEANING,
        detail: {
            summary: 'Get all housekeeping tasks',
            tags: ['Housekeeping']
        }
    })
    .post('/', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const newTask = await HousekeepingService.createTask(user.hotelId, user.id, body);
        return createResponse(newTask, 'Task assigned successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.MANAGE_CLEANING,
        body: t.Object({
            roomId: t.Number(),
            assignedToId: t.Optional(t.String()),
            taskType: t.String(),
            priority: t.String(),
            notes: t.Optional(t.String())
        }),
        detail: {
            summary: 'Assign housekeeping task',
            tags: ['Housekeeping']
        }
    })
    .patch('/:id/status', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updatedTask = await HousekeepingService.updateStatus(user.hotelId, user.id, parseInt(params.id), body.status);
        return createResponse(updatedTask, 'Task status updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.MANAGE_CLEANING,
        body: t.Object({
            status: t.Union([
                t.Literal('PENDING'),
                t.Literal('IN_PROGRESS'),
                t.Literal('COMPLETED'),
                t.Literal('DONE')
            ])
        }),
        detail: {
            summary: 'Update task status',
            tags: ['Housekeeping']
        }
    })
    .patch('/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await HousekeepingService.updateTask(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Task updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        body: t.Object({
            assignedToId: t.Optional(t.String()),
            taskType: t.Optional(t.String()),
            priority: t.Optional(t.String()),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Update housekeeping task', tags: ['Housekeeping'] }
    })
    .delete('/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await HousekeepingService.deleteTask(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Task deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        detail: { summary: 'Delete housekeeping task', tags: ['Housekeeping'] }
    })
    .patch('/:id/start', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const startedTask = await HousekeepingService.startTask(user.hotelId, parseInt(params.id));
        return createResponse(startedTask, 'Task started successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.UPDATE,
        detail: { summary: 'Start a cleaning task', tags: ['Housekeeping'] }
    });