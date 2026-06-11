import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import type { InventoryItem, CreateInventoryPayload, ItemCategory } from '@/lib/types/api.types';
import type { Warehouse, Vendor } from '@/lib/hooks/useInventory';

const CATEGORIES: ItemCategory[] = ['FOOD', 'BEVERAGE', 'HOUSEKEEPING', 'STATIONERY', 'MAINTENANCE'];
const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DISCONTINUED', label: 'Discontinued' },
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateInventoryPayload) => Promise<void>;
    editingItem?: InventoryItem;
    warehouses: Warehouse[];
    vendors: Vendor[];
}

export default function InventoryFormModal({
    isOpen,
    onClose,
    onSubmit,
    editingItem,
    warehouses,
    vendors,
}: Props) {
    const [formData, setFormData] = useState<CreateInventoryPayload>({
        name: '',
        category: 'FOOD',
        unit: 'pcs',
        currentStock: 0,
        minStock: 5,
        reorderLevel: 10,
        costPrice: 0,
        supplier: '',
        status: 'ACTIVE',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingItem) {
            setFormData({
                sku: editingItem.sku,
                barcode: editingItem.barcode,
                name: editingItem.name,
                description: editingItem.description,
                category: editingItem.category,
                unit: editingItem.unit,
                currentStock: editingItem.currentStock,
                minStock: editingItem.minStock,
                reorderLevel: editingItem.reorderLevel,
                costPrice: editingItem.costPrice,
                supplier: editingItem.supplier,
                status: editingItem.status,
                warehouseId: editingItem.warehouseId,
                supplierId: editingItem.supplierId,
            });
        } else {
            setFormData({
                name: '',
                category: 'FOOD',
                unit: 'pcs',
                currentStock: 0,
                minStock: 5,
                reorderLevel: 10,
                costPrice: 0,
                supplier: '',
                status: 'ACTIVE',
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
        <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? 'Edit Item' : 'New Item'} size="lg">
            <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                        label="SKU"
                        value={formData.sku || ''}
                        onChange={e => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="ITEM-001"
                    />
                    <Input
                        label="Barcode"
                        value={formData.barcode || ''}
                        onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Scan or type..."
                    />
                </div>

                <Input
                    label="Item Name *"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Cooking Oil"
                    required
                />

                <Input
                    label="Description"
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description..."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Select
                        label="Category"
                        value={formData.category}
                        onChange={e =>
                            setFormData({ ...formData, category: e.target.value as ItemCategory })
                        }
                        fullWidth
                        options={CATEGORIES.map(c => ({ value: c, label: c }))}
                    />
                    <Select
                        label="Status"
                        value={formData.status || 'ACTIVE'}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                status: e.target.value as 'ACTIVE' | 'DISCONTINUED',
                            })
                        }
                        fullWidth
                        options={STATUS_OPTIONS}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                        label="Unit"
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="kg, L, pcs"
                    />
                    <Input
                        type="number"
                        label="Stock"
                        value={formData.currentStock || ''}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                currentStock:
                                    e.target.value === '' ? 0 : parseInt(e.target.value),
                            })
                        }
                    />
                    <Input
                        type="number"
                        label="Min Stock"
                        value={formData.minStock || ''}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                minStock: e.target.value === '' ? 0 : parseInt(e.target.value),
                            })
                        }
                    />
                    <Input
                        type="number"
                        label="Reorder"
                        value={formData.reorderLevel || ''}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                reorderLevel: e.target.value === '' ? 0 : parseInt(e.target.value),
                            })
                        }
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                        type="number"
                        label="Unit Cost"
                        value={formData.costPrice || ''}
                        onChange={e =>
                            setFormData({
                                ...formData,
                                costPrice:
                                    e.target.value === '' ? 0 : parseFloat(e.target.value),
                            })
                        }
                    />
                    <SearchableSelect
                        label="Warehouse"
                        value={formData.warehouseId ?? null}
                        onChange={val =>
                            setFormData({ ...formData, warehouseId: Number(val) })
                        }
                        placeholder="Select..."
                        options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                    />
                </div>

                <SearchableSelect
                    label="Supplier"
                    value={formData.supplierId ?? null}
                    onChange={val => setFormData({ ...formData, supplierId: Number(val) })}
                    placeholder="Select supplier..."
                    options={vendors.map(v => ({
                        value: v.id,
                        label: v.name,
                        subtitle: v.email || v.phone,
                    }))}
                />

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || !formData.name}
                        style={{ flex: 1 }}
                    >
                        {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
