import { Bell, Search, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import GlobalActionMenu from "./GlobalActionMenu";
import { useAuth } from "@/lib/contexts/AuthContext";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  hideActions?: boolean;
}

export default function Header({ title, onMenuClick, hideActions }: HeaderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(".search-input");
        searchInput?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

    const firstName = user?.name?.split(" ")[0] || "User";

  return (
    <header
      className="dashboard-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        backgroundColor: "var(--notion-bg)",
        zIndex: 10,
        borderBottom: "1px solid var(--notion-border)",
        marginBottom: "24px"
      }}
    >
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        style={{
          display: "none",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--notion-text)"
        }}
        className="mobile-menu-btn"
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>

      {/* Page Title */}
      <div className="dashboard-header-title" style={{ display: "flex", alignItems: "center" }}>
        <h1 style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--notion-text)",
          margin: 0,
          fontFamily: "var(--font-heading, sans-serif)"
        }}>
          {title}
        </h1>
      </div>

      {/* Right Side Actions */}
      {!hideActions && (
        <div className="dashboard-header-actions" style={{ display: "flex", alignItems: "center", gap: "16px" }}>

          {/* Search Box */}
          <div className="dashboard-header-search" style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "var(--notion-bg-secondary)",
            border: "1px solid var(--notion-border)",
            borderRadius: "6px",
            padding: "4px 8px",
            width: "240px",
            transition: "all 0.2s ease"
          }}>
            <Search size={16} color="var(--notion-text-muted)" />
            <input
              type="text"
              placeholder="Search... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "13px",
                color: "var(--notion-text)",
                marginLeft: "8px",
                width: "100%"
              }}
            />
          </div>

          {/* Global Action Menu */}
          <div style={{ marginRight: '8px' }}>
            <GlobalActionMenu />
          </div>

          {/* Notifications */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--notion-text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                borderRadius: "4px",
                position: "relative"
              }}
              className="hover-bg"
            >
              <Bell size={20} strokeWidth={1.5} />
              <span style={{
                position: "absolute",
                top: "6px",
                right: "6px",
                width: "6px",
                height: "6px",
                backgroundColor: "var(--notion-red)",
                borderRadius: "50%",
                display: "none"
              }} />
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "8px",
                width: "320px",
                backgroundColor: "var(--notion-bg)",
                border: "1px solid var(--notion-border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                zIndex: 50,
              }}>
                <div style={{ padding: "12px", borderBottom: "1px solid var(--notion-border)" }}>
                  <h4 style={{ margin: 0, fontSize: "12px", color: "var(--notion-text-muted)" }}>NOTIFICATIONS</h4>
                </div>
                <div style={{ padding: "24px", textAlign: "center", color: "var(--notion-text-muted)", fontSize: "13px" }}>
                  No new notifications
                </div>
              </div>
            )}
          </div>

          {/* User Greeting */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: "max-content" }}>
            <span style={{ fontSize: "11px", color: "var(--notion-text-muted)", textTransform: "uppercase" }}>
              Welcome,
            </span>
            <span style={{
              fontFamily: "var(--font-heading)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--notion-text)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              {firstName}
            </span>
          </div>
        </div>
      )}

      {/* Responsive styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media (max-width: 1024px) {
          .mobile-menu-btn {
            display: flex !important;
          }
          .search-input {
            display: none;
          }
        }
      `}} />
    </header>
  );
}