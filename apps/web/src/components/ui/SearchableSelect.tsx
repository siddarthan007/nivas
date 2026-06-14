'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface SearchableOption {
    value: string | number;
    label: string;
    subtitle?: string;
}

interface SearchableSelectProps {
    value?: string | number | null;
    onChange: (value: string | number) => void;
    options: SearchableOption[];
    label?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    fullWidth?: boolean;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    emptyText?: string;
}

export default function SearchableSelect({
    value,
    onChange,
    options,
    label,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    fullWidth = false,
    disabled = false,
    required = false,
    error,
    emptyText = 'No results found',
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedLabel = useMemo(() => {
        const found = options.find(o => String(o.value) === String(value));
        return found ? found.label : '';
    }, [options, value]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.subtitle?.toLowerCase().includes(q) ?? false)
        );
    }, [options, search]);

    const handleSelect = useCallback((opt: SearchableOption) => {
        onChange(opt.value);
        setIsOpen(false);
        setSearch('');
    }, [onChange]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    }, [onChange]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <div ref={containerRef} style={{ width: fullWidth ? '100%' : 'auto', position: 'relative' }}>
            {label && (
                <label style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--notion-text-secondary)',
                    marginBottom: '4px',
                    display: 'block'
                }}>
                    {label}{required && <span style={{ color: 'var(--notion-red)' }}>*</span>}
                </label>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: '14px',
                    lineHeight: '20px',
                    color: selectedLabel ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                    backgroundColor: disabled ? 'var(--notion-bg-tertiary)' : 'var(--notion-bg)',
                    border: error ? '1px solid var(--notion-red)' : '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                className="hover-border-focus"
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedLabel || placeholder}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                    {selectedLabel && (
                        <span
                            onClick={handleClear}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'var(--notion-text-secondary)'
                            }}
                            className="hover-bg"
                        >
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={14} style={{ color: 'var(--notion-text-secondary)', transition: 'transform 0.15s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                </div>
            </button>

            {error && (
                <span style={{ fontSize: '12px', color: 'var(--notion-red)', marginTop: '4px', display: 'block' }}>
                    {error}
                </span>
            )}

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--notion-border)',
                    }}>
                        <Search size={14} style={{ color: 'var(--notion-text-secondary)', flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={searchPlaceholder}
                            style={{
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: '14px',
                                color: 'var(--notion-text)',
                                padding: 0
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filtered.length === 0 ? (
                            <div style={{
                                padding: '12px',
                                textAlign: 'center',
                                fontSize: '13px',
                                color: 'var(--notion-text-secondary)'
                            }}>
                                {emptyText}
                            </div>
                        ) : (
                            filtered.map(opt => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => handleSelect(opt)}
                                        style={{
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            color: 'var(--notion-text)',
                                            backgroundColor: isSelected ? 'var(--notion-blue-bg)' : 'transparent',
                                            borderLeft: isSelected ? '3px solid var(--notion-blue)' : '3px solid transparent',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px'
                                        }}
                                        className="hover-bg"
                                        onMouseEnter={e => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)';
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{opt.label}</span>
                                        {opt.subtitle && (
                                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                {opt.subtitle}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
