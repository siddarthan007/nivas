import Link from "@/components/ui/Link";
import { usePathname, useRouter } from "@/lib/router";
import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import {
  LayoutDashboard,
  Menu,
  CheckSquare,
  MessageSquare,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Users,
  LogOut,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Key,
  FileText,
  Building2,
  Ticket,
  TrendingUp,
  Settings,
  Bed,
  UtensilsCrossed,
  Sparkles,
  Package,
  ShoppingCart,
  BarChart3,
  CreditCard,
  Grid3X3,
  SquareStack,
  UserCircle,
  Contact,
  PartyPopper,
  BookOpen,
  Monitor,
  Star,
  DoorOpen,
  UserPlus,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import DraggableNav from "./DraggableNav";
import NotificationCenter from "@/components/ui/NotificationCenter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import KeyboardHint from "@/components/ui/KeyboardHint";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useCommandPalette } from "@/lib/contexts/CommandPaletteContext";
import { useHotelPlan } from "@/lib/hooks/useHotelPlan";
import { useModuleConfig } from "@/lib/hooks/useModuleConfig";
import { useMessages } from "@/lib/hooks/useMessages";

interface StaffNavItem {
  id: string;
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  permission?: string | string[];
  section?: string;
}

const staffItems: StaffNavItem[] = [
  { id: "dashboard", href: "/hotel", label: "Dashboard", Icon: LayoutDashboard },
  { id: "rooms", href: "/hotel/rooms", label: "Rooms", Icon: Bed, permission: ["rooms:read", "rooms:view_status"], section: "Front Office" },
  { id: "bookings", href: "/hotel/bookings", label: "Bookings", Icon: CalendarDays, permission: "bookings:read", section: "Front Office" },
  { id: "housekeeping", href: "/hotel/housekeeping", label: "Housekeeping", Icon: Sparkles, permission: ["housekeeping:view", "housekeeping:view_tasks"], section: "Front Office" },
  { id: "floor-plan", href: "/hotel/operations/floor-plan", label: "Floor Plan", Icon: Grid3X3, permission: "rooms:manage_layout", section: "Front Office" },
  { id: "guests", href: "/hotel/guests", label: "Customers", Icon: Contact, permission: "crm:view_guests", section: "Front Office" },
  { id: "orders", href: "/hotel/orders", label: "Orders", Icon: UtensilsCrossed, permission: "orders:read", section: "Food & Beverage" },
  { id: "kitchen", href: "/hotel/kitchen", label: "Kitchen Display", Icon: UtensilsCrossed, permission: "orders:read", section: "Food & Beverage" },
  { id: "menu", href: "/hotel/menu", label: "Menu", Icon: BookOpen, permission: "menu:view", section: "Food & Beverage" },
  { id: "table-plan", href: "/hotel/operations/tables", label: "Table Plan", Icon: SquareStack, permission: "restaurant:view_tables", section: "Food & Beverage" },
  { id: "inventory", href: "/hotel/inventory", label: "Inventory", Icon: Package, permission: "inventory:read", section: "Inventory" },
  { id: "procurement", href: "/hotel/procurement", label: "Procurement", Icon: ShoppingCart, permission: "inventory:read", section: "Inventory" },
  { id: "finance", href: "/hotel/finance", label: "Finance", Icon: CreditCard, permission: "finance:view_records", section: "Finance" },
  { id: "reports", href: "/hotel/reports", label: "Reports", Icon: BarChart3, permission: "reports:view_sales", section: "Finance" },
  { id: "reviews", href: "/hotel/reviews", label: "Reviews", Icon: Star, permission: "analytics:view_operations", section: "Finance" },
  { id: "staff", href: "/hotel/staff", label: "Staff", Icon: Users, permission: "users:read", section: "People" },
  { id: "roles", href: "/hotel/roles", label: "Roles", Icon: Shield, permission: "roles:read", section: "People" },
  { id: "events", href: "/hotel/events", label: "Events", Icon: PartyPopper, permission: "banquets:view", section: "Venues" },
  { id: "messages", href: "/hotel/messages", label: "Messages", Icon: MessageSquare, permission: "communications:read_messages", section: "More" },
  { id: "facilities", href: "/hotel/operations/facilities", label: "Facilities", Icon: Building2, permission: "operations:setup_facilities", section: "More" },
];

/** Map sidebar nav ids to subscription package module ids */
const NAV_TO_PLAN_MODULE: Record<string, string> = {
  pos: 'orders',
  guests: 'crm',
  procurement: 'inventory',
  events: 'venues',
};

const VENUE_PLAN_MODULES = ['events', 'venues', 'banquets'] as const;

/** Plan feature flags that gate sidebar items (synced from subscription). */
const NAV_FEATURE_GATE: Record<string, string> = {
  inventory: 'enableInventory',
  procurement: 'enableInventory',
  housekeeping: 'enableHousekeeping',
  events: 'enableBanquets',
};

function resolvePlanModule(navId: string): string {
  return NAV_TO_PLAN_MODULE[navId] ?? navId;
}

function hasNavPlanModule(navId: string, hasModule: (id: string) => boolean): boolean {
  const resolved = resolvePlanModule(navId);
  if (resolved === 'venues' || navId === 'events') {
    return VENUE_PLAN_MODULES.some((m) => hasModule(m));
  }
  return hasModule(resolved);
}

const superAdminItems = [
  { id: "admin-dashboard", href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { id: "tenants", href: "/admin/tenants", label: "Tenants", Icon: Building2 },
  { id: "licenses", href: "/admin/licenses", label: "Licenses", Icon: Ticket },
  { id: "plans", href: "/admin/plans", label: "Plans", Icon: Package },
  { id: "analytics", href: "/admin/analytics", label: "SaaS Analytics", Icon: TrendingUp },
  { id: "audit", href: "/admin/audit", label: "Audit Logs", Icon: FileText },
  { id: "settings", href: "/admin/settings", label: "System Settings", Icon: Settings },
];

const adminItems = [
  { id: "saas-billing", href: "/hotel/billing", label: "Subscription", Icon: CreditCard },
  { id: "audit", href: "/hotel/audit", label: "Audit Logs", Icon: FileText },
  { id: "settings", href: "/hotel/settings", label: "Settings", Icon: Settings },
];


import ChangePasswordModal from "../modals/ChangePasswordModal";

// Persisted across Sidebar remounts (each page wraps its own DashboardLayout, so
// navigating remounts the sidebar). Keeps the nav scroll position stable.
let savedNavScroll = 0;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathRef = useRef(pathname);
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Restore the saved scroll synchronously before paint so there's no jump.
  useLayoutEffect(() => {
    if (navScrollRef.current) navScrollRef.current.scrollTop = savedNavScroll;
  }, []);
  const { user, logout, impersonation } = useAuth();
  const { isAdmin: checkIsAdmin, isUserType, can } = usePermissions();
  const { isCollapsed, setIsCollapsed, notificationCounts, setNotificationCounts, isMobileOpen, setIsMobileOpen } = useSidebar();
  const { open: openCommandPalette } = useCommandPalette();
  const { hasModule, hasFeature } = useHotelPlan();
  const { isRouteEnabled } = useModuleConfig();
  const { conversations } = useMessages();
  const totalUnreadMessages = conversations.reduce((sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0), 0);
  const [errorMessage, setErrorMessage] = useState(false);

  useEffect(() => {
    setNotificationCounts({ ...notificationCounts, messages: totalUnreadMessages });
  }, [totalUnreadMessages]);

  const isAdmin = checkIsAdmin();

  const filteredStaffItems = useMemo(() => {
    return staffItems.filter(item => {
      // Permission check (string = single, string[] = any match)
      if (item.permission) {
        const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
        if (!perms.some(p => can(p))) return false;
      }
      // Plan module check (skip for dashboard, settings, billing, attendance, saas-billing)
      const alwaysVisible = ['dashboard', 'saas-billing', 'attendance', 'reviews', 'messages', 'facilities'];
      if (!alwaysVisible.includes(item.id) && !hasNavPlanModule(item.id, hasModule)) return false;
      const featureGate = NAV_FEATURE_GATE[item.id];
      if (featureGate && !hasFeature(featureGate)) return false;
      // Standalone module config check
      if (!isRouteEnabled(item.id)) return false;
      return true;
    });
  }, [can, hasModule, hasFeature, isRouteEnabled]);

  // Auto-collapse on mobile/small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsCollapsed, setIsMobileOpen]);

  const isActiveRoute = (href: string) => {
    if (href === "/hotel" || href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  };

  const isCompact = isCollapsed && !isMobileOpen;
  const sidebarWidth = isCompact ? '52px' : '240px';

  // Sync sidebar width to CSS variable for layout responsiveness
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  useEffect(() => {
    if (isMobileOpen && prevPathRef.current !== pathname) {
      setIsMobileOpen(false);
    }
    prevPathRef.current = pathname;
  }, [pathname, isMobileOpen, setIsMobileOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Mobile Trigger Button (Floating) */}
      <button
        style={{
          position: 'fixed',
          top: '12px',
          left: '12px',
          zIndex: 40,
          background: 'var(--notion-bg-secondary)',
          border: '1px solid var(--notion-border)',
          borderRadius: '4px',
          padding: '8px',
          display: isCompact && window.innerWidth < 1024 ? 'flex' : 'none', // Only show when sidebar is hidden on mobile
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
        }}
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Sidebar Container */}
      <aside
        className={`sidebar ${isCompact ? "sidebar--collapsed" : ""} ${isMobileOpen ? "sidebar--mobile-open" : ""}`}
        style={{
          width: sidebarWidth,
          height: '100vh',
          backgroundColor: 'var(--notion-bg-secondary)',
          borderRight: '1px solid var(--notion-border)',
          position: 'fixed',
          top: impersonation.isImpersonating ? '42px' : 0,
          left: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease, top 200ms ease',
          overflow: 'hidden'
        }}
      >
        {/* Workspace Header */}
        <div
          style={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            padding: isCompact ? '0 8px' : '0 16px',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--notion-divider)',
            flexShrink: 0
          }}
        >
          {!isCompact ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <img
                src="/logo.svg"
                alt="Nivas PMS"
                style={{ width: '24px', height: '24px', objectFit: 'contain' }}
              />
              <span style={{
                fontWeight: '600',
                fontSize: '16px',
                color: 'var(--notion-text)',
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, sans-serif'
              }}>
                Nivas PMS
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsCollapsed(false)}
              className="hover-bg"
              style={{
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: 'none',
                color: 'var(--notion-text-secondary)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Expand Sidebar"
            >
              <ChevronsRight size={18} />
            </button>
          )}

          {/* Right side actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {!isCompact && <NotificationCenter />}
            {!isCompact && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hover-bg sidebar-collapse-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--notion-text-secondary)',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronsLeft size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Nav Area */}
        <div
          ref={navScrollRef}
          onScroll={(e) => { savedNavScroll = e.currentTarget.scrollTop; }}
          className="sidebar-nav-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isCompact ? '12px 0' : '12px 8px'
          }}>
          {/* Search Bar - Above Navigation */}
          {!isCompact ? (
            <button
              onClick={openCommandPalette}
              className="hover-bg"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                marginBottom: '12px',
                background: 'var(--notion-bg)',
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--notion-text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <Search size={16} />
              <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
              <KeyboardHint keys={['ctrl', 'k']} size="sm" />
            </button>
          ) : (
            <button
              onClick={openCommandPalette}
              className="hover-bg"
              title="Search (Ctrl+K)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                margin: '0 auto 12px',
                background: 'var(--notion-bg)',
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--notion-text-secondary)'
              }}
            >
              <Search size={18} />
            </button>
          )}

          {/* Prominent POS quick-launch */}
          {!isUserType("SUPER_ADMIN") && can("orders:create") && (
            <button
              onClick={() => router.push("/hotel/pos")}
              className="hover-op"
              title="Open POS"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isCompact ? 0 : '8px',
                width: isCompact ? '40px' : '100%', height: '38px', margin: isCompact ? '0 auto 12px' : '0 0 12px',
                background: 'var(--notion-blue)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              <Monitor size={16} />
              {!isCompact && <span>Open POS</span>}
            </button>
          )}

          {/* Main Navigation */}
          <DraggableNav
            items={isUserType("SUPER_ADMIN") ? superAdminItems : filteredStaffItems}
            isCollapsed={isCompact}
            isMobile={isMobileOpen}
            notificationCounts={{
              messages: notificationCounts.messages,
              tasks: notificationCounts.tasks,
              leaves: notificationCounts.leaves,
            }}
          />

          {/* Admin Section (Only for Hotel Admins, not Super Admin in this block) */}
          {!isUserType("SUPER_ADMIN") && isAdmin && (
            <>
              {!isCompact && (
                <div style={{
                  marginTop: '16px',
                  marginBottom: '8px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                }}>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--notion-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Management
                  </p>
                </div>
              )}
              <div style={{ padding: '0 4px' }}>
                {adminItems.map((item) => {
                  const Icon = item.Icon;
                  const active = isActiveRoute(item.href);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={isCompact ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCompact ? 'center' : 'flex-start',
                        padding: isCompact ? '8px' : '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                        backgroundColor: active ? 'var(--notion-bg-active)' : 'transparent',
                        color: active ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        fontWeight: active ? 500 : 400,
                        marginBottom: '2px',
                      }}
                      className="hover-bg"
                    >
                      <Icon
                        size={18}
                        style={{ color: active ? 'var(--notion-text)' : 'var(--notion-text-secondary)', flexShrink: 0 }}
                      />
                      {!isCompact && (
                        <span style={{
                          marginLeft: '10px',
                          fontSize: '14px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* User Footer */}
        <div style={{
          padding: isCollapsed ? '12px' : '12px',
          borderTop: '1px solid var(--notion-divider)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: isCollapsed ? 'center' : 'flex-start'
        }}>
          <Link href={isUserType("SUPER_ADMIN") ? "/admin/profile" : "/hotel/profile"}>
            <Avatar src={undefined} name={user?.name || "User"} size="sm" style={{ cursor: 'pointer' }} />
          </Link>

          {!isCompact && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--notion-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user?.name || "User"}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>
                {user?.role?.name || "STAFF"}
              </div>
            </div>
          )}

          {!isCompact && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ThemeToggle />
              <button
                onClick={() => setErrorMessage(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--notion-text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
                }}
                className="hover-bg"
                title="Change Password"
              >
                <Key size={16} />
              </button>
              {!impersonation.isImpersonating && (
                <button
                  onClick={() => logout()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--notion-text-secondary)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  className="hover-bg"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside >

      <ChangePasswordModal isOpen={errorMessage} onClose={() => setErrorMessage(false)} />
    </>
  );
}