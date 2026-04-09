'use client';

import { Phone, User } from 'lucide-react';
import { GuestService, type GuestSearchResult } from '@/lib/services/guest.service';
import { SmartSelect } from '@/components/ui/SmartSelect';

interface GuestSearchInputProps {
    onSelect: (guest: GuestSearchResult) => void;
    onAddNew: (name: string) => void;
    placeholder?: string;
    description?: string;
    value?: string;
}

export function GuestSearchInput({ onSelect, onAddNew, placeholder = "Search or add guest...", description, value }: GuestSearchInputProps) {
    return (
        <div>
            <SmartSelect<GuestSearchResult>
                searchFn={async (query) => GuestService.search({ query })}
                renderOption={(guest) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            height: '32px', width: '32px', borderRadius: '50%',
                            backgroundColor: 'var(--notion-bg-tertiary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, border: '1px solid var(--notion-border)',
                        }}>
                            <User size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500, color: 'var(--notion-text)', fontSize: '14px' }}>{guest.fullName}</span>
                            {guest.phone && (
                                <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Phone size={10} /> {guest.phone}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                getOptionLabel={(guest) => guest.fullName}
                onSelect={onSelect}
                onCreateNew={onAddNew}
                createNewLabel="Create new guest"
                placeholder={placeholder}
                value={value}
            />
            {description && <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{description}</p>}
        </div>
    );
}
