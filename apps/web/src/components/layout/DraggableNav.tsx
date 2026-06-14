import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import NavItem from "./NavItem";
import type { LucideIcon } from "lucide-react";

interface NavItemData {
    id: string;
    href: string;
    label: string;
    Icon: LucideIcon;
    section?: string;
}

// Display order for grouped sections; unknown sections render after these.
const SECTION_ORDER = ['Workspace', 'Front Office', 'Food & Beverage', 'Inventory', 'Finance', 'People', 'More'];

interface DraggableNavProps {
    items: NavItemData[];
    isCollapsed: boolean;
    isMobile?: boolean;
    notificationCounts?: Record<string, number>;
}

export default function DraggableNav({
    items,
    isCollapsed,
    notificationCounts = {},
}: DraggableNavProps) {
    const { navOrder, reorderNav, favorites } = useSidebar();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sort items based on saved order
    const sortedItems = [...items].sort((a, b) => {
        const indexA = navOrder.indexOf(a.id);
        const indexB = navOrder.indexOf(b.id);

        // Items not in navOrder go to the end
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
    });

    // Separate favorites from regular items
    const favoriteItems = sortedItems.filter((item) => favorites.includes(item.id));
    const regularItems = sortedItems.filter((item) => !favorites.includes(item.id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = navOrder.indexOf(active.id as string);
            const newIndex = navOrder.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(navOrder, oldIndex, newIndex);
                reorderNav(newOrder);
            } else {
                // Handle items not yet in navOrder
                const allIds = sortedItems.map((item) => item.id);
                const activeIndex = allIds.indexOf(active.id as string);
                const overIndex = allIds.indexOf(over.id as string);
                const newOrder = arrayMove(allIds, activeIndex, overIndex);
                reorderNav(newOrder);
            }
        }
    };

    return (
        <DndContext
            id="sidebar-dnd-context"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
        >
            {/* Favorites Section */}
            {favoriteItems.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                    {!isCollapsed && (
                        <div
                            style={{
                                padding: "4px 12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "var(--notion-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                            }}
                        >
                            Favorites
                        </div>
                    )}
                    <SortableContext
                        items={favoriteItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {favoriteItems.map((item) => (
                            <NavItem
                                key={item.id}
                                id={item.id}
                                href={item.href}
                                label={item.label}
                                Icon={item.Icon}
                                isCollapsed={isCollapsed}
                                notificationCount={notificationCounts[item.id] || 0}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}

            {/* Regular items, grouped by section (each group is independently
                drag-sortable; ungrouped items fall under "Workspace"). */}
            {(() => {
                const groups = new Map<string, typeof regularItems>();
                for (const item of regularItems) {
                    const key = item.section || 'Workspace';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(item);
                }
                const orderedSections = [
                    ...SECTION_ORDER.filter(s => groups.has(s)),
                    ...Array.from(groups.keys()).filter(s => !SECTION_ORDER.includes(s)),
                ];
                return orderedSections.map((section) => {
                    const groupItems = groups.get(section)!;
                    return (
                        <div key={section} style={{ marginBottom: '10px' }}>
                            {!isCollapsed && section !== 'Workspace' && (
                                <div
                                    style={{
                                        padding: "4px 12px",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        color: "var(--notion-text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    {section}
                                </div>
                            )}
                            <SortableContext
                                items={groupItems.map((item) => item.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {groupItems.map((item) => (
                                    <NavItem
                                        key={item.id}
                                        id={item.id}
                                        href={item.href}
                                        label={item.label}
                                        Icon={item.Icon}
                                        isCollapsed={isCollapsed}
                                        notificationCount={notificationCounts[item.id] || 0}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    );
                });
            })()}
        </DndContext>
    );
}