'use client';

import { useState, useEffect, useMemo } from 'react';
import { useInventory, type Warehouse, type Vendor } from '@/lib/hooks/useInventory';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import {
    Package, Plus, RefreshCw, Search, AlertTriangle, BarChart3,
    History, Warehouse as WarehouseIcon, Truck, ShoppingCart, X,
    ArrowUp, ArrowDown, Pencil, Wallet, Trash2
} from 'lucide-react';

// Compact, consistent icon action button for table rows.
function RowAction({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
    return (
        <button onClick={onClick} title={label} aria-label={label}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', color, cursor: 'pointer', transition: 'background 120ms' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--notion-bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--notion-bg)')}>
            {icon}
        </button>
    );
}
import type { InventoryItem, CreateInventoryPayload, ItemCategory } from '@/lib/types/api.types';
import SecurityConfirmModal from '@/components/modals/SecurityConfirmModal';
import ProcurementPage from './ProcurementPage';
import InventoryItemCard from './InventoryItemCard';
import StockMovementTable from './StockMovementTable';
import InventoryFormModal from './InventoryFormModal';
import AdjustStockModal from './AdjustStockModal';

const CATEGORIES: ItemCategory[] = ['FOOD', 'BEVERAGE', 'HOUSEKEEPING', 'STATIONERY', 'MAINTENANCE'];
const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DISCONTINUED', label: 'Discontinued' },
];

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
    return (
        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-text)', lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>{label}</div>
            </div>
        </div>
    );
}

