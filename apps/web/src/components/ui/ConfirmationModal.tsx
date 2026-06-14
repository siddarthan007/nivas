"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDangerous = false
}: ConfirmationModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.6)",
                            backdropFilter: "blur(4px)",
                            zIndex: 1000,
                        }}
                    />

                    {/* Modal */}
                    <div style={{
                        position: "fixed",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1001,
                        pointerEvents: "none"
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            style={{
                                width: "100%",
                                maxWidth: "400px",
                                background: "var(--notion-bg)",
                                borderRadius: "12px",
                                border: "1px solid var(--notion-border)",
                                padding: "24px",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                                pointerEvents: "auto",
                                position: "relative"
                            }}
                        >
                            {/* Close Button */}
                            <button
                                onClick={onCancel}
                                style={{
                                    position: "absolute",
                                    top: "16px",
                                    right: "16px",
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--notion-text-secondary)",
                                    cursor: "pointer"
                                }}
                            >
                                <X size={18} />
                            </button>

                            {/* Icon */}
                            <div style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "12px",
                                background: isDangerous ? "rgba(255, 77, 77, 0.1)" : "rgba(35, 131, 226, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: "16px"
                            }}>
                                <AlertTriangle size={24} color={isDangerous ? "#ff4d4d" : "#2383e2"} />
                            </div>

                            {/* Text */}
                            <h3 style={{ color: "var(--notion-text)", fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
                                {title}
                            </h3>
                            <p style={{ color: "var(--notion-text-secondary)", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
                                {message}
                            </p>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button
                                    onClick={onCancel}
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: "8px",
                                        background: "var(--notion-bg-secondary)",
                                        border: "1px solid var(--notion-border)",
                                        color: "var(--notion-text)",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        cursor: "pointer"
                                    }}
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: "8px",
                                        background: isDangerous ? "#ff4d4d" : "#2383e2",
                                        border: "none",
                                        color: "var(--foreground-inverse)",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        boxShadow: isDangerous ? "0 4px 12px rgba(255, 77, 77, 0.3)" : "0 4px 12px rgba(35, 131, 226, 0.3)"
                                    }}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}