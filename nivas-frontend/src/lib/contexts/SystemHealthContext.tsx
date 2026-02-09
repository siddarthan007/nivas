import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type HealthState = "neutral" | "blooming" | "decaying" | "critical";

interface SystemHealthContextType {
    // Entropy level (0-100)
    entropy: number;
    setEntropy: (value: number) => void;
    // Derived health state based on entropy
    healthState: HealthState;
    // API health data
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

function getHealthState(entropy: number): HealthState {
    if (entropy <= 20) return "neutral";
    if (entropy <= 40) return "blooming";
    if (entropy <= 70) return "decaying";
    return "critical";
}

const SystemHealthContext = createContext<SystemHealthContextType | null>(null);

export function SystemHealthProvider({ children }: { children: ReactNode }) {
    const [entropy, setEntropyState] = useState(20); // Default neutral
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const healthState = getHealthState(entropy);

    const setEntropy = (value: number) => {
        setEntropyState(Math.max(0, Math.min(100, value)));
    };

    const refresh = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Attempt to fetch health from API
            const response = await fetch("/api/health", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                const data = await response.json();
                // Map API status to entropy if available
                if (typeof data.entropy === "number") {
                    setEntropy(data.entropy);
                }
            }
        } catch {
            // Network error - keep current entropy
        } finally {
            setIsLoading(false);
        }
    };

    // Initial check on mount
    useEffect(() => {
        refresh();

        // Periodic health checks every 60 seconds
        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <SystemHealthContext.Provider value={{
            entropy,
            setEntropy,
            healthState,
            isLoading,
            error,
            refresh
        }}>
            {children}
        </SystemHealthContext.Provider>
    );
}

export function useSystemHealth(): SystemHealthContextType {
    const context = useContext(SystemHealthContext);
    if (!context) {
        // Return default values if used outside provider (graceful degradation)
        return {
            entropy: 20,
            setEntropy: () => { },
            healthState: "neutral",
            isLoading: false,
            error: null,
            refresh: async () => { },
        };
    }
    return context;
}
