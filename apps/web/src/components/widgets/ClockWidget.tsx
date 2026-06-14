"use client";

import { useState, useEffect } from "react";
import { Globe, Settings, X, Search, CalendarDays } from "lucide-react";
import { adToBS, formatBSDate, formatBSDateEN, getBSDayName } from "@/lib/utils/nepaliDate";

const TIMEZONES = [
    { label: "Local Time", zone: "local" },
    { label: "Kathmandu (Nepal)", zone: "Asia/Kathmandu" },
    { label: "New Delhi (India)", zone: "Asia/Kolkata" },
    { label: "London (UK)", zone: "Europe/London" },
    { label: "New York (USA)", zone: "America/New_York" },
    { label: "Dubai (UAE)", zone: "Asia/Dubai" },
    { label: "Singapore", zone: "Asia/Singapore" },
    { label: "Tokyo (Japan)", zone: "Asia/Tokyo" },
    { label: "Sydney (Australia)", zone: "Australia/Sydney" },
    { label: "Los Angeles (USA)", zone: "America/Los_Angeles" },
    { label: "Paris (France)", zone: "Europe/Paris" },
    { label: "Berlin (Germany)", zone: "Europe/Berlin" },
    { label: "Hong Kong", zone: "Asia/Hong_Kong" },
    { label: "Bangkok (Thailand)", zone: "Asia/Bangkok" },
    { label: "Toronto (Canada)", zone: "America/Toronto" },
];

export default function ClockWidget() {
    const [time, setTime] = useState(new Date());
    const [selectedZone, setSelectedZone] = useState(TIMEZONES[0]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const filteredZones = TIMEZONES.filter(tz =>
        tz.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTimeString = (date: Date, zone: string) => {
        if (zone === "local") return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        try {
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: zone
            });
        } catch {
            return "--:--";
        }
    };

    const getDateString = (date: Date, zone: string) => {
        const isNepal = zone === "Asia/Kathmandu" || zone === "local";
        if (isNepal) {
            const bsDate = adToBS(date);
            const bsFormatted = formatBSDateEN(bsDate, 'long');
            const adFormatted = date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
            const dayName = getBSDayName(date);
            return `${dayName} | ${adFormatted} (${bsFormatted} BS)`;
        }

        if (zone === "local") return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        try {
            return date.toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                timeZone: zone
            });
        } catch {
            return "";
        }
    };

    return (
        <div style={{
            position: "relative",
            background: "var(--notion-bg-secondary)",
            border: "1px solid var(--notion-border)",
            borderRadius: "12px",
            height: "180px",
            overflow: "hidden"
        }}>
            {/* Front Face (Clock) */}
            <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px"
            }}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    zIndex: 10
                }}>
                    {/* Timezone Label */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--notion-text-muted)",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: "8px",
                        padding: "4px 8px",
                        background: "var(--notion-bg-tertiary)",
                        borderRadius: "12px"
                    }}>
                        <Globe size={10} />
                        <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {selectedZone?.label}
                        </span>
                    </div>

                    {/* Time */}
                    <div style={{
                        fontSize: "48px",
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 700,
                        color: "var(--notion-text)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                        marginBottom: "4px"
                    }}>
                        {getTimeString(time, selectedZone?.zone || "local")}
                    </div>

                    {/* Date with AD/BS */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}>
                        <span style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--notion-text-secondary)"
                        }}>
                            {getDateString(time, selectedZone?.zone || "local")}
                        </span>
                    </div>
                </div>

                {/* Settings Button */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    padding: "12px",
                    opacity: 0.5,
                    transition: "opacity 150ms ease"
                }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                >
                    <button
                        onClick={() => {
                            setIsSettingsOpen(true);
                            setSearchQuery("");
                        }}
                        style={{
                            padding: "6px",
                            background: "transparent",
                            border: "none",
                            borderRadius: "4px",
                            color: "var(--notion-text-muted)",
                            cursor: "pointer"
                        }}
                        title="Change Timezone"
                    >
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {isSettingsOpen && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "var(--notion-bg-secondary)",
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    padding: "16px",
                    animation: "slideUp 200ms ease"
                }}>
                    {/* Search Header */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid var(--notion-border)"
                    }}>
                        <Search size={14} style={{ color: "var(--notion-text-muted)" }} />
                        <input
                            autoFocus
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                fontSize: "12px",
                                color: "var(--notion-text)"
                            }}
                            placeholder="Search city..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            onClick={() => setIsSettingsOpen(false)}
                            style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--notion-text-muted)"
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Timezone List */}
                    <div style={{
                        flex: 1,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px"
                    }}>
                        {filteredZones.length === 0 ? (
                            <div style={{
                                textAlign: "center",
                                padding: "16px",
                                fontSize: "12px",
                                color: "var(--notion-text-muted)"
                            }}>
                                No results found.
                            </div>
                        ) : (
                            filteredZones.map((tz) => (
                                <button
                                    key={tz.zone + tz.label}
                                    onClick={() => {
                                        setSelectedZone(tz);
                                        setIsSettingsOpen(false);
                                    }}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "8px",
                                        borderRadius: "4px",
                                        fontSize: "12px",
                                        background: selectedZone?.zone === tz.zone ? "var(--notion-blue-bg)" : "transparent",
                                        color: selectedZone?.zone === tz.zone ? "var(--notion-blue)" : "var(--notion-text)",
                                        fontWeight: selectedZone?.zone === tz.zone ? 500 : 400,
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        transition: "background 100ms ease"
                                    }}
                                    onMouseEnter={e => {
                                        if (selectedZone?.zone !== tz.zone) {
                                            e.currentTarget.style.background = "var(--notion-bg-tertiary)";
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (selectedZone?.zone !== tz.zone) {
                                            e.currentTarget.style.background = "transparent";
                                        }
                                    }}
                                >
                                    <span>{tz.label}</span>
                                    {selectedZone?.zone === tz.zone && (
                                        <div style={{
                                            width: "6px",
                                            height: "6px",
                                            borderRadius: "50%",
                                            background: "currentColor"
                                        }} />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}