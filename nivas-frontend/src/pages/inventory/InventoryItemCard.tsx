import Button from '@/components/ui/Button';
import { AlertTriangle, Edit, Trash2 } from 'lucide-react';
import type { InventoryItem } from '@/lib/types/api.types';

interface Props {
    item: InventoryItem;
    onEdit: () => void;
    onAdjust: () => void;
    onDelete: () => void;
}

export default function InventoryItemCard({ item, onEdit, onAdjust, onDelete }: Props) {
    const isLowStock = item.currentStock <= item.minStock;
    const stockPercent = item.reorderLevel > 0 ? Math.min(100, (item.currentStock / item.reorderLevel) * 100) : 100;
    const stockColor = isLowStock ? 'var(--notion-red)' : stockPercent < 60 ? 'var(--notion-yellow)' : 'var(--notion-green)';

    return (
        <div
            style={{
                background: 'var(--notion-bg)',
                border: `1px solid ${isLowStock ? 'var(--notion-red)' : 'var(--notion-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 0,
                overflow: 'hidden',
                transition: 'transform 150ms ease, box-shadow 150ms ease',
            }}
            className="hover-shadow"
        >
            <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--notion-text)',
                            marginBottom: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        {item.sku && (
                            <span
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--notion-text-secondary)',
                                    fontFamily: 'monospace',
                                }}
                            >
                                {item.sku}
                            </span>
                        )}
                        {item.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                            style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                background: 'var(--notion-bg-secondary)',
                                color: 'var(--notion-text-secondary)',
                                border: '1px solid var(--notion-border)',
                            }}
                        >
                            {(item.category || '').toLowerCase()}
                        </span>
                        {item.status === 'DISCONTINUED' && (
                            <span
                                style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--notion-gray-bg)',
                                    color: 'var(--notion-text-muted)',
                                }}
                            >
                                Discontinued
                            </span>
                        )}
                        {isLowStock && (
                            <span
                                style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--notion-red-bg)',
                                    color: 'var(--notion-red)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                            >
                                <AlertTriangle size={10} /> Low
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 16px 12px' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: '6px',
                    }}
                >
                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Stock</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: stockColor }}>
                        {item.currentStock ?? 0}{' '}
                        <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--notion-text-secondary)' }}>
                            {item.unit}
                        </span>
                    </span>
                </div>
                <div
                    style={{
                        height: '4px',
                        borderRadius: '2px',
                        background: 'var(--notion-bg-secondary)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(5, stockPercent))}%`,
                            background: stockColor,
                            borderRadius: '2px',
                            transition: 'width 300ms ease',
                        }}
                    />
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1px',
                    background: 'var(--notion-border)',
                    borderTop: '1px solid var(--notion-border)',
                }}
            >
                <div style={{ padding: '8px 12px', background: 'var(--notion-bg)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--notion-text-secondary)', marginBottom: '1px' }}>
                        Min / Reorder
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                        {item.minStock} / {item.reorderLevel}
                    </div>
                </div>
                <div style={{ padding: '8px 12px', background: 'var(--notion-bg)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--notion-text-secondary)', marginBottom: '1px' }}>
                        Value
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-green)' }}>
                        NPR {((item.costPrice || 0) * (item.currentStock || 0)).toLocaleString()}
                    </div>
                </div>
                {item.warehouse && (
                    <div style={{ padding: '8px 12px', background: 'var(--notion-bg)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--notion-text-secondary)', marginBottom: '1px' }}>
                            Warehouse
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.warehouse.name}</div>
                    </div>
                )}
                {item.supplier && (
                    <div style={{ padding: '8px 12px', background: 'var(--notion-bg)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--notion-text-secondary)', marginBottom: '1px' }}>
                            Supplier
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.supplier}</div>
                    </div>
                )}
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '10px 12px',
                    borderTop: '1px solid var(--notion-border)',
                }}
            >
                <Button size="sm" variant="secondary" onClick={onAdjust} style={{ flex: 1 }}>
                    Adjust
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={onDelete} style={{ color: 'var(--notion-red)' }}>
                    <Trash2 size={14} />
                </Button>
            </div>
        </div>
    );
}
