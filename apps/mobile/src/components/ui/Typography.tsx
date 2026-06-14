import React, { isValidElement, type ReactNode } from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { s } from 'react-native-size-matters';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

function sanitizeChildren(children: ReactNode): ReactNode {
    if (children == null || typeof children === 'boolean') return children;
    if (children instanceof Date) return children.toLocaleString();
    if (typeof children === 'string' || typeof children === 'number') return children;
    if (Array.isArray(children)) return children.map(sanitizeChildren);
    if (isValidElement(children)) return children;
    if (typeof children === 'object' && 'toISOString' in children) {
        try {
            return new Date((children as Date).toISOString()).toLocaleString();
        } catch {
            return String(children);
        }
    }
    if (typeof children === 'object') return String(children);
    return children;
}

interface TypographyProps extends RNTextProps {
    className?: string;
    children: React.ReactNode;
}

export function Heading({ className, children, style, ...props }: TypographyProps) {
    return (
        <RNText 
            className={cn('font-bold text-notion-text dark:text-white', className)}
            style={[{ fontSize: s(24), marginBottom: s(8) }, style]}
            {...props}
        >
            {sanitizeChildren(children)}
        </RNText>
    );
}

export function Subheading({ className, children, style, ...props }: TypographyProps) {
    return (
        <RNText 
            className={cn('font-semibold text-notion-text dark:text-white', className)}
            style={[{ fontSize: s(18), marginBottom: s(4) }, style]}
            {...props}
        >
            {sanitizeChildren(children)}
        </RNText>
    );
}

export function Text({ className, children, style, ...props }: TypographyProps) {
    return (
        <RNText 
            className={cn('text-notion-text dark:text-white', className)}
            style={[{ fontSize: s(14) }, style]}
            {...props}
        >
            {sanitizeChildren(children)}
        </RNText>
    );
}

export function Caption({ className, children, style, ...props }: TypographyProps) {
    return (
        <RNText 
            className={cn('text-notion-text-secondary dark:text-white/55', className)}
            style={[{ fontSize: s(12) }, style]}
            {...props}
        >
            {sanitizeChildren(children)}
        </RNText>
    );
}
