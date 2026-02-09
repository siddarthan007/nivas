'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useMenu } from '@/lib/hooks/useMenu';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import {
    UtensilsCrossed,
    Plus,
    Search,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import type { CreateMenuItemPayload, MenuItem } from '@/lib/types/api.types';

// Menu Item Form Modal
function MenuItemFormModal({
    isOpen,
    onClose,
    onSubmit,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateMenuItemPayload) => Promise<boolean>;
    initialData?: MenuItem | null;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateMenuItemPayload>({
        name: '',
        description: '',
        category: 'FOOD',
        price: 0,
        preparationTime: 15,
        isAvailable: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                description: initialData.description || '',
                category: initialData.category,
                price: initialData.price,
                preparationTime: initialData.preparationTime || 15,
                isAvailable: initialData.isAvailable
            });
        } else {
            setFormData({
                name: '',
                description: '',
                category: 'FOOD',
                price: 0,
                preparationTime: 15,
                isAvailable: true
            });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const success = await onSubmit(formData);
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Item' : 'New Menu Item'}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Item Name</label>
                    <Input
                        required
                        placeholder="e.g. Chicken Burger"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Category</label>
                        <Select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            options={[
                                { value: 'FOOD', label: 'Food' },
                                { value: 'BEVERAGE', label: 'Beverage' },
                                { value: 'DESSERT', label: 'Dessert' },
                                { value: 'SNACK', label: 'Snack' }
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Price (₹)</label>
                        <Input
                            type="number"
                            required
                            min={0}
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Description</label>
                    <textarea
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                            minHeight: '80px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                        placeholder="Ingredients, details, etc."
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="checkbox"
                        id="isAvailable"
                        checked={formData.isAvailable}
                        onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="isAvailable" style={{ fontSize: '14px', cursor: 'pointer' }}>Available for ordering in rooms</label>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose} disabled={loading} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>{initialData ? 'Update' : 'Create'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export default function MenuPage() {
    const { menuItems, isLoading, fetchMenu, createItem, updateItem, deleteItem } = useMenu();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    useEffect(() => {
        fetchMenu();
    }, []);

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const handleCreate = async (data: CreateMenuItemPayload) => {
        return await createItem(data);
    };

    const handleUpdate = async (data: CreateMenuItemPayload) => {
        if (!editingItem) return false;
        return await updateItem(editingItem.id, data);
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this item?')) {
            await deleteItem(id);
        }
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <UtensilsCrossed size={28} />
                            Menu Management
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Manage food and beverage items available for room service
                        </p>
                    </div>
                    <Button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} variant="primary">
                        <Plus size={14} style={{ marginRight: '8px' }} /> Add Item
                    </Button>
                </div>

                {/* Filters */}
                <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)'
                            }}
                        />
                    </div>
                    <div style={{ width: '150px' }}>
                        <Select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            options={[
                                { value: 'ALL', label: 'All Categories' },
                                { value: 'FOOD', label: 'Food' },
                                { value: 'BEVERAGE', label: 'Beverage' },
                                { value: 'DESSERT', label: 'Dessert' },
                                { value: 'SNACK', label: 'Snack' }
                            ]}
                        />
                    </div>
                </div>

                {/* Menu List */}
                <div style={{
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderBottom: '1px solid var(--notion-border)',
                            color: 'var(--notion-text-secondary)'
                        }}>
                            <tr>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Item</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Category</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Price</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading...</td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No items found.</td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>{item.name}</div>
                                            {item.description && (
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.description}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                backgroundColor: 'var(--notion-bg-secondary)',
                                                color: 'var(--notion-text-secondary)'
                                            }}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>₹{item.price}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {item.isAvailable ? (
                                                <span style={{ color: 'var(--notion-green)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500' }}>
                                                    <CheckCircle2 size={12} /> Available
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--notion-red)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500' }}>
                                                    <XCircle size={12} /> Unavailable
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <Button size="sm" variant="secondary" onClick={() => { setEditingItem(item); setIsFormOpen(true); }}>
                                                    <Edit size={14} />
                                                </Button>
                                                <Button size="sm" variant="danger" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <MenuItemFormModal
                    isOpen={isFormOpen}
                    onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
                    onSubmit={editingItem ? handleUpdate : handleCreate}
                    initialData={editingItem}
                />
            </div>
        </DashboardLayout>
    );
}
