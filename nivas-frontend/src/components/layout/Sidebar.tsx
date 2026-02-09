import Link from "@/components/ui/Link";
import { usePathname } from "@/lib/router";
import { useState, useEffect, useRef, useMemo } from "react";
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
  BarChart3,
  CreditCard,
  Grid3X3,
  SquareStack,
  UserCircle,
  PartyPopper,
  BookOpen,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useSidebar } from "@/lib/contexts/SidebarContext";
import DraggableNav from "./DraggableNav";
import NotificationCenter from "@/components/ui/NotificationCenter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import KeyboardHint from "@/components/ui/KeyboardHint";
import { useCommandPalette } from "@/lib/contexts/CommandPaletteContext";
import { useHotelPlan } from "@/lib/hooks/useHotelPlan";

interface StaffNavItem {
  id: string;
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  permission?: string;
}

const staffItems: StaffNavItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "rooms", href: "/dashboard/rooms", label: "Rooms", Icon: Bed, permission: "rooms:read" },
  { id: "bookings", href: "/dashboard/bookings", label: "Bookings", Icon: CalendarDays, permission: "bookings:read" },
  { id: "orders", href: "/dashboard/orders", label: "Orders", Icon: UtensilsCrossed, permission: "orders:read" },
  { id: "menu", href: "/dashboard/menu", label: "Menu", Icon: BookOpen, permission: "menu:view" },
  { id: "housekeeping", href: "/dashboard/housekeeping", label: "Housekeeping", Icon: Sparkles, permission: "housekeeping:view" },
  { id: "gantt", href: "/dashboard/bookings/calendar", label: "Calendar", Icon: CalendarRange, permission: "bookings:read" },
  { id: "floor-plan", href: "/dashboard/operations/floor-plan", label: "Floor Plan", Icon: Grid3X3, permission: "rooms:manage_layout" },
  { id: "table-plan", href: "/dashboard/operations/tables", label: "Table Plan", Icon: SquareStack, permission: "restaurant:view_tables" },
  { id: "inventory", href: "/dashboard/inventory", label: "Inventory", Icon: Package, permission: "inventory:read" },
  { id: "reports", href: "/dashboard/reports", label: "Reports", Icon: BarChart3, permission: "reports:view_sales" },
  { id: "staff", href: "/dashboard/staff", label: "Staff", Icon: Users, permission: "users:read" },
  { id: "roles", href: "/dashboard/roles", label: "Roles", Icon: Shield, permission: "roles:read" },
  { id: "finance", href: "/dashboard/finance", label: "Finance", Icon: CreditCard, permission: "finance:view_records" },
  { id: "revenue", href: "/dashboard/revenue", label: "Revenue", Icon: TrendingUp, permission: "analytics:view_financials" },
  { id: "crm", href: "/dashboard/crm", label: "CRM", Icon: UserCircle, permission: "crm:view_guests" },
  { id: "events", href: "/dashboard/events", label: "Events", Icon: PartyPopper, permission: "banquets:view" },
  { id: "kitchen", href: "/dashboard/kitchen", label: "Kitchen Display", Icon: UtensilsCrossed, permission: "orders:read" },
  { id: "messages", href: "/dashboard/messages", label: "Messages", Icon: MessageSquare, permission: "communications:read_messages" },
  { id: "attendance", href: "/dashboard/attendance", label: "Attendance", Icon: Clock },
  { id: "procurement", href: "/dashboard/procurement", label: "Procurement", Icon: Package, permission: "inventory:manage_procurement" },
  { id: "facilities", href: "/dashboard/operations/facilities", label: "Facilities", Icon: Building2, permission: "operations:setup_facilities" },
  { id: "corporate", href: "/dashboard/corporate", label: "Corporate", Icon: Building2, permission: "crm:manage_guests" },
  { id: "channel-manager", href: "/dashboard/channel-manager", label: "Channel Manager", Icon: TrendingUp, permission: "system:manage_settings" },
  { id: "saas-billing", href: "/dashboard/saas-billing", label: "Billing", Icon: CreditCard },
];

// Super Admin Navigation
const superAdminItems = [
  { id: "dashboard", href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { id: "tenants", href: "/dashboard/tenants", label: "Tenants", Icon: Building2 },
  { id: "plans", href: "/dashboard/plans", label: "Plans", Icon: Package },
  { id: "analytics", href: "/dashboard/analytics", label: "SaaS Analytics", Icon: TrendingUp },
  { id: "audit", href: "/dashboard/audit", label: "Audit Logs", Icon: FileText },
  { id: "settings", href: "/dashboard/settings", label: "System Settings", Icon: Settings },
];

const adminItems = [
  { id: "audit", href: "/dashboard/audit", label: "Audit Logs", Icon: FileText },
  { id: "settings", href: "/dashboard/settings", label: "Settings", Icon: Settings },
];


import ChangePasswordModal from "../modals/ChangePasswordModal";

export default function Sidebar() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const { user, logout, impersonation } = useAuth();
  const { isAdmin: checkIsAdmin, isUserType, can } = usePermissions();
  const { isCollapsed, setIsCollapsed, notificationCounts, isMobileOpen, setIsMobileOpen } = useSidebar();
  const { open: openCommandPalette } = useCommandPalette();
  const { hasModule } = useHotelPlan();
  const [errorMessage, setErrorMessage] = useState(false);

  const isAdmin = checkIsAdmin();

  const filteredStaffItems = useMemo(() => {
    return staffItems.filter(item => {
      // Permission check
      if (item.permission && !can(item.permission)) return false;
      // Plan module check (skip for dashboard, settings, billing, attendance, saas-billing)
      const alwaysVisible = ['dashboard', 'saas-billing', 'attendance'];
      if (!alwaysVisible.includes(item.id) && !hasModule(item.id)) return false;
      return true;
    });
  }, [can, hasModule]);

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
    if (href === "/dashboard") return pathname === "/dashboard";
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
            padding: isCompact ? '0 12px' : '0 16px',
            justifyContent: isCompact ? 'center' : 'space-between',
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
                cursor: 'pointer'
              }}
              title="Expand Sidebar"
            >
              <ChevronsRight size={18} />
            </button>
          )}

          {/* Right side actions when expanded */}
          {!isCompact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <NotificationCenter />
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
            </div>
          )}
        </div>

        {/* Scrollable Nav Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 4px'
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                margin: '0 auto 12px',
                background: 'var(--notion-bg)',
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--notion-text-secondary)'
              }}
              title="Search (Ctrl+K)"
            >
              <Search size={16} />
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
          <Link href="/dashboard/profile">
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
                {user?.role || "STAFF"}
              </div>
            </div>
          )}

          {!isCompact && (
            <div style={{ display: 'flex' }}>
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