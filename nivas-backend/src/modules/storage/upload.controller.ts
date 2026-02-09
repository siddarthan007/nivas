import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { StorageService } from './storage.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const uploadController = new Elysia({ prefix: '/storage' })
    .use(authMiddleware)
    .post('/upload', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await StorageService.uploadFile(body.file, user.hotelId);
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