import { useSystemHealth } from "@/lib/contexts/SystemHealthContext";
import { useEffect, useState } from "react";

export default function DorianOverlay() {
    const { entropy, healthState } = useSystemHealth();
    const [styles, setStyles] = useState<React.CSSProperties>({});

    useEffect(() => {
        // Calculate dynamic styles based on entropy
        const newStyles: React.CSSProperties = {
            pointerEvents: "none",
            position: "fixed",
            inset: 0,
            zIndex: 9998, // Below modals (9999) but above content
            transition: "all 1s ease",
            mixBlendMode: "multiply", // Good for darkening/vignette
        };

        if (healthState === "neutral") {
            setStyles({});
            document.body.style.filter = "none";
            return;
        }

        if (healthState === "blooming") {
            // Bloom effect done via body filter mostly, but overlay can add glow
            newStyles.background = "radial-gradient(circle at center, transparent 60%, rgba(255, 255, 255, 0.1) 100%)";
            newStyles.mixBlendMode = "screen";
            document.body.style.filter = "saturate(1.2) contrast(1.05) brightness(1.05)";
        }
        else if (healthState === "decaying") {
            // Decay: Desaturate, slight vignette, slight grain
            newStyles.background = `
                radial-gradient(circle at center, transparent 50%, rgba(40, 30, 20, 0.2) 100%),
                url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")
             `;
            document.body.style.filter = "saturate(0.7) sepia(0.1) contrast(0.95)";
        }
        else if (healthState === "critical") {
            // Critical: Heavy vignette, heavy grain, dark, crooked
            newStyles.background = `
                radial-gradient(circle at center, transparent 30%, rgba(20, 10, 5, 0.6) 100%),
                url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")
             `;
            document.body.style.filter = "saturate(0.4) sepia(0.3) contrast(1.1) brightness(0.9)";
        }

        setStyles(newStyles);
    }, [entropy, healthState]);

    // Cleanup
    useEffect(() => {
        return () => { document.body.style.filter = "none"; };
    }, []);

    if (healthState === "neutral" && entropy === 20) return null;

    return (
        <>
            <div className="dorian-overlay" style={styles} />
            {/* Critical state animation applied via CSS class */}
            {healthState === "critical" && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .main-content {
                        animation: subtle-jitter 4s infinite linear;
                    }
                    @keyframes subtle-jitter {
                        0% { transform: rotate(0deg); }
                        25% { transform: rotate(0.2deg); }
                        50% { transform: rotate(-0.1deg); }
                        75% { transform: rotate(0.1deg); }
                        100% { transform: rotate(0deg); }
                    }
                `}} />
            )}
        </>
    );
}