import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    override render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px',
                    padding: '40px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-red-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                    }}>
                        <AlertTriangle size={28} color="var(--notion-red)" />
                    </div>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--notion-text)',
                        marginBottom: '8px',
                    }}>
                        Something went wrong
                    </h3>
                    <p style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: '16px',
                        maxWidth: '400px',
                    }}>
                        {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: 'var(--notion-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        <RotateCw size={14} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

