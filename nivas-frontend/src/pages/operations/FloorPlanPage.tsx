'use client';

import { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent } from '@dnd-kit/core';
import { useLayout } from '@/lib/hooks/useLayout';
import { useRouter } from '@/lib/router';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Plus, Save, RotateCw, LayoutGrid, Users, FileText, Wrench, Sparkles, UtensilsCrossed, Receipt } from 'lucide-react';
import { toast } from 'sonner';

// --- Draggable Components ---

function DraggableRoom({ id, x, y, width, height, data, rotation = 0, disabled = false }: any) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `room-${id}`,
        data: { id, type: 'ROOM', x, y, rotation },
        disabled
    });
    const [hovered, setHovered] = useState(false);

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${rotation}deg)`,
    } : {
        transform: `rotate(${rotation}deg)`
    };

    const statusColors = {
        AVAILABLE: 'var(--notion-green)',
        OCCUPIED: 'var(--notion-red)',
        RESERVED: 'var(--notion-orange)',
        CLEANING: 'var(--notion-blue)',
        MAINTENANCE: 'var(--notion-gray)'
    };

    const borderColor = statusColors[data.status as keyof typeof statusColors] || 'var(--notion-border)';
    const guestName = data.guestName || data.currentGuest || data.booking?.guestName;
    const checkoutDate = data.checkOutDate || data.booking?.checkOut;

    return (
        <div
            ref={setNodeRef}
            style={{
                position: 'absolute',
                left: x,
                top: y,
                width: width || 80,
                height: height || 60,
                backgroundColor: 'var(--notion-bg)',
                border: `2px solid ${borderColor}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                zIndex: hovered ? 30 : 10,
                boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--notion-text)',
                ...style
            }}
            {...listeners}
            {...attributes}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span>{data.number}</span>
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--notion-text-secondary)' }}>
                {data.type}
            </span>
            {hovered && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '140px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 50,
                    whiteSpace: 'nowrap'
                }}>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Room {data.number}</div>
                    <div style={{ color: borderColor, fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>{data.status}</div>
                    {guestName && (
                        <div style={{ color: 'var(--notion-text-secondary)', fontSize: '11px' }}>
                            Guest: {guestName}
                        </div>
                    )}
                    {checkoutDate && (
                        <div style={{ color: 'var(--notion-text-secondary)', fontSize: '11px' }}>
                            Out: {new Date(checkoutDate).toLocaleDateString()}
                        </div>
                    )}
                    <div style={{ marginTop: '4px', display: 'flex', gap: '4px', fontSize: '10px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--notion-bg-secondary)' }}>
                            {data.status === 'OCCUPIED' ? 'Checked In' : data.status === 'AVAILABLE' ? 'Ready' : data.status}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function DraggableTable({ id, x, y, width, height, data, rotation = 0, disabled = false }: any) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `table-${id}`,
        data: { id, type: 'TABLE', x, y, rotation },
        disabled
    });
    const [hovered, setHovered] = useState(false);

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${rotation}deg)`,
    } : {
        transform: `rotate(${rotation}deg)`
    };

    const isRound = (data.tableNumber || '').toLowerCase().includes('r') || (width === height && width < 100);
    const statusColor = data.status === 'OCCUPIED' ? 'var(--notion-red)' : data.status === 'RESERVED' ? 'var(--notion-orange)' : 'var(--notion-green)';

    return (
        <div
            ref={setNodeRef}
            style={{
                position: 'absolute',
                left: x,
                top: y,
                width: width || 80,
                height: height || 80,
                backgroundColor: 'var(--notion-bg)',
                border: `2px solid ${hovered ? statusColor : 'var(--notion-border)'}`,
                borderRadius: isRound ? '50%' : '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                zIndex: hovered ? 30 : 10,
                boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--notion-text)',
                ...style
            }}
            {...listeners}
            {...attributes}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span>{data.tableNumber}</span>
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--notion-text-secondary)' }}>
                {data.capacity} ppl
            </span>
            {hovered && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '120px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 50,
                    whiteSpace: 'nowrap'
                }}>
                    <div style={{ fontWeight: 600 }}>Table {data.tableNumber}</div>
                    <div style={{ color: statusColor, fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>{data.status || 'AVAILABLE'}</div>
                    <div style={{ color: 'var(--notion-text-secondary)', fontSize: '11px' }}>Capacity: {data.capacity} ppl</div>
                    {data.location && <div style={{ color: 'var(--notion-text-secondary)', fontSize: '11px' }}>{data.location.replace(/_/g, ' ')}</div>}
                </div>
            )}
        </div>
    );
}

// Sidebar Item Component
function SidebarItem({ item, type }: { item: any, type: 'ROOM' | 'TABLE' }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `sidebar-${type}-${item.id}`,
        data: { id: item.id, type: `SIDEBAR_${type}`, item }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={{
                padding: '8px 12px',
                border: '1px solid var(--notion-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--notion-bg)',
                marginBottom: '8px',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
                zIndex: 20,
                ...style
            }}
            {...listeners}
            {...attributes}
        >
            <span>{type === 'ROOM' ? `Room ${item.number}` : `Table ${item.tableNumber}`}</span>
            <span style={{ opacity: 0.7 }}>
                {type === 'ROOM' ? item.type : `${item.capacity} ppl`}
            </span>
        </div>
    );
}

// Droppable Canvas Component
function Canvas({ children }: { children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({
        id: 'canvas',
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                flex: 1,
                minHeight: '600px',
                backgroundColor: 'var(--notion-bg-secondary)',
                backgroundImage: 'radial-gradient(var(--notion-border) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                position: 'relative',
                overflow: 'visible',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)'
            }}
        >
            {children}
        </div>
    );
}

// --- Main Page Component ---

export default function FloorPlanPage() {
    const { rooms, tables, fetchVisualData, savePositions, isLoading } = useLayout();

    // State for visual editing
    const [isEditMode, setIsEditMode] = useState(false);

    // Local state to track positions before saving
    // keys: `room-{id}` or `table-{id}`
    const [localPositions, setLocalPositions] = useState<Record<string, any>>({});

    // Active drag item for DragOverlay
    const [activeDragItem, setActiveDragItem] = useState<any>(null);

    useEffect(() => {
        fetchVisualData();
    }, [fetchVisualData]);

    const getPosition = (id: number, type: 'ROOM' | 'TABLE', itemLayout: any) => {
        const key = `${type.toLowerCase()}-${id}`;
        const local = localPositions[key];
        if (local) return local;

        // If server data exists (x is defined)
        if (itemLayout && itemLayout.x !== undefined) {
            return itemLayout;
        }
        return null; // Unplaced
    };

    // Filter placed/unplaced items
    const placedRooms = rooms.filter(r => getPosition(r.id, 'ROOM', r.layoutProps));
    const unplacedRooms = rooms.filter(r => !getPosition(r.id, 'ROOM', r.layoutProps));

    const placedTables = tables.filter(t => getPosition(t.id, 'TABLE', t.layoutProps));
    const unplacedTables = tables.filter(t => !getPosition(t.id, 'TABLE', t.layoutProps));

    const handleDragEnd = (event: DragEndEvent) => {
        if (!isEditMode) return;

        const { active, over, delta } = event;
        if (!over || over.id !== 'canvas') return;

        const activeIdStr = active.id.toString();

        // --- Moving existing item on canvas ---
        if (activeIdStr.startsWith('room-') || activeIdStr.startsWith('table-')) {
            const isRoom = activeIdStr.startsWith('room-');
            const typeKey = isRoom ? 'room' : 'table';
            const itemId = active.data.current?.id;

            const currentX = active.data.current?.x || 0;
            const currentY = active.data.current?.y || 0;

            const newX = Math.max(0, currentX + delta.x);
            const newY = Math.max(0, currentY + delta.y);

            setLocalPositions(prev => ({
                ...prev,
                [`${typeKey}-${itemId}`]: {
                    ...prev[`${typeKey}-${itemId}`], // preserve other props
                    x: Math.round(newX / 20) * 20,
                    y: Math.round(newY / 20) * 20
                }
            }));
        }
        // --- Dragging from sidebar ---
        else if (activeIdStr.startsWith('sidebar-')) {
            const isRoom = activeIdStr.startsWith('sidebar-ROOM');
            const typeKey = isRoom ? 'room' : 'table';
            const itemId = active.data.current?.id;

            // Drop at a default location (could improve with cursor pos if DndKit allowed easy access here)
            // Or use active.rect but that's complex. simple defaults:
            setLocalPositions(prev => ({
                ...prev,
                [`${typeKey}-${itemId}`]: {
                    x: 100,
                    y: 100,
                    w: isRoom ? 100 : 80,
                    h: isRoom ? 60 : 80,
                    rotation: 0
                }
            }));
        }
    };

    const handleSave = async () => {
        const roomUpdates = [];
        const tableUpdates = [];

        for (const [key, layout] of Object.entries(localPositions)) {
            const [type, idStr] = key.split('-');
            if (!idStr) continue;
            const id = parseInt(idStr);

            if (type === 'room') {
                roomUpdates.push({ id, layout });
            } else if (type === 'table') {
                tableUpdates.push({ id, layout });
            }
        }

        if (roomUpdates.length === 0 && tableUpdates.length === 0) {
            toast.info('No changes to save');
            return;
        }

        const success = await savePositions(
            roomUpdates.length > 0 ? roomUpdates : undefined,
            tableUpdates.length > 0 ? tableUpdates : undefined
        );

        if (success) {
            toast.success('Layout saved successfully');
            fetchVisualData();
            setLocalPositions({});
        } else {
            toast.error('Failed to save layout');
        }
    };

    // Context menu state for right-click actions (Operation mode)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any; type: 'ROOM' | 'TABLE' } | null>(null);

    const handleItemClick = (item: any, type: 'ROOM' | 'TABLE') => {
        if (isEditMode) return;
        const msg = type === 'ROOM'
            ? `Room ${item.number}: ${item.status}`
            : `Table ${item.tableNumber}: ${item.status}`;
        toast.info(msg);
    };

    const handleContextMenu = (e: React.MouseEvent, item: any, type: 'ROOM' | 'TABLE') => {
        if (isEditMode) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item, type });
    };

    const closeContextMenu = () => setContextMenu(null);

    const router = useRouter();

    const handleContextAction = (action: string) => {
        if (!contextMenu) return;
        const { item, type } = contextMenu;
        if (type === 'ROOM') {
            switch (action) {
                case 'check-in': router.push(`/hotel/bookings?room=${item.number}`); break;
                case 'details': router.push(`/hotel/guests?room=${item.number}`); break;
                case 'cleaning': toast.success(`Room ${item.number} marked for cleaning`); break;
                case 'maintenance': toast.success(`Room ${item.number} set to maintenance`); break;
            }
        } else {
            switch (action) {
                case 'order': router.push(`/hotel/orders?table=${item.tableNumber}`); break;
                case 'bill': toast.info(`Bill for Table ${item.tableNumber}`); break;
                case 'status': toast.info(`Table ${item.tableNumber} status updated`); break;
            }
        }
        closeContextMenu();
    };

    if (isLoading && rooms.length === 0 && tables.length === 0) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Loading layout...</div>;
    }

    return (
        <DashboardLayout>
            <DndContext
                onDragStart={({ active }) => {
                    const data = active.data.current;
                    if (!data) return;
                    const isSidebar = active.id.toString().startsWith('sidebar-');
                    if (isSidebar) {
                        setActiveDragItem({ type: data.type === 'SIDEBAR_ROOM' ? 'ROOM' : 'TABLE', item: data.item });
                    } else {
                        setActiveDragItem({ type: data.type, item: data });
                    }
                }}
                onDragEnd={(event) => {
                    setActiveDragItem(null);
                    handleDragEnd(event);
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--notion-text)' }}>Floor Plan</h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                {isEditMode ? 'Drag items to arrange layout.' : 'View status and details.'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--notion-bg-secondary)', padding: '4px', borderRadius: '6px' }}>
                                <Button
                                    size="sm"
                                    variant={!isEditMode ? 'primary' : 'ghost'}
                                    onClick={() => setIsEditMode(false)}
                                >
                                    View
                                </Button>
                                <Button
                                    size="sm"
                                    variant={isEditMode ? 'primary' : 'ghost'}
                                    onClick={() => setIsEditMode(true)}
                                >
                                    Edit
                                </Button>
                            </div>
                            {isEditMode && (
                                <Button variant="primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Save size={16} /> Save Layout
                                </Button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 140px)' }}>
                        {/* Sidebar */}
                        {isEditMode && (
                            <div style={{
                                width: '260px',
                                backgroundColor: 'var(--notion-bg)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '16px',
                                overflowY: 'auto'
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--notion-text-secondary)' }}>
                                    Unplaced Rooms
                                </h3>
                                {unplacedRooms.map(room => (
                                    <SidebarItem key={room.id} item={room} type="ROOM" />
                                ))}
                                {unplacedRooms.length === 0 && <p style={{ fontSize: '13px', color: 'gray' }}>All rooms placed</p>}

                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: 'var(--notion-text-secondary)' }}>
                                    Unplaced Tables
                                </h3>
                                {unplacedTables.map(table => (
                                    <SidebarItem key={table.id} item={table} type="TABLE" />
                                ))}
                                {unplacedTables.length === 0 && <p style={{ fontSize: '13px', color: 'gray' }}>All tables placed</p>}
                            </div>
                        )}

                        {/* Canvas */}
                        <Canvas>
                            {placedRooms.map(room => {
                                const pos = getPosition(room.id, 'ROOM', room.layoutProps) || { x: 0, y: 0, w: 100, h: 60 };
                                return (
                                    <div key={`r-${room.id}`} onClick={(e) => { e.stopPropagation(); handleItemClick(room, 'ROOM'); }} onContextMenu={(e) => handleContextMenu(e, room, 'ROOM')}>
                                        <DraggableRoom
                                            id={room.id}
                                            x={pos.x}
                                            y={pos.y}
                                            width={pos.w || pos.width}
                                            height={pos.h || pos.height}
                                            rotation={pos.rotation}
                                            data={room}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                );
                            })}
                            {placedTables.map(table => {
                                const pos = getPosition(table.id, 'TABLE', table.layoutProps) || { x: 0, y: 0, w: 80, h: 80 };
                                return (
                                    <div key={`t-${table.id}`} onClick={(e) => { e.stopPropagation(); handleItemClick(table, 'TABLE'); }} onContextMenu={(e) => handleContextMenu(e, table, 'TABLE')}>
                                        <DraggableTable
                                            id={table.id}
                                            x={pos.x}
                                            y={pos.y}
                                            width={pos.w || pos.width}
                                            height={pos.h || pos.height}
                                            rotation={pos.rotation}
                                            data={table}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                );
                            })}
                        </Canvas>
                    </div>
                </div>
                <DragOverlay>
                    {activeDragItem && (
                        <div style={{
                            padding: '8px 12px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--notion-bg)',
                            boxShadow: 'var(--shadow-lg)',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--notion-text)',
                            opacity: 0.9,
                            cursor: 'grabbing',
                            zIndex: 1000,
                        }}>
                            {activeDragItem.type === 'ROOM'
                                ? `Room ${activeDragItem.item.number || activeDragItem.item.id}`
                                : `Table ${activeDragItem.item.tableNumber || activeDragItem.item.id}`}
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            {/* Status Legend */}
            {!isEditMode && (
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '0 24px 16px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)' }}>Status:</span>
                    {[
                        { label: 'Available', color: 'var(--notion-green)' },
                        { label: 'Occupied', color: 'var(--notion-red)' },
                        { label: 'Reserved', color: 'var(--notion-orange)' },
                        { label: 'Cleaning', color: 'var(--notion-blue)' },
                        { label: 'Maintenance', color: 'var(--notion-gray)' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color }} />
                            <span style={{ color: 'var(--notion-text-secondary)' }}>{s.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Context Menu (Right-Click) */}
            {contextMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }} />
                    <div style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 1000,
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '4px 0',
                        minWidth: '180px',
                    }}>
                        <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--notion-text-muted)', textTransform: 'uppercase' }}>
                            {contextMenu.type === 'ROOM' ? `Room ${contextMenu.item.number}` : `Table ${contextMenu.item.tableNumber}`}
                        </div>
                        {contextMenu.type === 'ROOM' ? (
                            <>
                                <button onClick={() => handleContextAction('check-in')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Check In / Out</button>
                                <button onClick={() => handleContextAction('details')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>View Guest Details</button>
                                <button onClick={() => handleContextAction('cleaning')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Mark for Cleaning</button>
                                <button onClick={() => handleContextAction('maintenance')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Maintenance Mode</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleContextAction('order')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Take Order</button>
                                <button onClick={() => handleContextAction('bill')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Print Bill</button>
                                <button onClick={() => handleContextAction('status')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: 'var(--notion-text)', background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Change Status</button>
                            </>
                        )}
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
