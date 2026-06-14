import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { usePathname, useRouter } from "@/lib/router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LicenseGuard from "@/components/auth/LicenseGuard";
import ModuleGuard from "@/components/auth/ModuleGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PERMISSIONS } from "@/lib/constants/permissions";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy-loaded page imports for code splitting
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const RoomsPage = lazy(() => import("@/pages/rooms/RoomsPage"));
const BookingsPage = lazy(() => import("@/pages/bookings/BookingsPage"));
const OrdersPage = lazy(() => import("@/pages/orders/OrdersPage"));
const POSPage = lazy(() => import("@/pages/pos/POSPage"));
const HousekeepingPage = lazy(() => import("@/pages/housekeeping/HousekeepingPage"));
const StaffPage = lazy(() => import("@/pages/staff/StaffPage"));
const InventoryPage = lazy(() => import("@/pages/inventory/InventoryPage"));
const ProcurementHubPage = lazy(() => import("@/pages/inventory/ProcurementHubPage"));
const MenuPage = lazy(() => import("@/pages/menu/MenuPage"));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage"));
const ReviewsPage = lazy(() => import("@/pages/reviews/ReviewsPage"));
const WaiterKotReportPage = lazy(() => import("@/pages/reports/WaiterKotReportPage"));
const TenantsPage = lazy(() => import("@/pages/tenants/TenantsPage"));
const TenantDetailPage = lazy(() => import("@/pages/tenants/TenantDetailPage"));
const LicensesPage = lazy(() => import("@/pages/licenses/LicensesPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const AuditLogsPage = lazy(() => import("@/pages/audit/AuditLogsPage"));
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage"));
const GuestPortalPage = lazy(() => import("@/pages/guest/GuestPortalPage"));
const DigitalMenuPage = lazy(() => import("@/pages/menu/DigitalMenuPage"));
const PublicInvoicePage = lazy(() => import("@/pages/invoice/PublicInvoicePage"));
const FloorPlanPage = lazy(() => import("@/pages/operations/FloorPlanPage"));
const TablePlanPage = lazy(() => import("@/pages/operations/TablePlanPage"));
const RolesPage = lazy(() => import("@/pages/iam/RolesPage"));
const PlansPage = lazy(() => import("@/pages/plans/PlansPage"));
const FinancePage = lazy(() => import("@/pages/finance/FinancePage"));
const EventsPage = lazy(() => import("@/pages/events/EventsPage"));
const CreateCustomerPage = lazy(() => import("@/pages/guests/CreateCustomerPage"));
const CheckInPage = lazy(() => import("@/pages/bookings/CheckInPage"));
const KitchenDisplayPage = lazy(() => import("@/pages/kitchen/KitchenDisplayPage"));
const MessagesPage = lazy(() => import("@/pages/communications/MessagesPage"));
const FacilitiesPage = lazy(() => import("@/pages/operations/FacilitiesPage"));
const MaintenancePage = lazy(() => import("@/pages/operations/MaintenancePage"));
const SaaSBillingPage = lazy(() => import("@/pages/saas/SaaSBillingPage"));
const GuestPage = lazy(() => import("@/pages/guests/GuestPage"));
const CustomerDetailPage = lazy(() => import("@/pages/guests/CustomerDetailPage"));
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage"));
const CommandPalette = lazy(() => import("@/components/ui/CommandPalette"));

// CSS imports
import "./styles/theme-engine.css";
import "./styles/design-tokens.css";
import "./styles/typography.css";
import "./styles/animations.css";
import "./index.css";

interface RouteConfig {
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  permission?: string;
}

const adminRoutes: Record<string, RouteConfig> = {
  '/admin': { component: DashboardPage },
  '/admin/tenants': { component: TenantsPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/admin/licenses': { component: LicensesPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/admin/settings': { component: SettingsPage, permission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS },
  '/admin/audit': { component: AuditLogsPage, permission: PERMISSIONS.AUDIT_LOGS.VIEW },
  '/admin/analytics': { component: AnalyticsPage, permission: PERMISSIONS.SYSTEM.VIEW_SAAS_ANALYTICS },
  '/admin/plans': { component: PlansPage, permission: PERMISSIONS.SYSTEM.MANAGE_TENANTS },
  '/admin/profile': { component: ProfilePage },
};

const hotelRoutes: Record<string, RouteConfig> = {
  '/hotel': { component: DashboardPage },
  '/hotel/rooms': { component: RoomsPage, permission: PERMISSIONS.ROOMS.READ },
  '/hotel/bookings': { component: BookingsPage, permission: PERMISSIONS.BOOKINGS.READ },
  '/hotel/orders': { component: OrdersPage, permission: PERMISSIONS.ORDERS.READ },
  '/hotel/pos': { component: POSPage, permission: PERMISSIONS.ORDERS.CREATE },
  '/hotel/housekeeping': { component: HousekeepingPage, permission: PERMISSIONS.HOUSEKEEPING.VIEW },
  '/hotel/staff': { component: StaffPage, permission: PERMISSIONS.USERS.READ },
  '/hotel/inventory': { component: InventoryPage, permission: PERMISSIONS.INVENTORY.READ },
  '/hotel/procurement': { component: ProcurementHubPage, permission: PERMISSIONS.INVENTORY.READ },
  '/hotel/menu': { component: MenuPage, permission: PERMISSIONS.MENU.VIEW },
  '/hotel/reports': { component: ReportsPage, permission: PERMISSIONS.REPORTS.VIEW_SALES },
  '/hotel/reviews': { component: ReviewsPage, permission: PERMISSIONS.ANALYTICS.VIEW_OPERATIONS },
  '/hotel/reports/waiter-kot': { component: WaiterKotReportPage, permission: PERMISSIONS.ORDERS.READ },
  '/hotel/settings': { component: SettingsPage, permission: PERMISSIONS.SETTINGS.MANAGE_GENERAL },
  '/hotel/audit': { component: AuditLogsPage, permission: PERMISSIONS.AUDIT_LOGS.VIEW },
  '/hotel/operations/floor-plan': { component: FloorPlanPage, permission: PERMISSIONS.ROOMS.MANAGE_LAYOUT },
  '/hotel/operations/tables': { component: TablePlanPage, permission: PERMISSIONS.RESTAURANT.VIEW_TABLES },
  '/hotel/roles': { component: RolesPage, permission: PERMISSIONS.ROLES.READ },
  '/hotel/finance': { component: FinancePage, permission: PERMISSIONS.FINANCE.VIEW_RECORDS },
  '/hotel/events': { component: EventsPage, permission: PERMISSIONS.BANQUETS.VIEW },
  '/hotel/kitchen': { component: KitchenDisplayPage, permission: PERMISSIONS.ORDERS.READ },
  '/hotel/messages': { component: MessagesPage, permission: PERMISSIONS.COMMUNICATIONS.READ_MESSAGES },
  '/hotel/operations/facilities': { component: FacilitiesPage, permission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES },
  '/hotel/maintenance': { component: MaintenancePage, permission: PERMISSIONS.OPERATIONS.SETUP_FACILITIES },
  '/hotel/billing': { component: SaaSBillingPage, permission: PERMISSIONS.SAAS_ADMIN.MANAGE_SUBSCRIPTIONS },
  '/hotel/guests': { component: GuestPage, permission: PERMISSIONS.CRM.VIEW_GUESTS },
  '/hotel/guests/new': { component: CreateCustomerPage, permission: PERMISSIONS.CRM.MANAGE_GUESTS },
  '/hotel/bookings/checkin': { component: CheckInPage, permission: PERMISSIONS.BOOKINGS.UPDATE },
  '/hotel/profile': { component: ProfilePage },
};

function PageLoadingFallback() {
  return (
    <div className="page-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div className="animate-spin" style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '2px solid var(--notion-border)',
          borderTopColor: 'var(--notion-blue)',
        }} />
        <span style={{ fontSize: '13px' }} className="text-notion-secondary">
          Loading...
        </span>
      </div>
    </div>
  );
}

function StaffShell({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function AppContent() {
  const pathname = usePathname();
  const router = useRouter();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Normalize trailing slash (e.g., /admin/ -> /admin)
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;

  // Legacy routes → consolidated destinations
  useEffect(() => {
    if (normalizedPath === '/hotel/crm') {
      router.replace('/hotel/guests?tab=corporate');
    } else if (normalizedPath === '/hotel/corporate') {
      router.replace('/hotel/guests?tab=corporate');
    } else if (normalizedPath === '/hotel/ops/rooms' || normalizedPath === '/ops/rooms') {
      router.replace('/hotel/rooms');
    } else if (normalizedPath === '/hotel/bookings/checkin') {
      router.replace('/hotel/bookings?action=new&checkInNow=1');
    } else if (normalizedPath === '/hotel/finance/customer-ledger') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'customer-ledger');
      router.replace(`/hotel/finance?${params.toString()}`);
    }
  }, [normalizedPath, router]);

  if (normalizedPath === '/hotel/crm' || normalizedPath === '/hotel/corporate' || normalizedPath === '/hotel/bookings/checkin' || normalizedPath === '/hotel/finance/customer-ledger' || normalizedPath === '/hotel/ops/rooms' || normalizedPath === '/ops/rooms') {
    return <PageLoadingFallback />;
  }

  if (normalizedPath === '/login' || normalizedPath === '/') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  // Guest Portal (public route with own auth)
  if (normalizedPath === '/guest' || normalizedPath.startsWith('/guest/')) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <GuestPortalPage />
      </Suspense>
    );
  }

  // Public digital menu (no auth) — /menu?hotel=<slug>
  if (normalizedPath === '/menu' || normalizedPath.startsWith('/menu/')) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <DigitalMenuPage />
      </Suspense>
    );
  }

  // Public invoice view (no auth) — /invoice?id=<invoiceId>
  if (normalizedPath === '/invoice' || normalizedPath.startsWith('/invoice/')) {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <PublicInvoicePage />
      </Suspense>
    );
  }

  if (normalizedPath === '/hotel/pos') {
    return (
      <ModuleGuard>
        <ProtectedRoute requiredPermission={PERMISSIONS.ORDERS.CREATE}>
          <LicenseGuard>
            <Suspense fallback={<PageLoadingFallback />}>
              <POSPage />
            </Suspense>
          </LicenseGuard>
        </ProtectedRoute>
      </ModuleGuard>
    );
  }

  // Tenant detail (prefix route)
  if (normalizedPath.startsWith('/admin/tenants/') && normalizedPath !== '/admin/tenants') {
    return (
      <StaffShell>
        <ProtectedRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_TENANTS}>
          <LicenseGuard>
            <Suspense fallback={<PageLoadingFallback />}>
              <TenantDetailPage />
            </Suspense>
          </LicenseGuard>
        </ProtectedRoute>
      </StaffShell>
    );
  }

  // Customer detail page (prefix route) — exclude /new which is the create form
  if (normalizedPath.startsWith('/hotel/guests/') && normalizedPath !== '/hotel/guests/new') {
    return (
      <StaffShell>
        <ModuleGuard>
          <ProtectedRoute requiredPermission={PERMISSIONS.CRM.VIEW_GUESTS}>
            <LicenseGuard>
              <Suspense fallback={<PageLoadingFallback />}>
                <CustomerDetailPage />
              </Suspense>
            </LicenseGuard>
          </ProtectedRoute>
        </ModuleGuard>
      </StaffShell>
    );
  }

  // Check exact match first in both routes
  const isAdminRoute = normalizedPath in adminRoutes;
  const isHotelRoute = normalizedPath in hotelRoutes;
  const routeConfig = adminRoutes[normalizedPath] || hotelRoutes[normalizedPath];
  if (routeConfig) {
    const PageComponent = routeConfig.component;
    const content = (
      <ProtectedRoute requiredPermission={routeConfig.permission}>
        <LicenseGuard>
          <Suspense fallback={<PageLoadingFallback />}>
            <PageComponent />
          </Suspense>
        </LicenseGuard>
      </ProtectedRoute>
    );
    if (isHotelRoute) {
      return (
        <StaffShell>
          <ModuleGuard>
            {content}
          </ModuleGuard>
        </StaffShell>
      );
    }
    return (
      <StaffShell>
        {content}
      </StaffShell>
    );
  }

  if (normalizedPath.startsWith('/admin') || normalizedPath.startsWith('/hotel')) {
    return (
      <StaffShell>
        <ProtectedRoute>
          <LicenseGuard>
            <div className="page-center-column">
              <h1 style={{ fontSize: '48px', fontWeight: '700' }}>404</h1>
              <p style={{ fontSize: '14px' }} className="text-notion-secondary">Page not found</p>
              <a href={normalizedPath.startsWith('/admin') ? '/admin' : '/hotel'} style={{ color: 'var(--notion-blue)', textDecoration: 'none', fontSize: '14px' }}>
                Go to Dashboard
              </a>
            </div>
          </LicenseGuard>
        </ProtectedRoute>
      </StaffShell>
    );
  }

  // 404 fallback
  return (
    <div className="page-center-column">
      <h1 style={{ fontSize: '48px', fontWeight: '700' }}>404</h1>
      <p style={{ fontSize: '14px' }} className="text-notion-secondary">Page not found</p>
      <a
        href="/login"
        style={{
          color: 'var(--notion-blue)',
          textDecoration: 'none',
          fontSize: '14px',
        }}
      >
        Go to Login
      </a>
    </div>
  );
}

import { CommandPaletteProvider } from "@/lib/contexts/CommandPaletteContext";
import { WebSocketProvider } from "@/lib/contexts/WebSocketContext";
import GlobalKeyboardShortcuts from "@/components/ui/GlobalKeyboardShortcuts";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { Toaster, toast } from 'sonner';
import { ApiError } from '@/lib/api';

function GlobalErrorHandler() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      if (error instanceof ApiError) {
        toast.error(error.message || 'An unexpected error occurred');
        event.preventDefault();
      } else if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          toast.error('Network error. Please check your connection.');
        } else {
          toast.error(error.message || 'Something went wrong');
        }
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);
  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
          <CommandPaletteProvider>
            <GlobalKeyboardShortcuts />
            <GlobalErrorHandler />
            <AppContent />
            <Suspense fallback={null}>
              <CommandPalette />
            </Suspense>
            <OfflineBanner />
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                },
              }}
            />
          </CommandPaletteProvider>
          </WebSocketProvider>
        </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
      <div id="datepicker-portal" style={{ position: 'fixed', top: 0, left: 0, zIndex: 99999 }} />
    </ErrorBoundary>
  );
}

export default App;
