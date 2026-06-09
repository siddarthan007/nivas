import { useState, type CSSProperties, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from '@/components/ui/Link';
import { usePathname, prefetch } from '@/lib/router';
import { useSidebar } from '@/lib/contexts/SidebarContext';
import NotificationBadge from '@/components/ui/NotificationBadge';
import SidebarHoverPreview from './SidebarHoverPreview';

interface NavItemProps {
    id: string;
    href: string;
    label: string;
    Icon: LucideIcon;
    isCollapsed: boolean;
    notificationCount?: number;
    isDraggable?: boolean;
}

export default function NavItem({
    id,
    href,
    label,
    Icon,
    isCollapsed,
    notificationCount = 0,
    isDraggable = true,
}: NavItemProps) {
    const pathname = usePathname();
    const { favorites, toggleFavorite } = useSidebar();
    const isFavorite = favorites.includes(id);
    const [isHovered, setIsHovered] = useState(false);

    const isActive = href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname.startsWith(href);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled: !isDraggable,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        cursor: isDraggable ? 'grab' : 'default',
    };

    const handleFavoriteClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(id);
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        void prefetch(href);
    };

    return (
        <SidebarHoverPreview itemId={id} isCollapsed={isCollapsed}>
            <div
                ref={setNodeRef}
                style={style as CSSProperties}
                {...attributes}
                {...listeners}
                className="nav-item-wrapper"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Link
                    href={href}
                    title={isCollapsed ? label : undefined}
                    onClick={(event) => {
                        if (isDragging) {
                            event.preventDefault();
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: isCollapsed ? '8px' : '6px 12px',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: isActive ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: isActive ? 'var(--notion-bg-tertiary)' : 'transparent',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '14px',
                        transition: 'background-color 0.1s ease',
                        position: 'relative',
                    }}
                    className="hover-bg"
                >
                    <Icon size={isCollapsed ? 20 : 18} strokeWidth={isCollapsed ? 2 : 1.5} />

                    {!isCollapsed && <span>{label}</span>}

                    {!isCollapsed && (
                        <div
                            style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <motion.button
                                onClick={handleFavoriteClick}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '2px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: isFavorite ? 'var(--notion-yellow)' : 'var(--notion-text-muted)',
                                    opacity: isFavorite || isHovered ? 1 : 0,
                                    transition: 'opacity 0.15s ease',
                                }}
                                className="favorite-star"
                                whileTap={{ scale: 0.85 }}
                                animate={isFavorite ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ duration: 0.2 }}
                            >
                                <Star size={14} fill={isFavorite ? 'var(--notion-yellow)' : 'none'} />
                            </motion.button>

                            {notificationCount > 0 && <NotificationBadge count={notificationCount} />}
                        </div>
                    )}

                    {isCollapsed && notificationCount > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-4px',
                            }}
                        >
                            <NotificationBadge count={notificationCount} />
                        </div>
                    )}
                </Link>
            </div>
        </SidebarHoverPreview>
    );
}