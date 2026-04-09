'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Search, Plus, Loader2, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';

export interface SmartSelectProps<T> {
    searchFn: (query: string) => Promise<T[]>;
    renderOption: (item: T) => ReactNode;
    getOptionLabel: (item: T) => string;
    onSelect: (item: T) => void;
    onCreateNew?: (query: string) => void;
    createNewLabel?: string;
    placeholder?: string;
    label?: string;
    error?: string;
    value?: string;
    minQueryLength?: number;
    debounceMs?: number;
    disabled?: boolean;
}

export function SmartSelect<T>({
    searchFn,
    renderOption,
    getOptionLabel,
    onSelect,
    onCreateNew,
    createNewLabel = 'Create new',
    placeholder = 'Search...',
    label,
    error,
    value,
    minQueryLength = 2,
    debounceMs = 300,
    disabled = false,
}: SmartSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(value ?? '');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<T[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const debouncedQuery = useDebounce(query, debounceMs);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value !== undefined) setQuery(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (query.length >= minQueryLength) {
            setResults([]);
        }
    }, [query, minQueryLength]);

    useEffect(() => {
        const doSearch = async () => {
            if (!debouncedQuery || debouncedQuery.length < minQueryLength) {
                setResults([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await searchFn(debouncedQuery);
                setResults(data);
                setHighlightedIndex(-1);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        };
        doSearch();
    }, [debouncedQuery, minQueryLength, searchFn]);

    const handleSelectItem = useCallback((item: T) => {
        setQuery(getOptionLabel(item));
        onSelect(item);
        setOpen(false);
        setResults([]);
    }, [getOptionLabel, onSelect]);

    const handleCreateNew = useCallback(() => {
        onCreateNew?.(query);
        setOpen(false);
    }, [onCreateNew, query]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!open) return;

        const totalItems = results.length + (onCreateNew && query.length >= minQueryLength ? 1 : 0);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (totalItems > 0) setHighlightedIndex(prev => (prev + 1) % totalItems);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (totalItems > 0) setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < results.length) {
                    handleSelectItem(results[highlightedIndex]!);
                } else if (highlightedIndex === results.length && onCreateNew) {
                    handleCreateNew();
                }
                break;
            case 'Escape':
                setOpen(false);
                inputRef.current?.blur();
                break;
        }
    }, [open, results, highlightedIndex, query, minQueryLength, onCreateNew, handleSelectItem, handleCreateNew]);

    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll('[data-smart-option]');
            items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    const showDropdown = open && query.length >= minQueryLength;

    return (
        <div style={{ position: 'relative', width: '100%' }} ref={wrapperRef}>
            {label && (
                <label style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--notion-text-secondary)',
                    marginBottom: '4px',
                    display: 'block',
                }}>
                    {label}
                </label>
            )}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: disabled ? 'var(--notion-bg-tertiary)' : 'var(--notion-bg)',
                border: error
                    ? '1px solid var(--notion-red)'
                    : '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
                boxShadow: open ? '0 0 0 2px var(--notion-blue-light)' : 'none',
                opacity: disabled ? 0.6 : 1,
            }}>
                <Search size={14} style={{ marginLeft: '10px', color: 'var(--notion-text-secondary)', flexShrink: 0 }} />
                <input
                    ref={inputRef}
                    style={{
                        width: '100%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '14px',
                        padding: '8px 10px',
                        color: 'var(--notion-text)',
                    }}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => { if (query.length > 0) setOpen(true); }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                {loading && <Loader2 className="animate-spin" size={14} style={{ marginRight: '10px', color: 'var(--notion-text-secondary)', flexShrink: 0 }} />}
                <ChevronDown size={14} style={{ marginRight: '10px', color: 'var(--notion-text-secondary)', flexShrink: 0 }} />
            </div>

            {showDropdown && (
                <div
                    ref={listRef}
                    style={{
                        position: 'absolute',
                        zIndex: 9999,
                        width: '100%',
                        marginTop: '4px',
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        overflow: 'hidden',
                        maxHeight: '280px',
                        overflowY: 'auto',
                    }}
                >
                    {loading && (
                        <div style={{ padding: '12px', display: 'flex', justifyContent: 'center', color: 'var(--notion-text-secondary)' }}>
                            <Loader2 className="animate-spin" size={16} />
                        </div>
                    )}

                    {!loading && results.length > 0 && results.map((item, idx) => (
                        <div
                            key={idx}
                            data-smart-option
                            onClick={() => handleSelectItem(item)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                backgroundColor: highlightedIndex === idx ? 'var(--notion-bg-hover)' : 'transparent',
                                transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                        >
                            {renderOption(item)}
                        </div>
                    ))}

                    {!loading && results.length === 0 && query.length >= minQueryLength && !onCreateNew && (
                        <div style={{ padding: '12px', color: 'var(--notion-text-secondary)', fontSize: '13px', textAlign: 'center' }}>
                            No results found
                        </div>
                    )}

                    {!loading && onCreateNew && query.length >= minQueryLength && (
                        <div
                            data-smart-option
                            onClick={handleCreateNew}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderTop: results.length > 0 ? '1px solid var(--notion-border)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--notion-blue)',
                                fontWeight: 500,
                                fontSize: '14px',
                                backgroundColor: highlightedIndex === results.length ? 'var(--notion-bg-hover)' : 'transparent',
                                transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={() => setHighlightedIndex(results.length)}
                        >
                            <Plus size={16} />
                            <span>{createNewLabel} &ldquo;{query}&rdquo;</span>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <span style={{ fontSize: '12px', color: 'var(--notion-red)', marginTop: '4px', display: 'block' }}>
                    {error}
                </span>
            )}
        </div>
    );
}

export default SmartSelect;
