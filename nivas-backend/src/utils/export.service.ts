import * as XLSX from 'xlsx';

/**
 * Data Export Service
 * Converts data to CSV and Excel formats for download
 */
export const ExportService = {
    /**
     * Convert array of objects to CSV string
     */
    toCSV(data: Record<string, unknown>[], columns?: string[]): string {
        if (data.length === 0) return '';

        const headers = columns || (data.length > 0 ? Object.keys(data[0] as object) : []);
        const rows = data.map(row =>
            headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );

        return [headers.join(','), ...rows].join('\n');
    },

    /**
     * Convert array of objects to Excel buffer (xlsx format)
     */
    toExcel(data: Record<string, unknown>[], sheetName: string = 'Sheet1'): Buffer {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Auto-size columns
        const maxLengths: number[] = [];
        if (data.length > 0) {
            const headers = Object.keys(data[0] as object);
            headers.forEach((h, _i) => {
                const headerLen = h.length;
                const maxDataLen = Math.max(
                    ...data.map(row => String(row[h] ?? '').length)
                );
                maxLengths[_i] = Math.min(Math.max(headerLen, maxDataLen) + 2, 50);
            });
            worksheet['!cols'] = maxLengths.map(w => ({ wch: w }));
        }

        return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    },

    /**
     * Convert multiple datasets to multi-sheet Excel
     */
    toExcelMultiSheet(sheets: { name: string; data: Record<string, unknown>[] }[]): Buffer {
        const workbook = XLSX.utils.book_new();

        for (const sheet of sheets) {
            const worksheet = XLSX.utils.json_to_sheet(sheet.data);
            // Auto-size columns
            if (sheet.data.length > 0) {
                const headers = Object.keys(sheet.data[0] as object);
                worksheet['!cols'] = headers.map((h, _i) => {
                    const headerLen = h.length;
                    const maxDataLen = Math.max(
                        ...sheet.data.map(row => String(row[h] ?? '').length)
                    );
                    return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
                });
            }
            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31)); // Sheet names max 31 chars
        }

        return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    },

    /**
     * Generate CSV response headers for download
     */
    csvHeaders(filename: string): Record<string, string> {
        return {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`
        };
    },

    /**
     * Generate Excel response headers for download
     */
    excelHeaders(filename: string): Record<string, string> {
        return {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`
        };
    }
};