export default function InventoryPage() {
    const {
        items, movements, warehouses, vendors, lowStockItems,
        isLoading, refreshAll, addItem, updateItem, adjustStock, deleteItem, fetchMovements,
        addWarehouse, updateWarehouse, deleteWarehouse, getWarehouseFinance,
        addVendor, updateVendor, deleteVendor, getVendorFinance,
    } = useInventory();

    const [activeTab, setActiveTab] = useState<'items' | 'movements' | 'suppliers' | 'warehouses' | 'procurement'>('items');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISCONTINUED'>('ALL');
    const [itemSort, setItemSort] = useState<'name' | 'stock' | 'value'>('name');
    const [itemSortDir, setItemSortDir] = useState<'asc' | 'desc'>('asc');
    const [showLowStock, setShowLowStock] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | undefined>();
    const [adjustTarget, setAdjustTarget] = useState<InventoryItem | undefined>();
    const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageLimit, setPageLimit] = useState(24);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [warehouseSearch, setWarehouseSearch] = useState('');

    // Warehouse / Vendor modals
    const [whFormOpen, setWhFormOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [whDeleteTarget, setWhDeleteTarget] = useState<Warehouse | null>(null);
    const [whFinanceTarget, setWhFinanceTarget] = useState<Warehouse | null>(null);
    const [whFinanceData, setWhFinanceData] = useState<any>(null);

    const [vendorFormOpen, setVendorFormOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [vendorDeleteTarget, setVendorDeleteTarget] = useState<Vendor | null>(null);
    const [vendorFinanceTarget, setVendorFinanceTarget] = useState<Vendor | null>(null);
    const [vendorFinanceData, setVendorFinanceData] = useState<any>(null);
    const [apAging, setApAging] = useState<any>(null);

    const loadApAging = async () => { try { const r = await api.get<any>('/inventory/ap-aging'); setApAging(r.data); } catch { /* ignore */ } };
    useEffect(() => {
        if (activeTab === 'movements') fetchMovements();
        if (activeTab === 'suppliers') loadApAging();
    }, [activeTab, fetchMovements]);

    const safeItems = items || [];
    const stats = useMemo(() => ({
        total: safeItems.length,
        active: safeItems.filter(i => i.status === 'ACTIVE').length,
        lowStock: lowStockItems.length,
        totalValue: safeItems.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.currentStock || 0)), 0),
    }), [safeItems, lowStockItems]);

    const filteredItems = safeItems.filter(item => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (item.name || '').toLowerCase().includes(q) || (item.sku || '').toLowerCase().includes(q);
        const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
        const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
        const matchesLowStock = !showLowStock || item.currentStock <= item.minStock;
        return matchesSearch && matchesCategory && matchesStatus && matchesLowStock;
    });

    const itemCost = (it: any) => Number(it.costPrice ?? it.unitCost ?? 0);
    const sortedItems = [...filteredItems].sort((a: any, b: any) => {
        let cmp = 0;
        if (itemSort === 'name') cmp = (a.name || '').localeCompare(b.name || '');
        else if (itemSort === 'stock') cmp = (a.currentStock || 0) - (b.currentStock || 0);
        else if (itemSort === 'value') cmp = (a.currentStock || 0) * itemCost(a) - (b.currentStock || 0) * itemCost(b);
        return itemSortDir === 'asc' ? cmp : -cmp;
    });

    const totalPages = Math.ceil(sortedItems.length / pageLimit);
    const paginatedItems = sortedItems.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);

    const handleCreateItem = async (data: CreateInventoryPayload) => {
        if (editingItem) await updateItem(editingItem.id, data as any);
        else await addItem(data);
    };

    const tabs = [
        { id: 'items' as const, label: 'Items', icon: <Package size={16} /> },
        { id: 'movements' as const, label: 'Movements', icon: <History size={16} /> },
        { id: 'suppliers' as const, label: 'Suppliers', icon: <Truck size={16} /> },
        { id: 'warehouses' as const, label: 'Warehouses', icon: <WarehouseIcon size={16} /> },
        { id: 'procurement' as const, label: 'Procurement', icon: <ShoppingCart size={16} /> },
    ];

    const hasFilters = searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || showLowStock;

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <Package size={28} /> Inventory
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Professional stock management with movements, suppliers & warehouses
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => refreshAll()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh
                        </Button>
                        <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
                            <Plus size={14} style={{ marginRight: '6px' }} /> Add Item
                        </Button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    <StatCard label="Total Items" value={stats.total} color="var(--notion-blue)" icon={<Package size={20} />} />
                    <StatCard label="Active" value={stats.active} color="var(--notion-green)" icon={<BarChart3 size={20} />} />
                    <StatCard label="Low Stock" value={stats.lowStock} color="var(--notion-red)" icon={<AlertTriangle size={20} />} />
                    <StatCard label="Total Value" value={'Rs ' + (stats.totalValue || 0).toLocaleString()} color="var(--notion-green)" icon={<BarChart3 size={20} />} />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--notion-divider)', marginBottom: 'var(--space-6)' }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)', background: 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'procurement' ? (
                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        <ProcurementPage />
                    </div>
                ) : activeTab === 'items' ? (
                    <>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: '220px', maxWidth: '320px' }}>
                                <Input type="text" placeholder="Search by name or SKU..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} icon={<Search size={16} />} />
                            </div>
                            <Select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value as ItemCategory | 'ALL'); setCurrentPage(1); }} options={[{ value: 'ALL', label: 'All Categories' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
                            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }} options={[{ value: 'ALL', label: 'All Status' }, ...STATUS_OPTIONS]} />
                            <Select value={itemSort} onChange={e => setItemSort(e.target.value as 'name' | 'stock' | 'value')} options={[{ value: 'name', label: 'Sort: Name' }, { value: 'stock', label: 'Sort: Stock' }, { value: 'value', label: 'Sort: Value' }]} />
                            <Button variant="secondary" onClick={() => setItemSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Toggle sort direction">
                                {itemSortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            </Button>
                            <Button variant={showLowStock ? 'primary' : 'secondary'} onClick={() => { setShowLowStock(!showLowStock); setCurrentPage(1); }}>
                                <AlertTriangle size={14} style={{ marginRight: '6px' }} /> Low Stock
                            </Button>
                            {hasFilters && (
                                <button onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); setStatusFilter('ALL'); setShowLowStock(false); setCurrentPage(1); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                                    <X size={14} /> Clear
                                </button>
                            )}
                        </div>

                        {isLoading ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} style={{ height: '220px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                ))}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <EmptyState
                                icon={<Package size={48} strokeWidth={1} />}
                                title={hasFilters ? 'No items match filters' : 'No inventory items yet'}
                                description={hasFilters ? 'Try adjusting your search or filters.' : 'Add your first item to start tracking stock levels.'}
                                action={!hasFilters ? (
                                    <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
                                        <Plus size={14} style={{ marginRight: '6px' }} /> Add Item
                                    </Button>
                                ) : undefined}
                            />
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                                    {paginatedItems.map(item => (
                                        <InventoryItemCard
                                            key={item.id}
                                            item={item}
                                            onEdit={() => { setEditingItem(item); setIsFormOpen(true); }}
                                            onAdjust={() => setAdjustTarget(item)}
                                            onDelete={() => setDeleteTarget(item)}
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
                    </>
                ) : activeTab === 'movements' ? (
                    <StockMovementTable movements={movements} isLoading={isLoading} />
                ) : activeTab === 'suppliers' ? (
                    <>
                        {/* Accounts-payable aging — what's owed to suppliers, by age. */}
                        {apAging && apAging.totals?.total > 0 && (
                            <div style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                <div style={{ padding: '10px 16px', background: 'var(--notion-bg-secondary)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Payables aging (owed to suppliers)</span>
                                    <span style={{ color: 'var(--notion-red)' }}>Total Rs {(Number(apAging.totals.total) || 0).toLocaleString()}</span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                        <thead style={{ color: 'var(--notion-text-secondary)' }}>
                                            <tr>{['Supplier', 'Current', '31–60d', '61–90d', '90d+', 'Total'].map((h, i) => (
                                                <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--notion-border)' }}>{h}</th>
                                            ))}</tr>
                                        </thead>
                                        <tbody>
                                            {apAging.vendors.map((v: any) => (
                                                <tr key={v.vendorId} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                    <td style={{ padding: '8px 16px', fontWeight: 500 }}>{v.vendorName}</td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'right' }}>{v.current ? `Rs ${v.current.toLocaleString()}` : '–'}</td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'right', color: v.d30 ? 'var(--notion-orange)' : undefined }}>{v.d30 ? `Rs ${v.d30.toLocaleString()}` : '–'}</td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'right', color: v.d60 ? 'var(--notion-orange)' : undefined }}>{v.d60 ? `Rs ${v.d60.toLocaleString()}` : '–'}</td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'right', color: v.d90 ? 'var(--notion-red)' : undefined }}>{v.d90 ? `Rs ${v.d90.toLocaleString()}` : '–'}</td>
                                                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>Rs {(Number(v.total) || 0).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, minWidth: '220px', maxWidth: '320px' }}>
                                <Input type="text" placeholder="Search suppliers..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} icon={<Search size={16} />} />
                            </div>
                            <Button onClick={() => { setEditingVendor(null); setVendorFormOpen(true); }}><Plus size={14} style={{ marginRight: '6px' }} /> Add Supplier</Button>
                        </div>
                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                        <tr>
                                            {['Name', 'Contact', 'Email', 'Phone', 'Tax #', 'Status', 'Actions'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                        {vendors.filter(v =>
                                            (v.name || '').toLowerCase().includes(supplierSearch.toLowerCase()) ||
                                            (v.contactPerson || '').toLowerCase().includes(supplierSearch.toLowerCase()) ||
                                            (v.email || '').toLowerCase().includes(supplierSearch.toLowerCase())
                                        ).map(v => (
                                            <tr key={v.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{v.name}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{v.contactPerson || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{v.email || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{v.phone || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{v.taxNumber || '-'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: v.isActive ? 'var(--notion-green-bg)' : 'var(--notion-gray-bg)', color: v.isActive ? 'var(--notion-green)' : 'var(--notion-text-muted)' }}>
                                                        {v.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <RowAction icon={<Pencil size={15} />} label="Edit supplier" color="var(--notion-blue)" onClick={() => { setEditingVendor(v); setVendorFormOpen(true); }} />
                                                        <RowAction icon={<Wallet size={15} />} label="Finance & payables" color="var(--notion-green)" onClick={async () => { setVendorFinanceTarget(v); const data = await getVendorFinance(v.id); setVendorFinanceData(data); }} />
                                                        <RowAction icon={<Trash2 size={15} />} label="Delete supplier" color="var(--notion-red)" onClick={() => setVendorDeleteTarget(v)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {vendors.length === 0 && (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                    No suppliers found. <button onClick={() => { setEditingVendor(null); setVendorFormOpen(true); }} style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', cursor: 'pointer', textDecoration: 'underline' }}>Add one</button>
                                </div>
                            )}
                        </div>
                    </>
                ) : activeTab === 'warehouses' ? (
                    <>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, minWidth: '220px', maxWidth: '320px' }}>
                                <Input type="text" placeholder="Search warehouses..." value={warehouseSearch} onChange={e => setWarehouseSearch(e.target.value)} icon={<Search size={16} />} />
                            </div>
                            <Button onClick={() => { setEditingWarehouse(null); setWhFormOpen(true); }}><Plus size={14} style={{ marginRight: '6px' }} /> Add Warehouse</Button>
                        </div>
                        <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                                        <tr>
                                            {['Name', 'Location', 'Status', 'Created', 'Actions'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody style={{ borderTop: '1px solid var(--notion-border)' }}>
                                        {warehouses.filter(w =>
                                            (w.name || '').toLowerCase().includes(warehouseSearch.toLowerCase()) ||
                                            (w.location || '').toLowerCase().includes(warehouseSearch.toLowerCase())
                                        ).map(w => (
                                            <tr key={w.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{w.name}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>{w.location || '-'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: w.isActive ? 'var(--notion-green-bg)' : 'var(--notion-gray-bg)', color: w.isActive ? 'var(--notion-green)' : 'var(--notion-text-muted)' }}>
                                                        {w.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--notion-text-secondary)' }}>
                                                    {new Date(w.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <RowAction icon={<Pencil size={15} />} label="Edit warehouse" color="var(--notion-blue)" onClick={() => { setEditingWarehouse(w); setWhFormOpen(true); }} />
                                                        <RowAction icon={<Wallet size={15} />} label="Stock value" color="var(--notion-green)" onClick={async () => { setWhFinanceTarget(w); const data = await getWarehouseFinance(w.id); setWhFinanceData(data); }} />
                                                        <RowAction icon={<Trash2 size={15} />} label="Delete warehouse" color="var(--notion-red)" onClick={() => setWhDeleteTarget(w)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {warehouses.length === 0 && (
                                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                    No warehouses found. <button onClick={() => { setEditingWarehouse(null); setWhFormOpen(true); }} style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', cursor: 'pointer', textDecoration: 'underline' }}>Add one</button>
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>

            <InventoryFormModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(undefined); }}
                onSubmit={handleCreateItem}
                editingItem={editingItem}
                warehouses={warehouses}
                vendors={vendors}
            />

            <AdjustStockModal
                isOpen={!!adjustTarget}
                onClose={() => setAdjustTarget(undefined)}
                item={adjustTarget}
                onAdjust={(id, adj, reason) => adjustStock(id, adj, reason)}
            />

            <SecurityConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteItem(deleteTarget.id);
                    setDeleteTarget(null);
                }}
                title="Delete Inventory Item"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
                confirmText="Delete Item"
                isDestructive
            />

            {/* Warehouse Form Modal */}
            {whFormOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setWhFormOpen(false)}>
                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '100%', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Name *</label>
                                <input id="wh-name" type="text" defaultValue={editingWarehouse?.name || ''} placeholder="Main Store" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Location</label>
                                <input id="wh-location" type="text" defaultValue={editingWarehouse?.location || ''} placeholder="Building A, Floor 1" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
                                <Button variant="secondary" onClick={() => setWhFormOpen(false)}>Cancel</Button>
                                <Button onClick={async () => {
                                    const name = (document.getElementById('wh-name') as HTMLInputElement)?.value;
                                    const location = (document.getElementById('wh-location') as HTMLInputElement)?.value;
                                    if (!name) return;
                                    const ok = editingWarehouse ? await updateWarehouse(editingWarehouse.id, { name, location }) : await addWarehouse({ name, location });
                                    if (ok) setWhFormOpen(false);
                                }}>{editingWarehouse ? 'Save' : 'Create'}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Vendor Form Modal */}
            {vendorFormOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setVendorFormOpen(false)}>
                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '100%', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>{editingVendor ? 'Edit Supplier' : 'Add Supplier'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Name *</label>
                                <input id="v-name" type="text" defaultValue={editingVendor?.name || ''} placeholder="ABC Supplies" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Contact Person</label>
                                <input id="v-contact" type="text" defaultValue={editingVendor?.contactPerson || ''} placeholder="John Doe" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Email</label>
                                <input id="v-email" type="email" defaultValue={editingVendor?.email || ''} placeholder="john@abc.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Phone</label>
                                <input id="v-phone" type="text" defaultValue={editingVendor?.phone || ''} placeholder="+91 98765 43210" style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: '14px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
                                <Button variant="secondary" onClick={() => setVendorFormOpen(false)}>Cancel</Button>
                                <Button onClick={async () => {
                                    const name = (document.getElementById('v-name') as HTMLInputElement)?.value;
                                    const contactPerson = (document.getElementById('v-contact') as HTMLInputElement)?.value;
                                    const email = (document.getElementById('v-email') as HTMLInputElement)?.value;
                                    const phone = (document.getElementById('v-phone') as HTMLInputElement)?.value;
                                    if (!name) return;
                                    const data = { name, contactPerson, email, phone };
                                    const ok = editingVendor ? await updateVendor(editingVendor.id, data) : await addVendor(data);
                                    if (ok) setVendorFormOpen(false);
                                }}>{editingVendor ? 'Save' : 'Create'}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Warehouse Finance Modal */}
            {whFinanceTarget && whFinanceData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => { setWhFinanceTarget(null); setWhFinanceData(null); }}>
                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{whFinanceTarget.name} — Finance</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                            <div style={{ background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>{whFinanceData.count || 0}</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Items Stored</div>
                            </div>
                            <div style={{ background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>Rs {(whFinanceData.totalValue || 0).toLocaleString()}</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Value</div>
                            </div>
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Items</h4>
                        {whFinanceData.items?.length ? (
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'var(--notion-bg-secondary)' }}>
                                    <tr><th style={{ textAlign: 'left', padding: '8px' }}>Item</th><th style={{ textAlign: 'right', padding: '8px' }}>Qty</th><th style={{ textAlign: 'right', padding: '8px' }}>Value</th></tr>
                                </thead>
                                <tbody>
                                    {whFinanceData.items.map((it: any) => (
                                        <tr key={it.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '8px' }}>{it.name}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{it.quantity || 0}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>Rs {((it.unitCost || 0) * (it.quantity || 0)).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p style={{ color: 'var(--notion-text-secondary)' }}>No items in this warehouse.</p>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                            <Button variant="secondary" onClick={() => { setWhFinanceTarget(null); setWhFinanceData(null); }}>Close</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vendor Finance Modal */}
            {vendorFinanceTarget && vendorFinanceData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => { setVendorFinanceTarget(null); setVendorFinanceData(null); }}>
                    <div style={{ background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>{vendorFinanceTarget.name} — Finance</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                            <div style={{ background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>{vendorFinanceData.count || 0}</div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Received POs</div>
                            </div>
                            <div style={{ background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>Rs {(Number(vendorFinanceData.totalSpend) || 0).toLocaleString()}</div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Total Purchased</div>
                            </div>
                            <div style={{ background: (Number(vendorFinanceData.outstanding) || 0) > 0 ? 'var(--notion-red-bg)' : 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: (Number(vendorFinanceData.outstanding) || 0) > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>Rs {(Number(vendorFinanceData.outstanding) || 0).toLocaleString()}</div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Outstanding (paid Rs {(Number(vendorFinanceData.totalPaid) || 0).toLocaleString()})</div>
                            </div>
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Purchase Orders</h4>
                        {vendorFinanceData.purchaseOrders?.length ? (
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'var(--notion-bg-secondary)' }}>
                                    <tr><th style={{ textAlign: 'left', padding: '8px' }}>PO #</th><th style={{ textAlign: 'right', padding: '8px' }}>Amount</th><th style={{ textAlign: 'left', padding: '8px' }}>Date</th></tr>
                                </thead>
                                <tbody>
                                    {vendorFinanceData.purchaseOrders.map((po: any) => (
                                        <tr key={po.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <td style={{ padding: '8px' }}>{po.poNumber || po.id}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>Rs {(po.totalCost || 0).toLocaleString()}</td>
                                            <td style={{ padding: '8px', color: 'var(--notion-text-secondary)' }}>{po.receivedDate ? new Date(po.receivedDate).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p style={{ color: 'var(--notion-text-secondary)' }}>No received purchase orders for this supplier.</p>}

                        {vendorFinanceData.payments?.length ? (
                            <>
                                <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 'var(--space-5) 0 var(--space-3)' }}>Payments made</h4>
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {vendorFinanceData.payments.map((p: any) => (
                                            <tr key={p.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '8px', color: 'var(--notion-text-secondary)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                                                <td style={{ padding: '8px' }}>{p.paymentMethod || 'CASH'}{p.reference ? ` · ${p.reference}` : ''}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--notion-green)', fontWeight: 600 }}>Rs {(Number(p.amount) || 0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        ) : null}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
                            <Button
                                onClick={async () => {
                                    const amt = window.prompt(`Pay supplier "${vendorFinanceTarget.name}". Amount (outstanding Rs ${(Number(vendorFinanceData.outstanding) || 0).toLocaleString()}):`);
                                    const amount = parseFloat(amt || '');
                                    if (!amount || amount <= 0) return;
                                    try {
                                        await api.post(`/inventory/vendors/${vendorFinanceTarget.id}/pay`, { amount, paymentMethod: 'CASH' });
                                        toast.success('Supplier payment recorded');
                                        const data = await getVendorFinance(vendorFinanceTarget.id);
                                        setVendorFinanceData(data);
                                        loadApAging();
                                    } catch (e: any) { toast.error(e?.message || 'Payment failed'); }
                                }}
                            ><Wallet size={14} style={{ marginRight: 6 }} /> Pay supplier</Button>
                            <Button variant="secondary" onClick={() => { setVendorFinanceTarget(null); setVendorFinanceData(null); }}>Close</Button>
                        </div>
                    </div>
                </div>
            )}

            <SecurityConfirmModal
                isOpen={!!whDeleteTarget}
                onClose={() => setWhDeleteTarget(null)}
                onConfirm={async () => {
                    if (!whDeleteTarget) return;
                    await deleteWarehouse(whDeleteTarget.id);
                    setWhDeleteTarget(null);
                }}
                title="Delete Warehouse"
                message={`Delete warehouse "${whDeleteTarget?.name}"? This cannot be undone.`}
                confirmText="Delete"
                isDestructive
            />

            <SecurityConfirmModal
                isOpen={!!vendorDeleteTarget}
                onClose={() => setVendorDeleteTarget(null)}
                onConfirm={async () => {
                    if (!vendorDeleteTarget) return;
                    await deleteVendor(vendorDeleteTarget.id);
                    setVendorDeleteTarget(null);
                }}
                title="Delete Supplier"
                message={`Delete supplier "${vendorDeleteTarget?.name}"? This cannot be undone.`}
                confirmText="Delete"
                isDestructive
            />
        </DashboardLayout>
    );
}
