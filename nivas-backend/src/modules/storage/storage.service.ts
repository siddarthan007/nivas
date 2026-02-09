import { join } from 'path';
import { mkdir } from 'fs/promises';
import { ValidationError, BusinessLogicError } from '../../utils/errors';

const UPLOAD_DIR = './public/uploads';

export const StorageService = {
    async uploadFile(file: File, hotelId: number, allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'], maxSize: number = 5 * 1024 * 1024) {
        if (!file) {
            throw new ValidationError('No file provided');
        }

        // Validate file type
        if (!allowedTypes.includes(file.type)) {
            throw new ValidationError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
        }

        // Validate file size
        if (file.size > maxSize) {
            throw new ValidationError(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
        }

        // Organize by hotel to prevent cross-tenant access
        const hotelDir = join(UPLOAD_DIR, hotelId.toString());

        try {
            await mkdir(hotelDir, { recursive: true });
        } catch (error) {
            throw new BusinessLogicError('Failed to create storage directory');
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const filename = `${uniqueSuffix}.${extension}`;
        const filePath = join(hotelDir, filename);

        try {
            await Bun.write(filePath, file);
        } catch (error) {
            throw new BusinessLogicError('Failed to save file');
        }

        // URL includes hotel ID for security tracking
        const url = `/uploads/${hotelId}/${filename}`;

        return {
            url,
            filename,
            mimetype: file.type,
            size: file.size
        };
    }
};
