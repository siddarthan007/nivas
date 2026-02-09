'use client';

import { useState } from 'react';
import { useInventory } from '@/lib/hooks/useInventory';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import {
    Package,
    Plus,
    RefreshCw,
    Search,
    AlertTriangle,
    ArrowUp,
    ArrowDown,
    Edit,
    Trash2
} from 'lucide-react';
import type { InventoryItem, CreateInventoryPayload, ItemCategory } from '@/lib/types/api.types';

const CATEGORIES: ItemCategory[] = ['FOOD', 'BEVERAGE', 'HOUSEKEEPING', 'STATIONERY', 'MAINTENANCE'];

// Inventory Item Card
function InventoryCard({
    item,
    onEdit,
    onAdjustStock,
    onDelete
}: {
    item: InventoryItem;
    onEdit: () => void;
    onAdjustStock: (adjustment: number) => void;
    onDelete: () => void;
}) {
    const isLowStock = item.currentStock <= item.minStock;
    const needsReorder = item.currentStock <= item.reorderLevel;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${isLowStock ? 'var(--notion-red)' : 'var(--notion-border)'}`,
            padding: 'var(--space-4)',
            transition: 'transform 150ms ease, box-shadow 150ms ease',
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
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-3)'
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
                        {(item.category || '').toLowerCase()}
                    </div>
                </div>

                {/* Alert Badge */}
                {isLowStock && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        backgroundColor: 'var(--notion-red-bg)',
                        borderRadius: '10px',
                    }}>
                        <AlertTriangle size={12} style={{ color: 'var(--notion-red)' }} />
                        <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--notion-red)' }}>
                            Low Stock
                        </span>
                    </div>
                )}
            </div>

            {/* Stock Info */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) 0',
                borderTop: '1px solid var(--notion-divider)',
                borderBottom: '1px solid var(--notion-divider)',
            }}>
                <div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Current Stock</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: isLowStock ? 'var(--notion-red)' : 'var(--notion-text)' }}>
                        {item.currentStock} {item.unit}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Min / Reorder</div>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        {item.minStock} / {item.reorderLevel}
                    </div>
                </div>
            </div>

            {/* Price */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
            }}>
                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Unit Cost</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>
                    ₹{(item.costPrice || 0).toLocaleString()}
                </span>
            </div>

            {/* Actions */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
            }}>
                <Button size="sm" variant="secondary" onClick={() => onAdjustStock(-1)} style={{ flex: 1 }}>
                    <ArrowDown size={14} /> -1
                </Button>
                <Button size="sm" onClick={() => onAdjustStock(1)} style={{ flex: 1 }}>
                    <ArrowUp size={14} /> +1
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={onDelete}
                    style={{ color: 'var(--notion-red)' }}
                >
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );
}

// Inventory Form Modal
function InventoryFormModal({
    isOpen,
    onClose,
    onSubmit,
    editingItem,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateInventoryPayload) => Promise<void>;
    editingItem?: InventoryItem;
}) {
    const [formData, setFormData] = useState<CreateInventoryPayload>({
        name: editingItem?.name || '',
        category: editingItem?.category || 'FOOD',
        unit: editingItem?.unit || 'pcs',
        currentStock: editingItem?.currentStock ?? ('' as unknown as number),
        minStock: editingItem?.minStock ?? 5,
        reorderLevel: editingItem?.reorderLevel ?? 10,
        costPrice: editingItem?.costPrice ?? ('' as unknown as number),
        supplier: editingItem?.supplier || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSubmit(formData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? 'Edit Item' : 'New Item'} size="lg">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Item Name *
                        </label>
                        <Input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Cooking Oil"
                            required
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Category
                        </label>
                        <select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                            }}
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Unit
                        </label>
                        <Input
                            type="text"
                            value={formData.unit}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                            placeholder="kg, L, pcs"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Current Stock
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={formData.currentStock}
                            onChange={e => setFormData({ ...formData, currentStock: e.target.value === '' ? ('' as unknown as number) : parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Min Stock
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={formData.minStock}
                            onChange={e => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Reorder Level
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={formData.reorderLevel}
                            onChange={e => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Cost Price (per unit)
                        </label>
                        <Input
                            type="number"
                            min={0}
                            value={formData.costPrice}
                            onChange={e => setFormData({ ...formData, costPrice: e.target.value === '' ? ('' as unknown as number) : parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Supplier
                        </label>
                        <Input
                            type="text"
                            value={formData.supplier || ''}
                            onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                            placeholder="Supplier name"
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function InventoryPage() {
    const { items, isLoading, fetchInventory, addItem, updateStock, deleteItem } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'ALL'>('ALL');
    const [showLowStock, setShowLowStock] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | undefined>();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(20);

    // Derive stats and lowStockItems from items
    const safeItems = items || [];
    const lowStockItems = safeItems.filter(item => item.currentStock <= item.minStock);
    const stats = {
        total: safeItems.length,
        lowStock: lowStockItems.length,
        reorder: safeItems.filter(item => item.currentStock <= item.reorderLevel).length,
        totalValue: safeItems.reduce((sum, item) => sum + (item.costPrice * item.currentStock), 0)
    };

    // Filter items
    const filteredItems = safeItems.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
        const matchesLowStock = !showLowStock || item.currentStock <= item.minStock;
        return matchesSearch && matchesCategory && matchesLowStock;
    });

    // Pagination
    const totalPages = Math.ceil(filteredItems.length / pageLimit);
    const paginatedItems = filteredItems.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

    // Reset page when filters change
    const handleSearchChange = (value: string) => { setSearchQuery(value); setCurrentPage(1); };
    const handleCategoryChange = (value: ItemCategory | 'ALL') => { setCategoryFilter(value); setCurrentPage(1); };
    const handleLowStockToggle = () => { setShowLowStock(!showLowStock); setCurrentPage(1); };

    const handleCreateItem = async (data: CreateInventoryPayload) => {
        await addItem(data);
    };

    const handleDeleteItem = async (id: number) => {
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            await deleteItem(id);
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
                                <Package size={28} />
                                Inventory
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginTop: 'var(--space-1)',
                            }}>
                                Track stock levels and manage supplies
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => fetchInventory()} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                            <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                Add Item
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-6)',
                        marginBottom: 'var(--space-6)',
                    }}>
                        {[
                            { label: 'Total Items', value: stats.total, color: 'var(--notion-text)' },
                            { label: 'Low Stock', value: stats.lowStock, color: 'var(--notion-red)' },
                            { label: 'Reorder', value: stats.reorder, color: 'var(--notion-orange)' },
                            { label: 'Total Value', value: `₹${(stats.totalValue || 0).toLocaleString()}`, color: 'var(--notion-green)' },
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
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <Search size={16} style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--notion-text-secondary)',
                            }} />
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={e => handleSearchChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    fontSize: '14px',
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    color: 'var(--notion-text)',
                                }}
                            />
                        </div>

                        <select
                            value={categoryFilter}
                            onChange={e => handleCategoryChange(e.target.value as ItemCategory | 'ALL')}
                            style={{
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text)',
                            }}
                        >
                            <option value="ALL">All Categories</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        <Button
                            variant={showLowStock ? 'primary' : 'secondary'}
                            onClick={handleLowStockToggle}
                        >
                            <AlertTriangle size={14} style={{ marginRight: '6px' }} />
                            Low Stock Only
                        </Button>
                    </div>

                    {/* Items Grid */}
                    {isLoading ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} style={{
                                    height: '200px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <EmptyState
                            icon={<Package size={48} strokeWidth={1} />}
                            title={
                                searchQuery || categoryFilter !== 'ALL' || showLowStock
                                    ? 'No items match your filters'
                                    : 'No inventory items yet'
                            }
                            description={
                                searchQuery || categoryFilter !== 'ALL' || showLowStock
                                    ? 'Try adjusting your search or filter criteria.'
                                    : 'Add your first item to start tracking stock levels and supplies.'
                            }
                            action={
                                !(searchQuery || categoryFilter !== 'ALL' || showLowStock)
                                    ? (
                                        <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
                                            <Plus size={14} style={{ marginRight: '6px' }} />
                                            Add Item
                                        </Button>
                                    )
                                    : undefined
                            }
                        />
                    ) : (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: 'var(--space-4)',
                            }}>
                                {paginatedItems.map(item => (
                                    <InventoryCard
                                        key={item.id}
                                        item={item}
                                        onEdit={() => { setEditingItem(item); setIsFormOpen(true); }}
                                        onAdjustStock={(adj) => updateStock(item.id, adj)}
                                        onDelete={() => handleDeleteItem(item.id)}
                                    />
                                ))}
                            </div>
                            <Pagination
                                page={currentPage}
                                totalPages={totalPages}
                                total={filteredItems.length}
                                limit={pageLimit}
                                onPageChange={setCurrentPage}
                                onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                            />
                        </>
                    )}
            </div>

            {/* Item Form Modal */}
            <InventoryFormModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(undefined); }}
                onSubmit={handleCreateItem}
                editingItem={editingItem}
            />
        </DashboardLayout>
    );
}
