"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarWidget() {
    const [date, setDate] = useState(new Date());

    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const prevMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
    const nextMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
    const today = () => setDate(new Date());

    const isToday = (d: number) => {
        const now = new Date();
        return d === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    return (
        <div style={{
            background: "var(--notion-bg-secondary)",
            border: "1px solid var(--notion-border)",
            borderRadius: "8px",
            padding: "16px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--notion-text)" }}>
                    {monthNames[date.getMonth()]} {date.getFullYear()}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button onClick={prevMonth} style={{ background: "transparent", border: "none", color: "var(--notion-text-muted)", cursor: "pointer", padding: "2px" }} className="hover-bg">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={today} style={{ fontSize: "11px", fontWeight: 500, background: "transparent", border: "none", color: "var(--notion-text-muted)", cursor: "pointer", padding: "2px 6px" }} className="hover-bg">
                        Today
                    </button>
                    <button onClick={nextMonth} style={{ background: "transparent", border: "none", color: "var(--notion-text-muted)", cursor: "pointer", padding: "2px" }} className="hover-bg">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", fontSize: "12px", flex: 1 }}>
                {/* Weekdays */}
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={`day-${i}`} style={{ color: "var(--notion-text-muted)", textAlign: "center", paddingBottom: "4px", fontSize: "10px", fontWeight: 600 }}>{d}</div>
                ))}

                {/* Empty Days */}
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    return (
                        <div
                            key={d}
                            style={{
                                textAlign: "center",
                                padding: "6px 0",
                                background: isToday(d) ? "var(--notion-red)" : "transparent",
                                color: isToday(d) ? "white" : "var(--notion-text)",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: isToday(d) ? 600 : 400
                            }}
                            className={!isToday(d) ? "hover-bg" : ""}
                        >
                            {d}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}