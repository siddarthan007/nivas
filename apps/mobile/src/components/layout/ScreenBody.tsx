import React from 'react';
import { ResponsiveContainer } from '@/components/layout/ResponsiveContainer';

interface ScreenBodyProps {
    children: React.ReactNode;
    maxWidth?: number;
}

/** Constrains main screen content width on tablets. */
export function ScreenBody({ children, maxWidth = 1024 }: ScreenBodyProps) {
    return (
        <ResponsiveContainer maxWidth={maxWidth} centered>
            {children}
        </ResponsiveContainer>
    );
}
