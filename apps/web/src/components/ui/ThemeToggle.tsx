import { useTheme, type Accent } from '@/lib/contexts/ThemeContext';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const accentOptions: { value: Accent; label: string; color: string }[] = [
  { value: 'blue', label: 'Blue', color: '#4E95C6' },
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
  { value: 'emerald', label: 'Emerald', color: '#10b981' },
  { value: 'amber', label: 'Amber', color: '#f59e0b' },
  { value: 'rose', label: 'Rose', color: '#f43f5e' },
  { value: 'violet', label: 'Violet', color: '#8b5cf6' },
];

export default function ThemeToggle() {
  const { theme, resolvedTheme, accent, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState<{ left: number; bottom: number } | null>(null);

  const measure = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupWidth = 248;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 12) {
      left = window.innerWidth - popupWidth - 12;
    }
    if (left < 12) left = 12;
    setPopupPos({ left, bottom: window.innerHeight - rect.top + 8 });
  }, []);

  useEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    function onResize() { if (open) measure(); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, measure]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        const popup = document.getElementById('theme-toggle-popup');
        if (!popup || !popup.contains(target)) setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open) measure();
          setOpen(!open);
        }}
        title="Theme settings"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--foreground-muted)',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="hover-bg"
      >
        {resolvedTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      {open && popupPos && createPortal(
        <div
          id="theme-toggle-popup"
          style={{
            position: 'fixed',
            left: popupPos.left,
            bottom: popupPos.bottom,
            width: '248px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-popover)',
            padding: '16px',
            zIndex: 99999,
            animation: 'fadeIn 0.15s ease-out',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--foreground)',
            }}>Theme</span>
          </div>

          {/* Appearance — Theme Cards */}
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--foreground-faint)',
            marginBottom: '10px',
          }}>
            Appearance
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {([
              { value: 'light' as const, icon: Sun, label: 'Light' },
              { value: 'dark' as const, icon: Moon, label: 'Dark' },
              { value: 'system' as const, icon: Monitor, label: 'Auto' },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 4px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1.5px solid',
                  borderColor: theme === value ? 'var(--accent-primary)' : 'var(--border)',
                  background: theme === value ? 'var(--accent-primary-faint)' : 'var(--surface)',
                  color: theme === value ? 'var(--foreground)' : 'var(--foreground-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>

          {/* Live Preview */}
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--foreground-faint)',
            marginBottom: '10px',
          }}>
            Preview
          </div>
          <div style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: '20px',
          }}>
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--background)',
              borderBottom: '1px solid var(--divider)',
            }}>
              <div style={{
                width: '40%',
                height: '8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--foreground-faint)',
                marginBottom: '8px',
              }} />
              <div style={{
                width: '70%',
                height: '6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--foreground-faint)',
                opacity: 0.5,
              }} />
            </div>
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-primary)',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  width: '55%',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--foreground-muted)',
                  marginBottom: '6px',
                }} />
                <div style={{
                  width: '35%',
                  height: '5px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--foreground-faint)',
                }} />
              </div>
              <div style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-primary-muted)',
                color: 'var(--accent-primary)',
                fontSize: '10px',
                fontWeight: 600,
              }}>
                Active
              </div>
            </div>
          </div>

          {/* Accent Color */}
          <div style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--foreground-faint)',
            marginBottom: '10px',
          }}>
            Accent Color
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {accentOptions.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => setAccent(value)}
                title={label}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: color,
                  border: '2.5px solid',
                  borderColor: accent === value ? 'var(--foreground)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'transform 0.15s ease',
                  transform: accent === value ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {accent === value && (
                  <Check size={14} color="var(--foreground-inverse)" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
