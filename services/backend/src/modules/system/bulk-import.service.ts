import { db } from '../../db';
import { rooms } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { MenuService } from '../menu/menu.service';
import { RoomsService } from '../rooms/rooms.service';

export interface RowError { row: number; field: string; message: string }
export interface ImportResult { imported: number; errors: RowError[]; previewCount: number }

const str = (v: any) => (v == null ? '' : String(v)).trim();
const num = (v: any) => { const n = Number(str(v)); return Number.isFinite(n) ? n : NaN; };

/**
 * Strict CSV bulk import. Validates EVERY row first and imports nothing unless
 * the whole file is valid (all-or-nothing) — so a partial/garbage file never
 * pollutes the catalogue. Images are intentionally not importable here.
 */
export const BulkImportService = {
    MENU_COLUMNS: ['name', 'price', 'category', 'description'] as const,
    ROOM_COLUMNS: ['number', 'type', 'rate', 'name', 'capacity', 'floorNumber'] as const,

    async importMenu(hotelId: number, rows: any[]): Promise<ImportResult> {
        const errors: RowError[] = [];
        if (!Array.isArray(rows) || rows.length === 0) {
            return { imported: 0, errors: [{ row: 0, field: 'file', message: 'No rows found in the file' }], previewCount: 0 };
        }
        if (rows.length > 2000) {
            return { imported: 0, errors: [{ row: 0, field: 'file', message: 'Too many rows (max 2000 per import)' }], previewCount: rows.length };
        }

        const cleaned: { name: string; price: number; category?: string; description?: string }[] = [];
        const seenNames = new Set<string>();
        rows.forEach((raw, i) => {
            const line = i + 2; // +1 for 0-index, +1 for header row
            const name = str(raw.name);
            const price = num(raw.price);
            const category = str(raw.category);
            const description = str(raw.description);

            if (!name) errors.push({ row: line, field: 'name', message: 'Name is required' });
            else if (name.length > 120) errors.push({ row: line, field: 'name', message: 'Name exceeds 120 characters' });
            else if (seenNames.has(name.toLowerCase())) errors.push({ row: line, field: 'name', message: `Duplicate name in file: "${name}"` });

            if (str(raw.price) === '') errors.push({ row: line, field: 'price', message: 'Price is required' });
            else if (isNaN(price)) errors.push({ row: line, field: 'price', message: `Price is not a number: "${raw.price}"` });
            else if (price <= 0) errors.push({ row: line, field: 'price', message: 'Price must be greater than 0' });

            if (name && !isNaN(price) && price > 0) {
                seenNames.add(name.toLowerCase());
                cleaned.push({ name, price, category: category || undefined, description: description || undefined });
            }
        });

        if (errors.length > 0) return { imported: 0, errors, previewCount: rows.length };

        await MenuService.createBulkItems(hotelId, cleaned);
        return { imported: cleaned.length, errors: [], previewCount: rows.length };
    },

    async importRooms(hotelId: number, rows: any[]): Promise<ImportResult> {
        const errors: RowError[] = [];
        if (!Array.isArray(rows) || rows.length === 0) {
            return { imported: 0, errors: [{ row: 0, field: 'file', message: 'No rows found in the file' }], previewCount: 0 };
        }
        if (rows.length > 2000) {
            return { imported: 0, errors: [{ row: 0, field: 'file', message: 'Too many rows (max 2000 per import)' }], previewCount: rows.length };
        }

        // Existing room numbers for this hotel (block collisions).
        const existing = await db.query.rooms.findMany({ where: eq(rooms.hotelId, hotelId), columns: { number: true } });
        const existingNumbers = new Set(existing.map(r => Number(r.number)));

        const cleaned: { number: number; type: string; rate: number; name?: string; capacity?: number; floorNumber?: number }[] = [];
        const seenNumbers = new Set<number>();
        rows.forEach((raw, i) => {
            const line = i + 2;
            const numberRaw = str(raw.number);
            const number = num(raw.number);
            const type = str(raw.type);
            const rate = num(raw.rate);
            const name = str(raw.name);
            const capRaw = str(raw.capacity);
            const capacity = capRaw === '' ? undefined : num(raw.capacity);
            const floorRaw = str(raw.floorNumber);
            const floorNumber = floorRaw === '' ? undefined : num(raw.floorNumber);

            if (numberRaw === '') errors.push({ row: line, field: 'number', message: 'Room number is required' });
            else if (isNaN(number) || !Number.isInteger(number) || number <= 0) errors.push({ row: line, field: 'number', message: `Room number must be a positive integer: "${raw.number}"` });
            else if (seenNumbers.has(number)) errors.push({ row: line, field: 'number', message: `Duplicate room number in file: ${number}` });
            else if (existingNumbers.has(number)) errors.push({ row: line, field: 'number', message: `Room ${number} already exists` });

            if (!type) errors.push({ row: line, field: 'type', message: 'Room type is required' });

            if (str(raw.rate) === '') errors.push({ row: line, field: 'rate', message: 'Rate is required' });
            else if (isNaN(rate)) errors.push({ row: line, field: 'rate', message: `Rate is not a number: "${raw.rate}"` });
            else if (rate < 0) errors.push({ row: line, field: 'rate', message: 'Rate cannot be negative' });

            if (capacity !== undefined && (isNaN(capacity) || capacity < 1 || capacity > 30)) errors.push({ row: line, field: 'capacity', message: 'Capacity must be between 1 and 30' });
            if (floorNumber !== undefined && isNaN(floorNumber)) errors.push({ row: line, field: 'floorNumber', message: 'Floor number must be a number' });

            const rowOk = numberRaw !== '' && Number.isInteger(number) && number > 0 && !seenNumbers.has(number) && !existingNumbers.has(number)
                && !!type && str(raw.rate) !== '' && !isNaN(rate) && rate >= 0
                && (capacity === undefined || (!isNaN(capacity) && capacity >= 1 && capacity <= 30));
            if (rowOk) {
                seenNumbers.add(number);
                cleaned.push({ number, type, rate, name: name || undefined, capacity: capacity ?? undefined, floorNumber: floorNumber ?? undefined });
            }
        });

        if (errors.length > 0) return { imported: 0, errors, previewCount: rows.length };

        await RoomsService.bulkCreateRooms(hotelId, cleaned);
        return { imported: cleaned.length, errors: [], previewCount: rows.length };
    },
};
