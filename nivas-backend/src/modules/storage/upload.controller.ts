import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { StorageService } from './storage.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const uploadController = new Elysia({ prefix: '/storage' })
    .use(authMiddleware)
    .post('/upload', async ({ body, user }) => {
        // Super-admin (no hotelId) uploads platform assets (e.g. tenant logos) →
        // bucket them under prefix 0. Hotel staff use their own hotelId prefix.
        const prefix = user?.hotelId ?? 0;
        const result = await StorageService.uploadFile(body.file, prefix);
        return createResponse(result, 'File uploaded successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.STORAGE.UPLOAD,
        body: t.Object({
            file: t.File()
        }),
        detail: {
            summary: 'Upload a file (Image/PDF)',
            tags: ['Storage']
        }
    });