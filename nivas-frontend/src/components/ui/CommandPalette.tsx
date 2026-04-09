'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    LayoutDashboard,
    Bed,
    CalendarDays,
    UtensilsCrossed,
    Package,
    Sparkles,
    Calendar,
    BarChart3,
    Users,
    Shield,
    CreditCard,
    TrendingUp,
    Building2,
    Ticket,
    FileText,
    Settings,
    LogOut,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    CornerDownLeft,
    BookOpen,
    MessageSquare,
    UserCircle,
} from 'lucide-react';
import KeyboardHint from './KeyboardHint';
import { useAuth } from '@/lib/contexts/AuthContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useCommandPalette } from '@/lib/contexts/CommandPaletteContext';
import { useRouter } from '@/lib/router';
import { PERMISSIONS } from '@/lib/constants/permissions';

interface NavigationItem {
    id: string;
    label: string;
    path: string;
    Icon: typeof LayoutDashboard;
    group: string;
    keywords: string;
    allowedUserTypes?: Array<'SUPER_ADMIN' | 'HOTEL_STAFF'>;
    requiredPermissions?: string[];
}

interface QuickAction {
    id: string;
    label: string;
    keywords: string;
    shortcut?: string[];
    Icon?: typeof LogOut;
    allowedUserTypes?: Array<'SUPER_ADMIN' | 'HOTEL_STAFF'>;
    requiredPermissions?: string[];
}

const navigationItems: NavigationItem[] = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard, group: 'PMS', keywords: 'home overview', allowedUserTypes: ['HOTEL_STAFF'] },
    { id: 'rooms', label: 'Rooms', path: '/dashboard/rooms', Icon: Bed, group: 'PMS', keywords: 'bedroom accommodation', allowedUserTypes: ['HOTEL_STAFF'] },
    { id: 'bookings', label: 'Bookings', path: '/dashboard/bookings', Icon: CalendarDays, group: 'PMS', keywords: 'reservations guests', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.BOOKINGS.READ] },
    { id: 'orders', label: 'Orders', path: '/dashboard/orders', Icon: UtensilsCrossed, group: 'PMS', keywords: 'pos food restaurant', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.ORDERS.READ] },
    { id: 'menu', label: 'Menu', path: '/dashboard/menu', Icon: BookOpen, group: 'PMS', keywords: 'food dishes items', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.MENU.VIEW] },
    { id: 'housekeeping', label: 'Housekeeping', path: '/dashboard/housekeeping', Icon: Sparkles, group: 'PMS', keywords: 'cleaning maintenance', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.HOUSEKEEPING.VIEW] },
    { id: 'calendar', label: 'Calendar', path: '/dashboard/bookings/calendar', Icon: Calendar, group: 'PMS', keywords: 'gantt schedule', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.BOOKINGS.READ] },
    { id: 'inventory', label: 'Inventory', path: '/dashboard/inventory', Icon: Package, group: 'PMS', keywords: 'stock items supplies', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.INVENTORY.READ] },
    { id: 'messages', label: 'Messages', path: '/dashboard/messages', Icon: MessageSquare, group: 'PMS', keywords: 'chat inbox communication', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.COMMUNICATIONS.READ_MESSAGES] },
    { id: 'subscription', label: 'My Subscription', path: '/dashboard/saas-billing', Icon: CreditCard, group: 'Management', keywords: 'billing plan payment license', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.FINANCE.VIEW_RECORDS] },
    { id: 'staff', label: 'Staff', path: '/dashboard/staff', Icon: Users, group: 'Management', keywords: 'employees team members', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.USERS.READ] },
    { id: 'roles', label: 'Roles', path: '/dashboard/roles', Icon: Shield, group: 'Management', keywords: 'permissions access', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.ROLES.READ] },
    { id: 'reports', label: 'Reports', path: '/dashboard/reports', Icon: BarChart3, group: 'Management', keywords: 'analytics statistics', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.REPORTS.VIEW_SALES] },
    { id: 'finance', label: 'Finance', path: '/dashboard/finance', Icon: CreditCard, group: 'Finance', keywords: 'billing invoices payments', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.FINANCE.VIEW_RECORDS] },
    { id: 'revenue', label: 'Revenue', path: '/dashboard/revenue', Icon: TrendingUp, group: 'Finance', keywords: 'pricing discounts', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.ANALYTICS.VIEW_FINANCIALS] },
    { id: 'crm', label: 'CRM', path: '/dashboard/crm', Icon: Users, group: 'CRM', keywords: 'guests corporate agents', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.CRM.VIEW_GUESTS] },
    { id: 'events', label: 'Events', path: '/dashboard/events', Icon: Calendar, group: 'CRM', keywords: 'banquets venues bookings', allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.BANQUETS.VIEW] },
    { id: 'profile', label: 'Profile', path: '/dashboard/profile', Icon: UserCircle, group: 'Personal', keywords: 'account user settings', allowedUserTypes: ['HOTEL_STAFF', 'SUPER_ADMIN'] },
    { id: 'saas-dashboard', label: 'Overview', path: '/dashboard', Icon: LayoutDashboard, group: 'SaaS Admin', keywords: 'home statistics', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'tenants', label: 'Tenants', path: '/dashboard/tenants', Icon: Building2, group: 'SaaS Admin', keywords: 'hotels properties', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'licenses', label: 'Licenses', path: '/dashboard/licenses', Icon: Ticket, group: 'SaaS Admin', keywords: 'license access entitlements', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'plans', label: 'Plans', path: '/dashboard/plans', Icon: Package, group: 'SaaS Admin', keywords: 'packages pricing', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'analytics', label: 'SaaS Analytics', path: '/dashboard/analytics', Icon: TrendingUp, group: 'SaaS Admin', keywords: 'revenue stats', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'audit', label: 'Audit Logs', path: '/dashboard/audit', Icon: FileText, group: 'SaaS Admin', keywords: 'history activity', allowedUserTypes: ['SUPER_ADMIN'] },
    { id: 'settings', label: 'Settings', path: '/dashboard/settings', Icon: Settings, group: 'SaaS Admin', keywords: 'configuration preferences', allowedUserTypes: ['SUPER_ADMIN'] },
];

