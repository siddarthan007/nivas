'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { KeyRound, RefreshCw } from 'lucide-react';

interface OTPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVerify: (otp: string) => Promise<void>;
    error?: string;
    isLoading?: boolean;
}

export default function OTPModal({ isOpen, onClose, onVerify, error, isLoading }: OTPModalProps) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [resendCountdown, setResendCountdown] = useState(60);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Focus first input on open
    useEffect(() => {
        if (isOpen) {
            setOtp(['', '', '', '', '', '']);
            setResendCountdown(60);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    // Resend countdown timer
    useEffect(() => {
        if (!isOpen || resendCountdown <= 0) return;
        const timer = setInterval(() => {
            setResendCountdown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [isOpen, resendCountdown]);

    const handleChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
        if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
            onVerify(newOtp.join(''));
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6);
        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = [...otp];
        pastedData.split('').forEach((char, i) => {
            if (i < 6) newOtp[i] = char;
        });
        setOtp(newOtp);

        if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
            onVerify(newOtp.join(''));
        }
    };

    const handleResend = () => {
        if (resendCountdown > 0) return;
        // In a real implementation, this would call an API to resend OTP
        setResendCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div style={{
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-6)',
                minWidth: '320px'
            }}>
                {/* Icon */}
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--notion-blue-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <KeyRound size={28} style={{ color: 'var(--notion-blue)' }} />
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                        marginBottom: 'var(--space-2)'
                    }}>
                        Two-Factor Authentication
                    </h2>
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--notion-text-secondary)',
                        maxWidth: '280px'
                    }}>
                        Enter the 6-digit code from your authenticator app or check the server console.
                    </p>
                </div>

                {/* OTP Input */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    justifyContent: 'center'
                }}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            onPaste={index === 0 ? handlePaste : undefined}
                            disabled={isLoading}
                            style={{
                                width: '44px',
                                height: '52px',
                                textAlign: 'center',
                                fontSize: '20px',
                                fontWeight: '600',
                                backgroundColor: 'var(--notion-bg-tertiary)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--notion-text)',
                                outline: 'none',
                                transition: 'border-color 150ms ease',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--notion-blue)';
                                e.currentTarget.style.boxShadow = '0 0 0 2px var(--notion-blue-bg)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'var(--notion-border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                    ))}
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: 'var(--notion-red-bg)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--notion-red)',
                        fontSize: '13px',
                        width: '100%',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    width: '100%'
                }}>
                    <Button
                        variant="primary"
                        fullWidth
                        loading={isLoading}
                        disabled={otp.some(d => !d)}
                        onClick={() => onVerify(otp.join(''))}
                    >
                        Verify Code
                    </Button>

                    <button
                        onClick={handleResend}
                        disabled={resendCountdown > 0}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: resendCountdown > 0 ? 'var(--notion-text-muted)' : 'var(--notion-blue)',
                            fontSize: '13px',
                            cursor: resendCountdown > 0 ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--space-1)'
                        }}
                    >
                        <RefreshCw size={14} />
                        {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
