'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from '@/lib/router';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import OTPModal from '@/components/auth/OTPModal';
import { LoginAnimation } from '@/components/auth/LoginAnimation';
import { Mail, Lock, Hotel } from 'lucide-react';

export default function LoginPage() {
    const { login, verifyOTP, isAuthenticated, user } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // 2FA State
    const [showOTP, setShowOTP] = useState(false);
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const [otpError, setOtpError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            router.push(user.userType === 'SUPER_ADMIN' ? '/admin' : '/hotel');
        }
    }, [isAuthenticated, user, router]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await login(email, password);

            if (result.require2FA && result.userId) {
                setPendingUserId(result.userId);
                setShowOTP(true);
            } else if (result.success) {
                // Regular login success, useEffect will handle redirect
            } else {
                setError(result.error || 'Login failed');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (otp: string) => {
        if (!pendingUserId) return;
        setOtpError('');
        setIsVerifying(true);

        try {
            const result = await verifyOTP(pendingUserId, otp);

            if (result.success) {
                setShowOTP(false);
                // useEffect will handle redirect
            } else {
                setOtpError(result.error || 'Invalid code');
            }
        } catch {
            setOtpError('Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            backgroundColor: 'var(--notion-bg)'
        }}>
            {/* Left Panel - Animation */}
            <div style={{
                flex: 1,
                display: 'none',
                position: 'relative',
                overflow: 'hidden',
                borderRight: '1px solid var(--notion-border)',
            }} className="login-animation-panel">
                <LoginAnimation />

                {/* Branding overlay */}
                <div style={{
                    position: 'absolute',
                    bottom: 'var(--space-8)',
                    left: 'var(--space-8)',
                    zIndex: 10,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-4)',
                    }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-blue)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Hotel size={20} color="white" />
                        </div>
                        <h2 style={{
                            fontSize: '22px',
                            fontWeight: '700',
                            color: 'var(--notion-text)',
                            letterSpacing: '-0.01em',
                        }}>
                            Nivas PMS
                        </h2>
                    </div>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--notion-text-secondary)',
                        maxWidth: '300px',
                        lineHeight: 1.5,
                    }}>
                        Modern property management system for hotels, resorts, and hospitality businesses.
                    </p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-8)',
                minWidth: '0'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '360px'
                }}>
                    {/* Logo */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-8)'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-blue)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Hotel size={24} color="white" />
                        </div>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'var(--notion-text)'
                        }}>
                            Nivas
                        </span>
                    </div>

                    {/* Title */}
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                        marginBottom: 'var(--space-2)'
                    }}>
                        Welcome back
                    </h1>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        Sign in to your account to continue
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--notion-red)',
                            fontSize: '13px',
                            marginBottom: 'var(--space-4)'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-4)'
                    }}>
                        <Input
                            label="Email"
                            type="email"
                            placeholder="you@hotel.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            icon={<Mail size={16} />}
                            required
                            autoComplete="email"
                        />

                        <Input
                            label="Password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            icon={<Lock size={16} />}
                            required
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            size="lg"
                            loading={isLoading}
                            style={{ marginTop: 'var(--space-2)' }}
                        >
                            Sign In
                        </Button>
                    </form>

                    {/* Footer */}
                    <p style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-muted)',
                        textAlign: 'center',
                        marginTop: 'var(--space-8)'
                    }}>
                        Nivas Property Management System
                    </p>
                </div>
            </div>

            {/* 2FA Modal */}
            <OTPModal
                isOpen={showOTP}
                onClose={() => setShowOTP(false)}
                onVerify={handleVerifyOTP}
                error={otpError}
                isLoading={isVerifying}
            />

            {/* Responsive styles */}
            <style>{`
                @media (min-width: 768px) {
                    .login-animation-panel {
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
