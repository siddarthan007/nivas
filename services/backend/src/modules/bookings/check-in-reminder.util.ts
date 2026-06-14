/** Minutes until day-before-check-in at 18:00 (matches daily cron). Returns null if too late. */
export function computeCheckInReminderDelayMinutes(checkIn: Date | string, now = new Date()): number | null {
    const checkInDay = new Date(checkIn);
    if (Number.isNaN(checkInDay.getTime())) return null;
    checkInDay.setHours(0, 0, 0, 0);

    const reminderAt = new Date(checkInDay);
    reminderAt.setDate(reminderAt.getDate() - 1);
    reminderAt.setHours(18, 0, 0, 0);

    const diffMs = reminderAt.getTime() - now.getTime();
    if (diffMs <= 60_000) return null;
    return Math.ceil(diffMs / 60_000);
}
