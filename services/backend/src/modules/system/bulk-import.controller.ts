import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { BulkImportService } from './bulk-import.service';

/**
 * Strict CSV bulk import for menu items and rooms. The client parses the CSV to
 * an array of row objects (keyed by header) and posts them; the server validates
 * EVERY row and imports nothing unless the whole file is valid.
 */
export const bulkImportController = new Elysia({ prefix: '/import' })
    .use(authMiddleware)

    .post('/menu', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await BulkImportService.importMenu(user.hotelId, body.rows);
        return createResponse(result, result.errors.length ? 'Validation failed — nothing imported' : `Imported ${result.imported} menu items`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.MENU.CREATE,
        body: t.Object({ rows: t.Array(t.Record(t.String(), t.Any()), { maxItems: 2000 }) }),
        detail: {
            summary: 'Bulk import menu items from CSV rows',
            description: 'Validates and imports menu items. Required columns: `name`, `price`. Optional: `category`, `description`. All-or-nothing: if any row is invalid, the response lists per-row errors and nothing is imported. Images are not importable.',
            tags: ['Bulk Import'],
        },
    })

    .post('/rooms', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await BulkImportService.importRooms(user.hotelId, body.rows);
        return createResponse(result, result.errors.length ? 'Validation failed — nothing imported' : `Imported ${result.imported} rooms`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ROOMS.CREATE,
        body: t.Object({ rows: t.Array(t.Record(t.String(), t.Any()), { maxItems: 2000 }) }),
        detail: {
            summary: 'Bulk import rooms from CSV rows',
            description: 'Validates and imports rooms. Required columns: `number` (unique positive integer), `type`, `rate`. Optional: `name`, `capacity` (1-30), `floorNumber`. All-or-nothing with per-row error reporting. Existing room numbers are rejected.',
            tags: ['Bulk Import'],
        },
    });
