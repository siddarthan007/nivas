import { db } from '../../db';
import { staffAttendance, users } from '../../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';

// Default shift start time for late detection (9:00 AM)
const DEFAULT_SHIFT_START_HOUR = 9;
const DEFAULT_SHIFT_START_MINUTE = 0;

// Standard work hours per day (8 hours)
const STANDARD_WORK_HOURS = 8;

// Helper function to determine if clock-in is late
const isLateClockIn = (clockIn: Date): boolean => {
    const clockInHour = clockIn.getHours();
    const clockInMinute = clockIn.getMinutes();
    return clockInHour > DEFAULT_SHIFT_START_HOUR || 
           (clockInHour === DEFAULT_SHIFT_START_HOUR && clockInMinute > DEFAULT_SHIFT_START_MINUTE);
};

// Helper function to determine attendance status
const determineStatus = (clockIn: Date | null, clockOut: Date | null): 'PRESENT' | 'ABSENT' | 'LATE' => {
    if (!clockIn) return 'ABSENT';
    if (isLateClockIn(clockIn)) return 'LATE';
    return 'PRESENT';
};

// Helper function to calculate overtime hours
const calculateOvertime = (durationMinutes: number): number => {
    const durationHours = durationMinutes / 60;
    return Math.max(0, durationHours - STANDARD_WORK_HOURS);
};

const toIso = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    return new Date(value).toISOString();
};

const toDateOnly = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    return new Date(value).toISOString().split('T')[0] ?? null;
};

const serializeAttendanceEntry = (entry: {
    id: string;
    userId?: string;
    hotelId?: number;
    clockIn?: Date | string | null;
    clockOut?: Date | string | null;
    date?: Date | string | null;
    approvalStatus?: string | null;
    notes?: string | null;
    approvedAt?: Date | string | null;
    approvedBy?: string | null;
    status?: string | null;
} | null | undefined) => {
    if (!entry) return null;
    return {
        id: entry.id,
        ...(entry.userId != null ? { userId: entry.userId } : {}),
        ...(entry.hotelId != null ? { hotelId: entry.hotelId } : {}),
        clockIn: toIso(entry.clockIn),
        clockOut: toIso(entry.clockOut),
        date: toDateOnly(entry.date),
        approvalStatus: entry.approvalStatus ?? null,
        notes: entry.notes ?? null,
        approvedAt: toIso(entry.approvedAt),
        approvedBy: entry.approvedBy ?? null,
        status: entry.status ?? null,
    };
};

