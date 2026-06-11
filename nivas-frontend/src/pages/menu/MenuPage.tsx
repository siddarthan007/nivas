'use client';

import { useState, useEffect } from 'react';
import BulkImportModal from "@/components/features/shared/BulkImportModal";
import { useMenu } from '@/lib/hooks/useMenu';
import { usePermissions } from '@/lib/hooks/usePermissions';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {
    UtensilsCrossed,
    Plus,
    RefreshCw,
    Search,
    Clock,
    Eye,
    EyeOff,
    Edit,
    Settings,
    Trash2,
    Upload,
} from "lucide-react";
import type { MenuItem, CreateMenuItemPayload } from '@/lib/types/api.types';
import CategoryManagerModal from '@/components/features/menu/CategoryManagerModal';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';
import ImageUpload from '@/components/ui/ImageUpload';

// Menu Item Card
function MenuItemCard({
    item,
    onToggleAvailability,
    onEdit,
    onDelete,
    canUpdate,
    canDelete,
}: {
    item: MenuItem;
    onToggleAvailability: () => void;
    onEdit: () => void;
    onDelete: () => void;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            overflow: 'hidden',
            transition: 'transform 150ms ease, box-shadow 150ms ease',
            opacity: item.isAvailable ? 1 : 0.6,
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Image */}
            <div style={{
                height: '120px',
                background: item.imageUrl ? 'transparent' : 'linear-gradient(135deg, var(--notion-bg-tertiary), var(--notion-bg-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}>
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <UtensilsCrossed size={32} style={{ color: 'var(--notion-text-secondary)', opacity: 0.5 }} />
                )}
            </div>

            {/* Content */}
            <div style={{ padding: 'var(--space-4)' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-2)',
                }}>
                    <div>
                        <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                        }}>
                            {item.name}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-secondary)',
                            textTransform: 'capitalize',
                        }}>
                            {item.category}
                        </div>
                    </div>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: 'var(--notion-green)',
                    }}>
                        NPR {item.price}
                    </span>
                </div>

                {item.description && (
                    <p style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: 'var(--space-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                    }}>
                        {item.description}
                    </p>
                )}

                {/* Actions */}
                {(canUpdate || canDelete) && (
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-2)',
                        borderTop: '1px solid var(--notion-divider)',
                        paddingTop: 'var(--space-3)',
                    }}>
                        {canUpdate && (
                            <Button
                                size="sm"
                                variant={item.isAvailable ? 'secondary' : 'primary'}
                                onClick={onToggleAvailability}
                                style={{ flex: 1 }}
                            >
                                {item.isAvailable ? <EyeOff size={14} /> : <Eye size={14} />}
                                <span style={{ marginLeft: '4px' }}>{item.isAvailable ? 'Hide' : 'Show'}</span>
                            </Button>
                        )}
                        {canUpdate && (
                            <Button size="sm" variant="secondary" onClick={onEdit}>
                                <Edit size={14} />
                            </Button>
                        )}
                        {canDelete && (
                            <Button size="sm" variant="secondary" onClick={onDelete}
                                style={{ color: 'var(--notion-red)' }}>
                                <Trash2 size={14} />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Menu Item Form Modal
function MenuFormModal({
    isOpen,
    onClose,
    onSubmit,
    editingItem,
    categories,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateMenuItemPayload) => Promise<void>;
    editingItem?: MenuItem;
    categories: string[];
}) {
    const [formData, setFormData] = useState<CreateMenuItemPayload>({
        name: '',
        description: '',
        category: '',
        price: '' as unknown as number,
        isAvailable: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingItem) {
            setFormData({
                name: editingItem.name || '',
                description: editingItem.description || '',
                category: editingItem.category || '',
                price: editingItem.price ? parseFloat(String(editingItem.price)) : ('' as unknown as number),
                isAvailable: editingItem.isAvailable ?? true,
                imageUrl: editingItem.imageUrl,
            });
        } else {
            setFormData({
                name: '',
                description: '',
                category: '',
                price: '' as unknown as number,
                isAvailable: true,
            });
        }
    }, [editingItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSubmit(formData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? 'Edit Item' : 'New Menu Item'}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Item Name *
                    </label>
                    <Input
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Chicken Biryani"
                        required
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Description
                    </label>
                    <textarea
                        value={formData.description || ''}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Delicious aromatic rice dish..."
                        rows={2}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                            resize: 'vertical',
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <Select
                            label="Category *"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            required
                            fullWidth
                            options={[
                                { value: '', label: 'Select category...' },
                                ...categories.map(cat => ({ value: cat, label: cat })),
                            ]}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Price (NPR) *
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value) })}
                            required
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                        <input
                            type="checkbox"
                            checked={formData.isAvailable}
                            onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })}
                            style={{ marginRight: '8px' }}
                        />
                        <label style={{ fontSize: '14px', color: 'var(--notion-text)' }}>
                            Available for order
                        </label>
                    </div>
                </div>

                <ImageUpload
                    label="Item Image"
                    value={formData.imageUrl || null}
                    onChange={(url) => setFormData({ ...formData, imageUrl: url || undefined })}
                />

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name || !formData.category} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function MenuPage() {
    const { menuItems, categories: fetchedCategories, isLoading, fetchMenu, createItem, updateItem, deleteItem, refreshCategories } = useMenu();
    const { can } = usePermissions();
    const canCreate = can('menu:create');
    const canUpdate = can('menu:update');
    const canDelete = can('menu:delete');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | undefined>();
    const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

    // Derive values
    const items = menuItems || [];
    // Use fetched categories if available, otherwise fallback (though fetched is better for empty ones)
    const categoryNames = fetchedCategories.length > 0
        ? fetchedCategories.map(c => c.name)
        : [...new Set(items.map(i => i.category).filter(Boolean))];

    const availableItems = items.filter(i => i.isAvailable);

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const handleCreateItem = async (data: CreateMenuItemPayload) => {
        if (editingItem) {
            await updateItem(editingItem.id, data);
        } else {
            await createItem(data);
        }
    };

    const toggleAvailability = async (id: number) => {
        const item = items.find(i => i.id === id);
        if (item) {
            await updateItem(id, { isAvailable: !item.isAvailable });
        }
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-6)',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                        }}>
                            <UtensilsCrossed size={28} />
                            Menu
                        </h1>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--notion-text-secondary)',
                            marginTop: 'var(--space-1)',
                        }}>
                            Manage food and beverage items
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        {canCreate && (
                            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)}>
                                <Settings size={14} style={{ marginRight: '6px' }} />
                                Categories
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => fetchMenu()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            Refresh
                        </Button>
                        {canCreate && (
                            <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
                                <Upload size={14} style={{ marginRight: '6px' }} />
                                Import CSV
                            </Button>
                        )}
                        {canCreate && (
                            <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                Add Item
                            </Button>
                        )}
                    </div>

                    <BulkImportModal
                        isOpen={isImportOpen}
                        onClose={() => setIsImportOpen(false)}
                        title="Menu Items"
                        endpoint="/import/menu"
                        columns={[
                            { key: 'name', required: true },
                            { key: 'price', required: true },
                            { key: 'category', required: false },
                            { key: 'description', required: false },
                        ]}
                        sampleRow={{ name: 'Chicken Momo', price: '250', category: 'Snacks', description: 'Steamed dumplings' }}
                        onImported={() => fetchMenu()}
                    />
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-6)',
                    marginBottom: 'var(--space-6)',
                }}>
                    {[
                        { label: 'Total Items', value: items.length, color: 'var(--notion-text)' },
                        { label: 'Available', value: availableItems.length, color: 'var(--notion-green)' },
                        { label: 'Hidden', value: items.length - availableItems.length, color: 'var(--notion-red)' },
                        { label: 'Categories', value: categoryNames.length, color: 'var(--notion-blue)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-6)',
                }}>
                    <div style={{ flex: 1, maxWidth: '300px' }}>
                        <Input
                            type="text"
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            icon={<Search size={16} />}
                        />
                    </div>

                    <Select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        options={[
                            { value: 'ALL', label: 'All Categories' },
                            ...categoryNames.map(cat => ({ value: cat, label: cat })),
                        ]}
                    />
                </div>

                {/* Menu Items Grid */}
                {isLoading ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{
                                height: '280px',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-12)',
                        color: 'var(--notion-text-secondary)',
                    }}>
                        <UtensilsCrossed size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                        <p style={{ fontSize: '16px' }}>
                            {searchQuery || categoryFilter !== 'ALL'
                                ? 'No items match your filters'
                                : 'No menu items yet. Add your first dish to get started.'}
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: 'var(--space-4)',
                    }}>
                        {filteredItems.map(item => (
                            <MenuItemCard
                                key={item.id}
                                item={item}
                                onToggleAvailability={() => toggleAvailability(item.id)}
                                onEdit={() => { setEditingItem(item); setIsFormOpen(true); }}
                                onDelete={() => setDeleteTarget(item)}
                                canUpdate={canUpdate}
                                canDelete={canDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Menu Form Modal */}
            <MenuFormModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(undefined); }}
                onSubmit={handleCreateItem}
                editingItem={editingItem}
                categories={categoryNames}
            />

            {/* Category Manager Modal */}
            <CategoryManagerModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onChange={() => refreshCategories && refreshCategories()}
            />

            {/* Delete Confirmation */}
            <SecurityConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteItem(deleteTarget.id);
                }}
                title="Delete Menu Item"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                confirmText="Delete Item"
                isDestructive
            />
        </DashboardLayout>
    );
}
