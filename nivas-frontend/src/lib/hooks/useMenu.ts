import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { MenuItem, CreateMenuItemPayload } from '@/lib/types/api.types';
import { MenuCategoryService, type MenuCategory } from '@/lib/services/menu-category.service';
import { toast } from 'sonner';

export function useMenu() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMenu = useCallback(async () => {
        setIsLoading(true);
        try {
            const [itemsData, categoriesData] = await Promise.all([
                api.get<MenuItem[]>('/menu').then(response => response.data || []),
                MenuCategoryService.getAll(),
            ]);
            setMenuItems(itemsData);
            setCategories(categoriesData);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data');
            toast.error('Failed to load menu data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createItem = async (data: CreateMenuItemPayload): Promise<boolean> => {
        try {
            await api.post('/menu', data);
            await fetchMenu();
            toast.success('Menu item created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create menu item');
            return false;
        }
    };

    const updateItem = async (id: number, data: Partial<MenuItem>): Promise<boolean> => {
        try {
            await api.patch(`/menu/${id}`, data);
            await fetchMenu();
            toast.success('Menu item updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update menu item');
            return false;
        }
    };

    const deleteItem = async (id: number): Promise<boolean> => {
        try {
            await api.delete(`/menu/${id}`);
            await fetchMenu();
            toast.success('Menu item deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete menu item');
            return false;
        }
    };

    const refreshCategories = async () => {
        try {
            const data = await MenuCategoryService.getAll();
            setCategories(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMenu();
    }, [fetchMenu]);

    return {
        menuItems,
        categories,
        isLoading,
        error,
        fetchMenu,
        createItem,
        updateItem,
        deleteItem,
        refreshCategories,
    };
}