export const AttendanceService = {
    async getMyStatus(hotelId: number, userId: string) {
        const today = new Date().toISOString().split('T')[0];
        const active = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.userId, userId),
                isNull(staffAttendance.clockOut),
            ),
            orderBy: [sql`${staffAttendance.clockIn} DESC`],
        });
        const todayEntry = await db.query.staffAttendance.findFirst({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.userId, userId),
                eq(staffAttendance.date, sql`${today}::date`),
            ),
        });
        return {
            isClockedIn: !!active,
            currentEntry: serializeAttendanceEntry(active),
            todayEntry: serializeAttendanceEntry(todayEntry),
        };
    },

    async getPendingApprovals(hotelId: number, date?: string) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const rows = await db.query.staffAttendance.findMany({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.date, sql`${targetDate}::date`),
                eq(staffAttendance.approvalStatus, 'PENDING'),
            ),
            with: {
                user: { columns: { id: true, fullName: true }, with: { role: { columns: { name: true } } } },
            },
            orderBy: [sql`${staffAttendance.clockIn} ASC`],
        });
        return rows.map(r => ({
            id: r.id,
            staffId: r.userId,
            staffName: (r as any).user?.fullName || 'Staff',
            department: (r as any).user?.role?.name || 'General',
            clockIn: toIso(r.clockIn),
            clockOut: toIso(r.clockOut),
            approvalStatus: r.approvalStatus,
            notes: r.notes,
        }));
    },

    async approveEntry(hotelId: number, entryId: string, approverId: string) {
        const [row] = await db.update(staffAttendance)
            .set({ approvalStatus: 'APPROVED', approvedById: approverId, approvedAt: new Date() })
            .where(and(eq(staffAttendance.id, entryId), eq(staffAttendance.hotelId, hotelId)))
            .returning();
        if (!row) throw new NotFoundError('Attendance entry');
        return row;
    },

    async rejectEntry(hotelId: number, entryId: string, approverId: string, notes?: string) {
        const [row] = await db.update(staffAttendance)
            .set({
                approvalStatus: 'REJECTED',
                approvedById: approverId,
                approvedAt: new Date(),
                notes: notes || 'Rejected by manager',
            })
            .where(and(eq(staffAttendance.id, entryId), eq(staffAttendance.hotelId, hotelId)))
            .returning();
        if (!row) throw new NotFoundError('Attendance entry');
        return row;
    },

    async getApprovedHoursForPeriod(hotelId: number, userId: string, periodStart: string, periodEnd: string) {
        const rows = await db.query.staffAttendance.findMany({
            where: and(
                eq(staffAttendance.hotelId, hotelId),
                eq(staffAttendance.userId, userId),
                eq(staffAttendance.approvalStatus, 'APPROVED'),
                sql`${staffAttendance.date} >= ${periodStart}::date`,
                sql`${staffAttendance.date} <= ${periodEnd}::date`,
            ),
        });
        let totalMinutes = 0;
        let overtimeHours = 0;
        for (const row of rows) {
            if (!row.clockIn || !row.clockOut) continue;
            const mins = Math.round((new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 60000);
            totalMinutes += mins;
            overtimeHours += calculateOvertime(mins);
        }
        return {
            daysPresent: rows.length,
            totalHours: Math.round((totalMinutes / 60) * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
        };
    },

    async clockIn(hotelId: number, userId: string, notes?: string) {
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
            clockIn: new Date(),
            approvalStatus: 'PENDING',
        }).returning();

        if (notes && entry) {
            await db.update(staffAttendance).set({ notes }).where(eq(staffAttendance.id, entry.id));
            entry.notes = notes;
        }

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
                notes: notes ? (activeSession.notes ? `${activeSession.notes}; ${notes}` : notes) : activeSession.notes,
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
            const clockInDate = entry.clockIn ? new Date(entry.clockIn) : null;
            const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;
            const status = determineStatus(clockInDate, clockOutDate);
            const duration = clockInDate && clockOutDate
                ? Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000)
                : 0;
            const overtime = calculateOvertime(duration);
            return {
                id: entry.id,
                staffId: entry.userId,
                staffName: user?.fullName || 'Unknown Staff',
                department: user?.role?.name || 'General',
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                status,
                approvalStatus: entry.approvalStatus || 'PENDING',
                notes: entry.notes,
                duration,
                overtime
            };
        });

        const stats = {
            present: entries.filter(e => e.status === 'PRESENT').length,
            absent: entries.filter(e => e.status === 'ABSENT').length,
            late: entries.filter(e => e.status === 'LATE').length,
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
            const clockInDate = entry.clockIn ? new Date(entry.clockIn) : null;
            const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;
            const status = determineStatus(clockInDate, clockOutDate);
            const duration = clockInDate && clockOutDate
                ? Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000)
                : 0;
            const overtime = calculateOvertime(duration);
            return {
                id: entry.id,
                staffId: entry.userId,
                staffName: user?.fullName || 'Unknown Staff',
                department: user?.role?.name || 'General',
                clockIn: toIso(entry.clockIn),
                clockOut: toIso(entry.clockOut),
                date: toDateOnly(entry.date) ?? '',
                status,
                approvalStatus: entry.approvalStatus || 'PENDING',
                notes: entry.notes,
                duration,
                overtime
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
            const clockInDate = entry.clockIn ? new Date(entry.clockIn) : null;
            const clockOutDate = entry.clockOut ? new Date(entry.clockOut) : null;
            const status = determineStatus(clockInDate, clockOutDate);
            attendanceMap.set(dateStr, {
                id: entry.id,
                clockIn: entry.clockIn,
                clockOut: entry.clockOut,
                status,
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
        if (status !== 'ABSENT') {
            await db.update(staffAttendance)
                .set({ approvalStatus: 'APPROVED', approvedAt: new Date() })
                .where(eq(staffAttendance.id, entry!.id));
        }

        return entry;
    }
};