const quickActions: QuickAction[] = [
    { id: 'new-booking', label: 'New Booking', keywords: 'create reservation', shortcut: ['N', 'B'], allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.BOOKINGS.CREATE] },
    { id: 'new-order', label: 'New Order', keywords: 'create pos', shortcut: ['N', 'O'], allowedUserTypes: ['HOTEL_STAFF'], requiredPermissions: [PERMISSIONS.ORDERS.CREATE] },
    { id: 'logout', label: 'Logout', keywords: 'signout exit', Icon: LogOut },
];

export default function CommandPalette() {
    const [search, setSearch] = useState('');
    const { user, logout, impersonation } = useAuth();
    const { can } = usePermissions();
    const { isOpen, toggle, close } = useCommandPalette();
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                toggle();
                return;
            }

            if (event.key === 'Escape' && isOpen) {
                close();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [close, isOpen, toggle]);

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    const filteredItems = useMemo(() => {
        if (!user) return [];

        return navigationItems.filter((item) => {
            if (item.allowedUserTypes && !item.allowedUserTypes.includes(user.userType as 'SUPER_ADMIN' | 'HOTEL_STAFF')) {
                return false;
            }

            if (user.userType !== 'SUPER_ADMIN' && item.requiredPermissions && !item.requiredPermissions.every((permission) => can(permission))) {
                return false;
            }

            return true;
        });
    }, [can, user]);

    const filteredQuickActions = useMemo(() => {
        if (!user) return [];

        return quickActions.filter((action) => {
            if (action.id === 'logout' && impersonation.isImpersonating) {
                return false;
            }

            if (action.allowedUserTypes && !action.allowedUserTypes.includes(user.userType as 'SUPER_ADMIN' | 'HOTEL_STAFF')) {
                return false;
            }

            if (user.userType !== 'SUPER_ADMIN' && action.requiredPermissions && !action.requiredPermissions.every((permission) => can(permission))) {
                return false;
            }

            return true;
        });
    }, [can, impersonation.isImpersonating, user]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, NavigationItem[]> = {};

        filteredItems.forEach((item) => {
            if (!groups[item.group]) {
                groups[item.group] = [];
            }
            groups[item.group]!.push(item);
        });

        return groups;
    }, [filteredItems]);

    const handleAction = useCallback((actionId: string) => {
        close();

        switch (actionId) {
            case 'logout':
                logout();
                break;
            case 'new-booking':
                router.push('/dashboard/bookings?action=new');
                break;
            case 'new-order':
                router.push('/dashboard/orders?action=new');
                break;
            default:
                break;
        }
    }, [close, logout, router]);

    const handleNavigate = useCallback((path: string) => {
        close();
        router.push(path);
    }, [close, router]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="command-palette-overlay"
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: '16px',
                    paddingTop: 'max(16px, 12vh)',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={close}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                    className="command-palette-modal"
                    style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '560px',
                        maxHeight: 'min(85vh, 500px)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <Command label="Command Palette" className="flex flex-col h-full">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-4)',
                                borderBottom: '1px solid var(--notion-divider)',
                            }}
                        >
                            <Search size={18} style={{ color: 'var(--notion-text-secondary)', flexShrink: 0 }} />
                            <Command.Input
                                value={search}
                                onValueChange={setSearch}
                                autoFocus
                                placeholder="Search pages, actions..."
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    outline: 'none',
                                    backgroundColor: 'transparent',
                                    fontSize: '16px',
                                    color: 'var(--notion-text)',
                                    fontFamily: 'inherit',
                                }}
                                className="placeholder:text-[15px]"
                            />
                            <KeyboardHint keys={['esc']} />
                        </div>

                        <Command.List
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: 'var(--space-2)',
                            }}
                        >
                            <Command.Empty
                                style={{
                                    padding: 'var(--space-8)',
                                    textAlign: 'center',
                                    color: 'var(--notion-text-secondary)',
                                    fontSize: '14px',
                                }}
                            >
                                No results found for "{search}"
                            </Command.Empty>

                            <Command.Group
                                heading={
                                    <span
                                        style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: 'var(--notion-text-tertiary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            padding: 'var(--space-2) var(--space-3)',
                                            display: 'block',
                                        }}
                                    >
                                        Quick Actions
                                    </span>
                                }
                            >
                                {filteredQuickActions.map((action) => (
                                    <Command.Item
                                        key={action.id}
                                        value={`${action.label} ${action.keywords}`}
                                        onSelect={() => handleAction(action.id)}
                                        className="command-item"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-3)',
                                            padding: 'var(--space-3)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            color: 'var(--notion-text)',
                                        }}
                                    >
                                        {action.Icon && <action.Icon size={16} style={{ opacity: 0.7 }} />}
                                        <span style={{ flex: 1 }}>{action.label}</span>
                                        {action.shortcut && <KeyboardHint keys={action.shortcut} />}
                                    </Command.Item>
                                ))}
                            </Command.Group>

                            <Command.Separator
                                style={{
                                    height: '1px',
                                    backgroundColor: 'var(--notion-divider)',
                                    margin: 'var(--space-2) 0',
                                }}
                            />

                            {Object.entries(groupedItems).map(([groupName, items]) => (
                                <Command.Group
                                    key={groupName}
                                    heading={
                                        <span
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: 'var(--notion-text-tertiary)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                padding: 'var(--space-2) var(--space-3)',
                                                display: 'block',
                                            }}
                                        >
                                            {groupName}
                                        </span>
                                    }
                                >
                                    {items.map((item) => (
                                        <Command.Item
                                            key={item.id}
                                            value={`${item.label} ${item.keywords}`}
                                            onSelect={() => handleNavigate(item.path)}
                                            className="command-item"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-3)',
                                                padding: 'var(--space-3)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                color: 'var(--notion-text)',
                                            }}
                                        >
                                            <item.Icon size={16} style={{ opacity: 0.7 }} />
                                            <span style={{ flex: 1 }}>{item.label}</span>
                                            <ChevronRight size={14} style={{ opacity: 0.3 }} />
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            ))}
                        </Command.List>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 'var(--space-3) var(--space-4)',
                                borderTop: '1px solid var(--notion-divider)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                fontSize: '11px',
                                color: 'var(--notion-text-tertiary)',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowUp size={11} />
                                    <ArrowDown size={11} />
                                    navigate
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CornerDownLeft size={11} />
                                    select
                                </span>
                            </div>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <KeyboardHint keys={['g']} /> then key for quick nav
                            </span>
                        </div>
                    </Command>
                </motion.div>
            </motion.div>

            <style>{`
                .command-item[data-selected="true"],
                .command-item[aria-selected="true"] {
                    background-color: var(--notion-bg-hover) !important;
                }
                .command-item:hover {
                    background-color: var(--notion-bg-hover);
                }
            `}</style>
        </AnimatePresence>
    );
}