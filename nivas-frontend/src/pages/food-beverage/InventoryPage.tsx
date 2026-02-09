'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useInventory } from '@/lib/hooks/useInventory';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import {
    Package,
    Plus,
    Search,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    TrendingDown,
    TrendingUp
} from 'lucide-react';
import type { CreateInventoryPayload, InventoryItem, ItemCategory } from '@/lib/types/api.types';

// Inventory Item Status Component
function StockStatus({ item }: { item: InventoryItem }) {
    if (item.currentStock <= 0) {
        return (
            <span style={{ color: 'var(--notion-red)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500' }}>
                <AlertTriangle size={12} /> Out of Stock
            </span>
        );
    }
    if (item.currentStock <= item.minStock) {
        return (
            <span style={{ color: 'var(--notion-orange)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500' }}>
                <AlertTriangle size={12} /> Low Stock
            </span>
        );
    }
    return (
        <span style={{ color: 'var(--notion-green)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '500' }}>
            <CheckCircle2 size={12} /> In Stock
        </span>
    );
}

// Add Item Modal
function ItemFormModal({
    isOpen,
    onClose,
    onSubmit
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateInventoryPayload) => Promise<boolean>;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateInventoryPayload>({
        name: '',
        category: 'FOOD',
        unit: 'kg',
        currentStock: 0,
        minStock: 5,
        reorderLevel: 10,
        costPrice: 0,
        supplier: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const success = await onSubmit(formData);
            if (success) {
                onClose();
                setFormData({
                    name: '',
                    category: 'FOOD',
                    unit: 'kg',
                    currentStock: 0,
                    minStock: 5,
                    reorderLevel: 10,
                    costPrice: 0,
                    supplier: ''
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Inventory Item">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Item Name</label>
                    <Input
                        required
                        placeholder="e.g. Rice"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Category</label>
                        <Select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                            options={[
                                { value: 'FOOD', label: 'Food' },
                                { value: 'BEVERAGE', label: 'Beverage' },
                                { value: 'HOUSEKEEPING', label: 'Housekeeping' },
                                { value: 'STATIONERY', label: 'Stationery' },
                                { value: 'MAINTENANCE', label: 'Maintenance' }
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Unit</label>
                        <Input
                            required
                            placeholder="kg, ltr, pcs"
                            value={formData.unit}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Current Stock</label>
                        <Input
                            type="number"
                            required
                            min={0}
                            value={formData.currentStock}
                            onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Min Stock Alert</label>
                        <Input
                            type="number"
                            required
                            min={0}
                            value={formData.minStock}
                            onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Cost Price (₹)</label>
                        <Input
                            type="number"
                            required
                            min={0}
                            value={formData.costPrice}
                            onChange={e => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Supplier (Optional)</label>
                        <Input
                            placeholder="Vendor Name"
                            value={formData.supplier}
                            onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose} disabled={loading} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>Add Item</Button>
                </div>
            </form>
        </Modal>
    );
}

// Update Stock Modal
function UpdateStockModal({
    isOpen,
    onClose,
    onSubmit,
    item
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (id: number, quantity: number) => Promise<boolean>;
    item: InventoryItem | null;
}) {
    const [loading, setLoading] = useState(false);
    const [quantity, setQuantity] = useState(0);
    const [action, setAction] = useState<'ADD' | 'REMOVE'>('ADD');

    useEffect(() => {
        if (isOpen) {
            setQuantity(0);
            setAction('ADD');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;
        setLoading(true);
        try {
            const newStock = action === 'ADD' ? item.currentStock + quantity : item.currentStock - quantity;
            const success = await onSubmit(item.id, Math.max(0, newStock));
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Update Stock: ${item?.name}`}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                    <button
                        type="button"
                        onClick={() => setAction('ADD')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${action === 'ADD' ? 'var(--notion-green)' : 'var(--notion-border)'}`,
                            backgroundColor: action === 'ADD' ? 'var(--notion-green-bg)' : 'transparent',
                            color: action === 'ADD' ? 'var(--notion-green)' : 'var(--notion-text)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        <TrendingUp size={16} /> Add Stock
                    </button>
                    <button
                        type="button"
                        onClick={() => setAction('REMOVE')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${action === 'REMOVE' ? 'var(--notion-red)' : 'var(--notion-border)'}`,
                            backgroundColor: action === 'REMOVE' ? 'var(--notion-red-bg)' : 'transparent',
                            color: action === 'REMOVE' ? 'var(--notion-red)' : 'var(--notion-text)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        <TrendingDown size={16} /> Remove Stock
                    </button>
                </div>

                <div>
                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Quantity ({item?.unit})</label>
                    <Input
                        type="number"
                        required
                        min={1}
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        autoFocus
                    />
                </div>

                <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>
                    New Stock Level: <strong>{action === 'ADD' ? (item ? item.currentStock + quantity : 0) : (item ? Math.max(0, item.currentStock - quantity) : 0)}</strong> {item?.unit}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose} disabled={loading} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" loading={loading}>Update</Button>
                </div>
            </form>
        </Modal>
    );
}

export default function InventoryPage() {
    const { items, isLoading, fetchInventory, addItem, updateStock } = useInventory();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    useEffect(() => {
        fetchInventory();
    }, []);

    const filteredItems = items.filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const handleUpdateClick = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsUpdateOpen(true);
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <Package size={28} />
                            Inventory
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Track stock levels and manage supplies
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => fetchInventory()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '8px' }} /> Refresh
                        </Button>
                        <Button onClick={() => setIsAddOpen(true)} variant="primary">
                            <Plus size={14} style={{ marginRight: '8px' }} /> Add Item
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Search inventory..."
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
                                { value: 'HOUSEKEEPING', label: 'Housekeeping' },
                                { value: 'STATIONERY', label: 'Stationery' },
                                { value: 'MAINTENANCE', label: 'Maintenance' }
                            ]}
                        />
                    </div>
                </div>

                {/* Inventory List */}
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
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Item Name</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Category</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Stock Level</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Unit</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '500' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading...</td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No items found.</td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{item.name}</td>
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
                                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{item.currentStock}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{item.unit}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <StockStatus item={item} />
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <Button size="sm" variant="secondary" onClick={() => handleUpdateClick(item)}>
                                                Update Stock
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <ItemFormModal
                    isOpen={isAddOpen}
                    onClose={() => setIsAddOpen(false)}
                    onSubmit={addItem}
                />

                <UpdateStockModal
                    isOpen={isUpdateOpen}
                    onClose={() => { setIsUpdateOpen(false); setSelectedItem(null); }}
                    onSubmit={updateStock}
                    item={selectedItem}
                />
            </div>
        </DashboardLayout>
    );
}
