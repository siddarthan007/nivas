'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredPermission?: string;
    fallback?: ReactNode;
}

/**
 * Wrapper component that protects routes requiring authentication.
 * Redirects to login if not authenticated.
 * Optionally checks for specific permissions.
 */
export default function ProtectedRoute({
    children,
    requiredPermission,
    fallback
}: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, hasPermission } = useAuth();

    // Show loading state during initial auth check
    if (isLoading) {
        return (
            <div className="page-center">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div className="animate-spin loading-spinner" />
                    <span style={{ fontSize: '14px' }} className="text-notion-secondary">
                        Loading...
                    </span>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        window.location.href = '/login';
        return null;
    }

    // Check permission if required
    if (requiredPermission && !hasPermission(requiredPermission)) {
        if (fallback) {
            return <>{fallback}</>;
        }

        return (
            <div className="page-center" style={{ padding: 'var(--space-8)' }}>
                <div className="card-box" style={{ maxWidth: '400px' }}>
                    <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>
                        🔒
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>
                        Access Denied
                    </h2>
                    <p style={{ fontSize: '14px' }} className="text-notion-secondary">
                        You don't have permission to access this page.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
