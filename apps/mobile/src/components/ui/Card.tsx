import React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/utils/cn';

export interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outline' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}: CardProps) {
  const containerClasses = cn(
    'rounded-xl overflow-hidden bg-notion-bg dark:bg-notion-bg-secondary',
    variant === 'default' && 'border border-notion-border dark:border-white/10 shadow-sm',
    variant === 'elevated' && 'border border-notion-border dark:border-white/10 shadow-md',
    variant === 'outline' && 'border border-notion-border dark:border-white/10 bg-notion-bg-secondary dark:bg-notion-bg-tertiary',
    variant === 'ghost' && 'bg-transparent',
    padding === 'sm' && 'p-3',
    padding === 'md' && 'p-5',
    padding === 'lg' && 'p-6',
    className
  );

  return (
    <View className={containerClasses} {...props}>
      {children}
    </View>
  );
}
