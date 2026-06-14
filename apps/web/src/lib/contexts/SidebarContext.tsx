import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface NotificationCounts {
    messages: number;
    tasks: number;
    leaves: number;
    [key: string]: number;
}

interface SidebarContextType {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    favorites: string[];
    toggleFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;
    // Navigation order for drag-and-drop
    navOrder: string[];
    reorderNav: (newOrder: string[]) => void;
    // Mobile state
    isMobileOpen: boolean;
    setIsMobileOpen: (open: boolean) => void;
    // Notification counts
    notificationCounts: NotificationCounts;
    setNotificationCounts: (counts: NotificationCounts) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

const FAVORITES_STORAGE_KEY = "nivas-sidebar-favorites";
const COLLAPSED_STORAGE_KEY = "nivas-sidebar-collapsed";
const NAV_ORDER_STORAGE_KEY = "nivas-nav-order";

const DEFAULT_NAV_ORDER = [
    "dashboard", "tasks", "messages", "calendar",
    "leaves", "attendance", "directory", "credentials"
];

function loadFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage might be full or disabled
    }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isCollapsed, setIsCollapsedState] = useState(() =>
        loadFromStorage(COLLAPSED_STORAGE_KEY, false)
    );
    const [favorites, setFavorites] = useState<string[]>(() =>
        loadFromStorage(FAVORITES_STORAGE_KEY, [])
    );
    const [navOrder, setNavOrder] = useState<string[]>(() =>
        loadFromStorage(NAV_ORDER_STORAGE_KEY, DEFAULT_NAV_ORDER)
    );
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [notificationCounts, setNotificationCounts] = useState<NotificationCounts>({
        messages: 0,
        tasks: 0,
        leaves: 0,
    });

    // Persist collapsed state
    const setIsCollapsed = (collapsed: boolean) => {
        setIsCollapsedState(collapsed);
        saveToStorage(COLLAPSED_STORAGE_KEY, collapsed);
    };

    // Persist favorites
    useEffect(() => {
        saveToStorage(FAVORITES_STORAGE_KEY, favorites);
    }, [favorites]);

    // Persist nav order
    useEffect(() => {
        saveToStorage(NAV_ORDER_STORAGE_KEY, navOrder);
    }, [navOrder]);

    const toggleFavorite = (id: string) => {
        setFavorites(prev =>
            prev.includes(id)
                ? prev.filter(f => f !== id)
                : [...prev, id]
        );
    };

    const isFavorite = (id: string) => favorites.includes(id);

    const reorderNav = (newOrder: string[]) => {
        setNavOrder(newOrder);
    };

    return (
        <SidebarContext.Provider value={{
            isCollapsed,
            setIsCollapsed,
            favorites,
            toggleFavorite,
            isFavorite,
            navOrder,
            reorderNav,
            isMobileOpen,
            setIsMobileOpen,
            notificationCounts,
            setNotificationCounts,
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar(): SidebarContextType {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
