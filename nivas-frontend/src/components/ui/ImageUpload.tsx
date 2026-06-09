'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import Button from './Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ImageUploadProps {
    value?: string | null;
    onChange: (url: string | null) => void;
    label?: string;
    maxWidth?: number;
    quality?: number;
    aspectRatio?: number;
}

async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas not supported'));

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = reject;
    });
}

export default function ImageUpload({
    value,
    onChange,
    label = 'Image',
    maxWidth = 1200,
    quality = 0.8,
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Validate type
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
            }

            // Validate size (max 10MB before compression)
            if (file.size > 10 * 1024 * 1024) {
                toast.error('Image too large. Max 10MB before compression');
                return;
            }

            setIsUploading(true);
            try {
                // Compress
                const compressedBlob = await compressImage(file, maxWidth, quality);
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                    type: 'image/jpeg',
                });

                // Upload
                const formData = new FormData();
                formData.append('file', compressedFile);

                const res = await api.post('/storage/upload', formData);

                const data = res.data as any;
                if (data?.url) {
                    onChange(data.url);
                    toast.success('Image uploaded successfully');
                } else {
                    throw new Error('No URL returned');
                }
            } catch (err: any) {
                toast.error(err.message || 'Failed to upload image');
            } finally {
                setIsUploading(false);
                if (inputRef.current) inputRef.current.value = '';
            }
        },
        [maxWidth, quality, onChange]
    );

    return (
        <div>
            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                {label}
            </label>
            {value ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                        src={value}
                        alt="Uploaded"
                        style={{
                            width: '120px',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                        }}
                    />
                    <button
                        onClick={() => onChange(null)}
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--notion-red)',
                            color: 'var(--foreground-inverse)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                        }}
                        type="button"
                    >
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => inputRef.current?.click()}
                    style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: 'var(--radius-md)',
                        border: '2px dashed var(--notion-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        gap: '6px',
                        color: 'var(--notion-text-secondary)',
                        fontSize: '12px',
                    }}
                >
                    {isUploading ? (
                        <span>Uploading...</span>
                    ) : (
                        <>
                            <ImageIcon size={24} />
                            <span>Upload</span>
                        </>
                    )}
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
        </div>
    );
}
