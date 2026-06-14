import { db } from '../../db';
import { housekeepingTasks, rooms, bookings } from '../../db/schema';
import { eq, and, desc, or, inArray } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../utils/errors';
import { EventBus } from '../../shared/event-bus';
import { AuditService } from '../system/audit.service';
import { WSService } from '../notifications/ws.service';

async function syncRoomAfterHousekeeping(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    hotelId: number,
    roomId: number,
) {
    const activeStay = await tx.query.bookings.findFirst({
        where: and(
            eq(bookings.roomId, roomId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.status, 'CHECKED_IN'),
        ),
        columns: { id: true },
    });
    if (activeStay) return;

    const openTask = await tx.query.housekeepingTasks.findFirst({
        where: and(
            eq(housekeepingTasks.roomId, roomId),
            eq(housekeepingTasks.hotelId, hotelId),
            inArray(housekeepingTasks.status, ['PENDING', 'IN_PROGRESS']),
        ),
        columns: { id: true },
    });

    const room = await tx.query.rooms.findFirst({
        where: and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)),
        columns: { status: true },
    });
    if (!room) return;

    if (!openTask) {
        if (room.status === 'CLEANING' || room.status === 'DIRTY') {
            await tx.update(rooms)
                .set({ status: 'AVAILABLE', updatedAt: new Date() })
                .where(and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)));
        }
    } else if (room.status !== 'CLEANING' && room.status !== 'OCCUPIED') {
        await tx.update(rooms)
            .set({ status: 'CLEANING', updatedAt: new Date() })
            .where(and(eq(rooms.id, roomId), eq(rooms.hotelId, hotelId)));
    }
}

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
        // Verify the room belongs to this hotel before touching it.
        const room = await db.query.rooms.findFirst({
            where: and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId))
        });
        if (!room) throw new NotFoundError('Room');

        let resolvedBookingId = data.bookingId;

        // Auto-link current booking for the room if not explicitly provided
        if (!resolvedBookingId) {
            const activeBooking = await db.query.bookings.findFirst({
                where: and(
                    eq(bookings.roomId, data.roomId),
                    eq(bookings.hotelId, hotelId),
                    or(
                        eq(bookings.status, 'CHECKED_IN'),
                        eq(bookings.status, 'CONFIRMED')
                    )
                ),
                orderBy: [desc(bookings.checkIn)],
                columns: { id: true }
            });
            if (activeBooking) {
                resolvedBookingId = activeBooking.id;
            }
        }

        const newTask = await db.transaction(async (tx) => {
            const [task] = await tx.insert(housekeepingTasks).values({
                hotelId,
                roomId: data.roomId,
                assignedToId: data.assignedToId,
                taskType: data.taskType,
                priority: data.priority,
                notes: data.notes,
                bookingId: resolvedBookingId,
                status: 'PENDING',
                createdById: userId
            }).returning();

            if (!task) {
                throw new BusinessLogicError('Failed to create housekeeping task');
            }

            // Only mark room as CLEANING if no guest is currently checked in.
            // Mid-stay tasks (towels, amenities) must NOT mark an occupied room as cleaning.
            const activeStay = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.roomId, data.roomId),
                    eq(bookings.hotelId, hotelId),
                    eq(bookings.status, 'CHECKED_IN')
                )
            });
            if (!activeStay) {
                await tx.update(rooms)
                    .set({ status: 'CLEANING' })
                    .where(and(eq(rooms.id, data.roomId), eq(rooms.hotelId, hotelId)));
            }

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
        const ALLOWED = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DONE', 'CANCELLED'];
        if (!ALLOWED.includes(status)) throw new ValidationError(`Invalid task status: ${status}`);

        const updatedTask = await db.transaction(async (tx) => {
            // Block changes out of a terminal state (no re-opening a finalized task,
            // and no re-running the room-free logic by re-completing).
            const current = await tx.query.housekeepingTasks.findFirst({
                where: and(eq(housekeepingTasks.id, taskId), eq(housekeepingTasks.hotelId, hotelId)),
                columns: { status: true },
            });
            if (!current) return null;
            if (['COMPLETED', 'DONE', 'CANCELLED'].includes(current.status || '')) {
                throw new BusinessLogicError(`Task is already ${current.status?.toLowerCase()} and cannot be changed`);
            }

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

            if (status === 'COMPLETED' || status === 'DONE' || status === 'CANCELLED') {
                await syncRoomAfterHousekeeping(tx, hotelId, task.roomId);
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

        if (updatedTask.roomId) {
            WSService.broadcastToGuestRoom(hotelId, updatedTask.roomId, 'GUEST_SERVICE_UPDATE', {
                taskId: taskId.toString(),
                taskType: updatedTask.taskType,
                status,
            });
        }

        if (updatedTask.roomId && (status === 'COMPLETED' || status === 'DONE')) {
            EventBus.emit({
                type: 'HousekeepingTaskCompleted',
                hotelId,
                source: 'housekeeping',
                timestamp: new Date(),
                payload: { taskId: taskId.toString(), roomId: updatedTask.roomId },
            }).catch(() => {});
        }

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
        const deleted = await db.transaction(async (tx) => {
            const [row] = await tx.delete(housekeepingTasks)
                .where(and(eq(housekeepingTasks.id, taskId), eq(housekeepingTasks.hotelId, hotelId)))
                .returning();
            if (!row) return null;
            await syncRoomAfterHousekeeping(tx, hotelId, row.roomId);
            return row;
        });
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
