import { db } from '../../db';
import { staffAttendance, users } from '../../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';

export const AttendanceService = {
    async clockIn(hotelId: number, userId: string) {
        const today = new Date().toISOString().split('T')[0];

        // Auto-close stale sessions from previous days
        const staleSessions = await db.query.staffAttendance.findMany({
            where: and(
                eq(staffAttendance.userId, userId),
                isNull(staffAttendance.clockOut)
            )
        });
        for (const stale of staleSessions) {
            const sessionDate = stale.date ? new Date(stale.date).toISOString().split('T')[0] : null;
            if (sessionDate && sessionDate !== today) {
                // Auto-close with end-of-day time
                await db.update(staffAttendance)
                    .set({ clockOut: new Date(sessionDate + 'T23:59:59'), notes: 'Auto-closed (missed clock-out)' })
                    .where(eq(staffAttendance.id, stale.id));
            }
        }

        // Check for existing today session
        const existing = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.userId, userId),
                eq(staffAttendance.date, sql`${today}::date`),
                isNull(staffAttendance.clockOut)
            )
        });

        if (existing) {
            throw new BusinessLogicError('You are already clocked in today');
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

        const entries = rawEntries.map(entry => {
            const user = (entry as any).user;
            return {
                id: entry.id,
                staffId: entry.userId,
                staffName: user?.fullName || 'Unknown Staff',
                department: user?.role?.name || 'General',
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                // Present if they clocked in at all (a completed shift has a
                // clock-out and must still count as PRESENT, not ABSENT).
                status: entry.clockIn ? 'PRESENT' : 'ABSENT',
                notes: entry.notes,
                duration: entry.clockIn && entry.clockOut
                    ? Math.round((new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 60000)
                    : 0
            };
        });

        const stats = {
            present: entries.filter(e => e.status === 'PRESENT').length,
            absent: entries.filter(e => e.status === 'ABSENT').length,
            late: 0,
            onLeave: 0,
            total: entries.length
        };

        return { entries, stats };
    },

    async getAttendanceHistory(hotelId: number, startDate?: string, endDate?: string, userId?: string) {
        const conditions: any[] = [eq(staffAttendance.hotelId, hotelId)];
        if (startDate) {
            conditions.push(sql`${staffAttendance.date} >= ${startDate}::date`);
        }
        if (endDate) {
            conditions.push(sql`${staffAttendance.date} <= ${endDate}::date`);
        }
        if (userId) {
            conditions.push(eq(staffAttendance.userId, userId));
        }

        const rawEntries = await db.query.staffAttendance.findMany({
            where: and(...conditions),
            with: {
                user: {
                    columns: { fullName: true, id: true },
                    with: {
                        role: { columns: { name: true } }
                    }
                }
            },
            orderBy: [sql`${staffAttendance.date} DESC`]
        });

        const entries = rawEntries.map(entry => {
            const user = (entry as any).user;
            return {
                id: entry.id,
                staffId: entry.userId,
                staffName: user?.fullName || 'Unknown Staff',
                department: user?.role?.name || 'General',
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : '',
                status: entry.clockIn && entry.clockOut ? 'PRESENT' : entry.clockIn && !entry.clockOut ? 'PRESENT' : 'ABSENT',
                notes: entry.notes,
                duration: entry.clockIn && entry.clockOut
                    ? Math.round((new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 60000)
                    : 0
            };
        });

        return { entries };
    },

    async getStaffMonthlySummary(hotelId: number, userId: string, year: number, month: number) {
        const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
        // Real last day of the month — `-31` produces an invalid date (e.g.
        // 2026-02-31) and throws in Postgres for short months.
        const lastDay = new Date(year, month, 0).getDate();
        const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const rawEntries = await db.query.staffAttendance.findMany({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.userId, userId),
                sql`${staffAttendance.date} >= ${startOfMonth}::date`,
                sql`${staffAttendance.date} <= ${endOfMonth}::date`
            ),
            orderBy: [staffAttendance.date]
        });

        const attendanceMap = new Map<string, any>();
        rawEntries.forEach(entry => {
            const dateStr = entry.date ? (new Date(entry.date).toISOString().split('T')[0] || '') : '';
            attendanceMap.set(dateStr, {
                id: entry.id,
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                status: entry.clockIn && entry.clockOut ? 'PRESENT' : entry.clockIn && !entry.clockOut ? 'PRESENT' : 'ABSENT',
                notes: entry.notes
            });
        });

        // Get staff info
        const staff = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { fullName: true },
            with: { role: { columns: { name: true } } }
        });
        const staffAny = staff as any;

        return {
            staffName: staffAny?.fullName || 'Unknown',
            department: staffAny?.role?.name || 'General',
            year,
            month,
            attendanceMap: Object.fromEntries(attendanceMap)
        };
    },

    async markAttendance(hotelId: number, targetUserId: string, date: string, status: 'PRESENT' | 'ABSENT' | 'LATE', notes?: string) {
        const existing = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.userId, targetUserId),
                eq(staffAttendance.date, sql`${date}::date`)
            )
        });

        if (existing) {
            // Update existing record
            const updateData: any = {
                notes: notes || existing.notes
            };
            if (status === 'ABSENT') {
                updateData.clockIn = null;
                updateData.clockOut = null;
            } else if (!existing.clockIn) {
                updateData.clockIn = new Date();
            }
            const [entry] = await db.update(staffAttendance)
                .set(updateData)
                .where(eq(staffAttendance.id, existing.id))
                .returning();
            return entry;
        }

        // Create new record
        const insertData: any = {
            hotelId,
            userId: targetUserId,
            date: sql`${date}::date`,
            notes: notes || undefined
        };
        if (status !== 'ABSENT') {
            insertData.clockIn = new Date();
        }
        const [entry] = await db.insert(staffAttendance).values(insertData).returning();

        return entry;
    }
};
