"use client";

import { useState } from "react";
import { useRouter } from "@/lib/router";
import { Lock } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Props {
    userId: string;
}

export default function ForcePasswordChangeModal({ userId }: Props) {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            // We use the same update profile endpoint
            // We need to pass a dummy "currentPassword" if the API strictly requires it, 
            // BUT our API only checks currentPassword IF it's provided. 
            // Wait, looking at my API implementation: 
            // "if (currentPassword && newPassword) { ... compare ... }"
            // This logic requires currentPassword to change password.
            // I need to adjust the API to allow changing password WITHOUT current password IF mustChangePassword is true.
            // OR I just make a dedicated endpoint for this?
            // Actually, updating the profile API to allow override if mustChangePassword is true is cleaner.

            const res = await fetch("/api/users/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    newPassword,
                    isForceChange: true // We'll add this flag handling to the API
                }),
            });

            if (res.ok) {
                // Refresh to clear the flag from session
                router.refresh();
                // We might need to sign out or just reload header
                window.location.reload();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to update password");
            }
        } catch (err) {
            setError("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={() => { }} // Block closing
            title="Update Password"
        >
            <div style={{ padding: '8px 4px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--notion-bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--notion-text-secondary)'
                    }}>
                        <Lock size={18} />
                    </div>
                    <div>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--notion-text)',
                            margin: 0
                        }}>
                            Security Setup
                        </h2>
                        <p style={{
                            color: 'var(--notion-text-secondary)',
                            fontSize: '13px',
                            margin: '2px 0 0'
                        }}>
                            Please set a new password for your account.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {error && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(235, 87, 87, 0.1)',
                            border: '1px solid rgba(235, 87, 87, 0.2)',
                            color: 'var(--notion-red)',
                            fontSize: '13px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-muted)',
                            fontWeight: 500
                        }}>
                            New password
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                                fontSize: '14px',
                                color: 'var(--notion-text)',
                                outline: 'none',
                            }}
                            autoFocus
                            placeholder="Type a new password..."
                            className="focus-ring"
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-muted)',
                            fontWeight: 500
                        }}>
                            Confirm password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                                fontSize: '14px',
                                color: 'var(--notion-text)',
                                outline: 'none',
                            }}
                            placeholder="Retype password..."
                            className="focus-ring"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '8px',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid var(--notion-border)',
                            background: 'var(--notion-black)',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            opacity: loading ? 0.7 : 1,
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        {loading ? "Updating..." : "Update password"}
                    </button>

                    <div style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-muted)',
                        textAlign: 'center',
                        marginTop: '4px'
                    }}>
                        Minimum 6 characters required.
                    </div>
                </form>
            </div>
        </Modal>
    );
}

const disabled = false; // Helper