import { db } from '../../db';
import { staffAttendance } from '../../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';

export const AttendanceService = {
    async clockIn(hotelId: number, userId: string) {
        const today = new Date().toISOString().split('T')[0];

        const existing = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.userId, userId),
                isNull(staffAttendance.clockOut)
            )
        });

        if (existing) {
            throw new BusinessLogicError('You are already clocked in');
        }

        const [entry] = await db.insert(staffAttendance).values({
            hotelId,
            userId,
            date: sql`${today}::date`,
            clockIn: new Date()
        }).returning();

        return entry;
    },

    async clockOut(hotelId: number, userId: string, notes?: string) {
        const activeSession = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.userId, userId),
                isNull(staffAttendance.clockOut)
            )
        });

        if (!activeSession) {
            throw new NotFoundError('Active session');
        }

        const [entry] = await db.update(staffAttendance)
            .set({
                clockOut: new Date(),
                notes: notes
            })
            .where(eq(staffAttendance.id, activeSession.id))
            .returning();

        return entry;
    },

    async getDailyAttendance(hotelId: number, date: string) {
        const rawEntries = await db.query.staffAttendance.findMany({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.date, sql`${date}::date`)
            ),
            with: {
                user: {
                    columns: { fullName: true, id: true },
                    with: {
                        role: { columns: { name: true } }
                    }
                }
            }
        });

        const entries = rawEntries.map(entry => ({
            id: entry.id,
            staffId: entry.userId,
            staffName: (entry.user && entry.user.fullName) ? entry.user.fullName : 'Unknown Staff',
            department: (entry.user as any)?.role?.name || 'General',
            clockIn: entry.clockIn,
            clockOut: entry.clockOut,
            status: entry.clockIn && !entry.clockOut ? 'PRESENT' : 'ABSENT', // Simplified status logic
            notes: entry.notes,
            duration: 0 // Calculate if needed
        }));

        const stats = {
            present: entries.filter(e => e.status === 'PRESENT').length,
            absent: entries.filter(e => e.status === 'ABSENT').length,
            late: 0,
            onLeave: 0,
            total: entries.length
        };

        return { entries, stats };
    }
};
