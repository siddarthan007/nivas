/**
 * Lightweight client-side export helpers. CSV opens directly in Excel/Sheets;
 * PDF is handled via the browser print dialog (Save as PDF) so no server round
 * trip or heavy dependency is needed.
 */

type Cell = string | number | null | undefined;

function escapeCsv(value: Cell): string {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a 2D array of rows. */
export function rowsToCsv(rows: Cell[][]): string {
    return rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');
}

/** Trigger a download of the given rows as a UTF-8 CSV (BOM for Excel). */
export function exportToCsv(filename: string, rows: Cell[][]): void {
    const csv = '﻿' + rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export an array of objects as CSV using the given column definitions.
 * Each column maps a header label to an accessor over the row.
 */
export function exportObjectsToCsv<T>(
    filename: string,
    columns: { header: string; value: (row: T) => Cell }[],
    data: T[]
): void {
    const header = columns.map(c => c.header);
    const body = data.map(row => columns.map(c => c.value(row)));
    exportToCsv(filename, [header, ...body]);
}

/** Open the browser print dialog (user can Save as PDF). */
export function printCurrentView(): void {
    if (typeof window !== 'undefined') window.print();
}
