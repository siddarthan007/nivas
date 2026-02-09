import { lazy, Suspense } from "react";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { usePathname } from "@/lib/router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LicenseGuard from "@/components/auth/LicenseGuard";
import { PERMISSIONS } from "@/lib/constants/permissions";

// Lazy-loaded page imports for code splitting
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const RoomsPage = lazy(() => import("@/pages/rooms/RoomsPage"));
const BookingsPage = lazy(() => import("@/pages/bookings/BookingsPage"));
const BookingGanttPage = lazy(() => import("@/pages/bookings/BookingGanttPage"));
const OrdersPage = lazy(() => import("@/pages/orders/OrdersPage"));
const HousekeepingPage = lazy(() => import("@/pages/housekeeping/HousekeepingPage"));
const StaffPage = lazy(() => import("@/pages/staff/StaffPage"));
const InventoryPage = lazy(() => import("@/pages/inventory/InventoryPage"));
const MenuPage = lazy(() => import("@/pages/menu/MenuPage"));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"));
const TenantsPage = lazy(() => import("@/pages/tenants/TenantsPage"));
const LicensesPage = lazy(() => import("@/pages/licenses/LicensesPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const AuditLogsPage = lazy(() => import("@/pages/audit/AuditLogsPage"));
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage"));
const GuestPortalPage = lazy(() => import("@/pages/guest/GuestPortalPage"));
const FloorPlanPage = lazy(() => import("@/pages/operations/FloorPlanPage"));
const TablePlanPage = lazy(() => import("@/pages/operations/TablePlanPage"));
const RolesPage = lazy(() => import("@/pages/iam/RolesPage"));
const PlansPage = lazy(() => import("@/pages/plans/PlansPage"));
const FinancePage = lazy(() => import("@/pages/finance/FinancePage"));
const RevenuePage = lazy(() => import("@/pages/revenue/RevenuePage"));
const CRMPage = lazy(() => import("@/pages/crm/CRMPage"));
const EventsPage = lazy(() => import("@/pages/events/EventsPage"));
const KitchenDisplayPage = lazy(() => import("@/pages/kitchen/KitchenDisplayPage"));
const MessagesPage = lazy(() => import("@/pages/communications/MessagesPage"));
const AttendancePage = lazy(() => import("@/pages/staff/AttendancePage"));
const ProcurementPage = lazy(() => import("@/pages/inventory/ProcurementPage"));
const FacilitiesPage = lazy(() => import("@/pages/operations/FacilitiesPage"));
const CorporatePage = lazy(() => import("@/pages/corporate/CorporatePage"));
const ChannelManagerPage = lazy(() => import("@/pages/saas/ChannelManagerPage"));
const SaaSBillingPage = lazy(() => import("@/pages/saas/SaaSBillingPage"));
const CommandPalette = lazy(() => import("@/components/ui/CommandPalette"));

// CSS imports
import "./styles/design-tokens.css";
import "./styles/typography.css";
import "./styles/animations.css";
import "./index.css";

interface RouteConfig {
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  permission?: string;
}

const protectedRoutes: Record<string, RouteConfig> = {
  '/dashboard': { component: DashboardPage },
  '/dashboard/rooms': { component: RoomsPage, permission: PERMISSIONS.ROOMS.READ },
  '/dashboard/bookings': { component: BookingsPage, permission: PERMISSIONS.BOOKINGS.READ },
  '/dashboard/bookings/calendar': { component: BookingGanttPage, permission: PERMISSIONS.BOOKINGS.READ },
  '/dashboard/orders': { component: OrdersPage, permission: PERMISSIONS.ORDERS.READ },
  '/dashboard/housekeeping': { component: HousekeepingPage, permission: PERMISSIONS.HOUSEKEEPING.VIEW },
  '/dashboard/staff': { component: StaffPage, permission: PERMISSIONS.USERS.READ },
  '/dashboard/inventory': { component: InventoryPage, permission: PERMISSIONS.INVENTORY.READ },
  '/dashboard/menu': { component: MenuPage, permission: PERMISSIONS.MENU.VIEW },
  '/dashboard/reports': { component: ReportsPage, permission: PERMISSIONS.REPORTS.VIEW_SALES },
  '/dashboard/tenants': { component: TenantsPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/dashboard/licenses': { component: LicensesPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/dashboard/settings': { component: SettingsPage, permission: PERMISSIONS.SETTINGS.MANAGE_GENERAL },
  '/dashboard/audit': { component: AuditLogsPage, permission: PERMISSIONS.AUDIT_LOGS.VIEW },
  '/dashboard/analytics': { component: AnalyticsPage, permission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS },
  '/dashboard/operations/floor-plan': { component: FloorPlanPage, permission: PERMISSIONS.ROOMS.MANAGE_LAYOUT },
  '/dashboard/operations/tables': { component: TablePlanPage, permission: PERMISSIONS.RESTAURANT.VIEW_TABLES },
  '/dashboard/roles': { component: RolesPage, permission: PERMISSIONS.ROLES.READ },
  '/dashboard/plans': { component: PlansPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/dashboard/finance': { component: FinancePage, permission: PERMISSIONS.FINANCE.VIEW_RECORDS },
  '/dashboard/revenue': { component: RevenuePage, permission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS },
  '/dashboard/crm': { component: CRMPage, permission: PERMISSIONS.CRM.VIEW_GUESTS },
  '/dashboard/events': { component: EventsPage, permission: PERMISSIONS.BANQUETS.VIEW },
  '/dashboard/kitchen': { component: KitchenDisplayPage, permission: PERMISSIONS.ORDERS.READ },
  '/dashboard/messages': { component: MessagesPage, permission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES },
  '/dashboard/attendance': { component: AttendancePage, permission: PERMISSIONS.USERS.READ },
  '/dashboard/procurement': { component: ProcurementPage, permission: PERMISSIONS.INVENTORY.MANAGE_PROCUREMENT },
  '/dashboard/operations/facilities': { component: FacilitiesPage, permission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES },
  '/dashboard/corporate': { component: CorporatePage, permission: PERMISSIONS.CRM.MANAGE_GUESTS },
  '/dashboard/channel-manager': { component: ChannelManagerPage, permission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS },
  '/dashboard/saas-billing': { component: SaaSBillingPage },
};

function PageLoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--notion-bg)',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <div className="animate-spin" style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid var(--notion-border)',
          borderTopColor: 'var(--notion-blue)',
        }} />
        <span style={{
          color: 'var(--notion-text-secondary)',
          fontSize: '13px',
        }}>
          Loading...
        </span>
      </div>
    </div>
  );
}

