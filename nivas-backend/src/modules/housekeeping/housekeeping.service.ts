import { db } from '../../db';
import { housekeepingTasks, rooms } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { EventBus } from '../../shared/event-bus';
import { AuditService } from '../system/audit.service';

export class HousekeepingService {
    static async getTasks(hotelId: number) {
        return await db.query.housekeepingTasks.findMany({
            where: eq(housekeepingTasks.hotelId, hotelId),
            with: {
                room: true,
                assignedTo: {
                    columns: {
                        fullName: true,
                        phone: true
                    }
                },
                createdBy: {
                    columns: {
                        fullName: true
                    }
                }
            },
            orderBy: (tasks, { desc }) => [desc(tasks.createdAt)]
        });
    }

    static async createTask(hotelId: number, userId: string, data: { roomId: number; assignedToId?: string; taskType: string; priority: string; notes?: string; bookingId?: string }) {
        const newTask = await db.transaction(async (tx) => {
            const [task] = await tx.insert(housekeepingTasks).values({
                hotelId,
                roomId: data.roomId,
                assignedToId: data.assignedToId,
                taskType: data.taskType,
                priority: data.priority,
                notes: data.notes,
                bookingId: data.bookingId,
                status: 'PENDING',
                createdById: userId
            }).returning();

            if (!task) {
                throw new BusinessLogicError('Failed to create housekeeping task');
            }

            await tx.update(rooms)
                .set({ status: 'CLEANING' })
                .where(eq(rooms.id, data.roomId));

            return task;
        });

        if (!newTask) {
            throw new BusinessLogicError('Failed to create housekeeping task');
        }

        EventBus.emit({
            type: 'HousekeepingTaskCreated',
            hotelId,
            source: 'housekeeping',
            timestamp: new Date(),
            payload: {
                taskId: newTask.id.toString(),
                roomId: data.roomId,
                taskType: data.taskType,
                priority: data.priority,
            },
        }).catch(() => {});
        await AuditService.log(
            hotelId,
            userId,
            'CREATE_HOUSEKEEPING_TASK',
            'HOUSEKEEPING_TASK',
            newTask.id.toString(),
            { roomId: data.roomId, taskType: data.taskType, priority: data.priority }
        );

        return newTask;
    }

    static async updateStatus(hotelId: number, userId: string, taskId: number, status: string) {
        const updatedTask = await db.transaction(async (tx) => {
            const [task] = await tx.update(housekeepingTasks)
                .set({
                    status: status,
                    completedAt: (status === 'COMPLETED' || status === 'DONE') ? new Date() : null,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(housekeepingTasks.id, taskId),
                    eq(housekeepingTasks.hotelId, hotelId)
                ))
                .returning();

            if (!task) return null;

            if (status === 'COMPLETED' || status === 'DONE') {
                await tx.update(rooms)
                    .set({ status: 'AVAILABLE' })
                    .where(eq(rooms.id, task.roomId));
            }

            return task;
        });

        if (!updatedTask) throw new NotFoundError('Housekeeping Task');

        await AuditService.log(
            hotelId,
            userId,
            'UPDATE_HOUSEKEEPING_STATUS',
            'HOUSEKEEPING_TASK',
            taskId.toString(),
            { newStatus: status }
        );

        return updatedTask;
    }

    static async updateTask(hotelId: number, taskId: number, data: { assignedToId?: string; taskType?: string; priority?: string; notes?: string }) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
        if (data.taskType !== undefined) updateData.taskType = data.taskType;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.notes !== undefined) updateData.notes = data.notes;

        const [updated] = await db.update(housekeepingTasks)
            .set(updateData)
            .where(and(eq(housekeepingTasks.id, taskId), eq(housekeepingTasks.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Housekeeping Task');
        return updated;
    }

    static async deleteTask(hotelId: number, taskId: number) {
        const [deleted] = await db.delete(housekeepingTasks)
            .where(and(eq(housekeepingTasks.id, taskId), eq(housekeepingTasks.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Housekeeping Task');
        return deleted;
    }

    static async startTask(hotelId: number, taskId: number) {
        const [startedTask] = await db.update(housekeepingTasks)
            .set({
                status: 'IN_PROGRESS',
                startedAt: new Date(),
                updatedAt: new Date()
            })
            .where(and(
                eq(housekeepingTasks.id, taskId),
                eq(housekeepingTasks.hotelId, hotelId)
            ))
            .returning();

        if (!startedTask) throw new NotFoundError('Housekeeping Task');
        return startedTask;
    }
}
