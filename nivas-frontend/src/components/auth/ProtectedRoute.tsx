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
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--notion-bg)'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-4)'
                }}>
                    <div className="animate-spin" style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '3px solid var(--notion-border)',
                        borderTopColor: 'var(--notion-blue)'
                    }} />
                    <span style={{
                        color: 'var(--notion-text-secondary)',
                        fontSize: '14px'
                    }}>
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
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--notion-bg)',
                padding: 'var(--space-8)'
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: 'var(--space-8)',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    maxWidth: '400px'
                }}>
                    <div style={{
                        fontSize: '48px',
                        marginBottom: 'var(--space-4)'
                    }}>
                        🔒
                    </div>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                        marginBottom: 'var(--space-2)'
                    }}>
                        Access Denied
                    </h2>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--notion-text-secondary)'
                    }}>
                        You don't have permission to access this page.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
