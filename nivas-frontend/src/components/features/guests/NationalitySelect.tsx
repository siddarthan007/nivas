import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { NATIONALITIES } from '@/lib/constants/nationalities';

interface NationalitySelectProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    style?: React.CSSProperties;
}

export default function NationalitySelect({ value, onChange, placeholder = 'Select nationality...', label, style }: NationalitySelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            // Close if click is outside wrapper AND outside portal dropdown
            if (wrapperRef.current && !wrapperRef.current.contains(target)) {
                const portalDropdown = document.getElementById('nationality-dropdown-portal');
                if (!portalDropdown || !portalDropdown.contains(target)) {
                    setOpen(false);
                    setSearch('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
        }
    }, [open]);

    useEffect(() => {
        if (open && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open]);

    const filtered = search
        ? NATIONALITIES.filter(n => n.toLowerCase().includes(search.toLowerCase()))
        : [...NATIONALITIES];

    return (
        <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
            {label && (
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '6px' }}>
                    {label}
                </label>
            )}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--notion-bg)',
                    color: value ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left',
                    transition: 'border-color 0.15s ease',
                    borderColor: open ? 'var(--notion-blue)' : 'var(--notion-border)'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || placeholder}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {value && (
                        <span
                            onClick={(e) => { e.stopPropagation(); onChange(''); }}
                            style={{ padding: '2px', cursor: 'pointer', color: 'var(--notion-text-secondary)', display: 'flex' }}
                        >
                            <X size={12} />
                        </span>
                    )}
                    <ChevronDown size={14} style={{ color: 'var(--notion-text-secondary)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
                </div>
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    id="nationality-dropdown-portal"
                    style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: dropdownPos.width,
                        zIndex: 99999,
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--notion-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)' }}>
                            <Search size={14} style={{ color: 'var(--notion-text-secondary)', flexShrink: 0 }} />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search nationalities..."
                                style={{
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: '13px',
                                    backgroundColor: 'transparent',
                                    color: 'var(--notion-text)',
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                No nationalities found
                            </div>
                        ) : (
                            filtered.map(nat => (
                                <div
                                    key={nat}
                                    onClick={() => { onChange(nat); setOpen(false); setSearch(''); }}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        color: nat === value ? 'var(--notion-blue)' : 'var(--notion-text)',
                                        fontWeight: nat === value ? '500' : '400',
                                        backgroundColor: nat === value ? 'var(--notion-blue-bg)' : 'transparent',
                                        transition: 'background-color 0.1s'
                                    }}
                                    onMouseEnter={e => { if (nat !== value) e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)'; }}
                                    onMouseLeave={e => { if (nat !== value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    {nat}
                                </div>
                            ))
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
