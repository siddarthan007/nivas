import { api } from '@/lib/api';

export interface MenuCategory {
    id: number;
    hotelId: number;
    name: string;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
}

export interface CreateCategoryPayload {
    name: string;
    description?: string;
}

export interface UpdateCategoryPayload {
    name?: string;
    description?: string;
    sortOrder?: number;
}

export const MenuCategoryService = {
    getAll: async () => {
        const { data } = await api.get<MenuCategory[]>('/menu/categories');
        return data || [];
    },

    create: async (payload: CreateCategoryPayload) => {
        const { data } = await api.post<MenuCategory>('/menu/categories', payload);
        return data;
    },

    update: async (id: number, payload: UpdateCategoryPayload) => {
        const { data } = await api.patch<MenuCategory>(`/menu/categories/${id}`, payload);
        return data;
    },

    delete: async (id: number) => {
        await api.delete(`/menu/categories/${id}`);
    }
};