function AppContent() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname === '/') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  // Guest Portal (public route with own auth)
  if (pathname === '/guest' || pathname.startsWith('/guest/')) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <GuestPortalPage />
      </Suspense>
    );
  }

  // Check exact match first
  const routeConfig = protectedRoutes[pathname];
  if (routeConfig) {
    const PageComponent = routeConfig.component;
    return (
      <ProtectedRoute requiredPermission={routeConfig.permission}>
        <LicenseGuard>
          <Suspense fallback={<PageLoadingFallback />}>
            <PageComponent />
          </Suspense>
        </LicenseGuard>
      </ProtectedRoute>
    );
  }

  // Fallback for /dashboard prefix
  if (pathname.startsWith('/dashboard')) {
    return (
      <ProtectedRoute>
        <LicenseGuard>
          <Suspense fallback={<PageLoadingFallback />}>
            <DashboardPage />
          </Suspense>
        </LicenseGuard>
      </ProtectedRoute>
    );
  }

  // 404 fallback
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--notion-bg)',
      flexDirection: 'column',
      gap: 'var(--space-4)',
    }}>
      <h1 style={{
        fontSize: '48px',
        fontWeight: '700',
        color: 'var(--notion-text)',
      }}>404</h1>
      <p style={{
        fontSize: '14px',
        color: 'var(--notion-text-secondary)',
      }}>Page not found</p>
      <a
        href="/dashboard"
        style={{
          color: 'var(--notion-blue)',
          textDecoration: 'none',
          fontSize: '14px',
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}

import { CommandPaletteProvider } from "@/lib/contexts/CommandPaletteContext";
import GlobalKeyboardShortcuts from "@/components/ui/GlobalKeyboardShortcuts";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import OfflineBanner from "@/components/ui/OfflineBanner";

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CommandPaletteProvider>
          <GlobalKeyboardShortcuts />
          <AppContent />
          <Suspense fallback={null}>
            <CommandPalette />
          </Suspense>
          <OfflineBanner />
        </CommandPaletteProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
