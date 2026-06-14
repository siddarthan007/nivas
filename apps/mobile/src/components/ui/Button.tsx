import React from 'react';
import { Pressable, type PressableProps, ActivityIndicator } from 'react-native';
import { Text } from './Typography';
import { cn } from '@/utils/cn';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  label?: string;
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
}

export function Button({
  label,
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  className,
  textClassName,
  ...props
}: ButtonProps) {
  const content = children || label;

  return (
    <Pressable
      disabled={disabled || isLoading}
      className={cn(
        'group flex-row items-center justify-center rounded-xl overflow-hidden',
        // NativeWind v4 animations
        'active:scale-[0.98] transition-transform duration-100',
        size === 'sm' && 'h-8 px-4',
        size === 'md' && 'h-12 px-5',
        size === 'lg' && 'h-14 px-8',
        variant === 'primary' && 'bg-notion-text shadow-sm',
        variant === 'secondary' && 'bg-notion-bg border border-notion-border shadow-sm',
        variant === 'outline' && 'border-2 border-notion-border bg-transparent',
        variant === 'ghost' && 'bg-transparent',
        variant === 'danger' && 'bg-notion-red shadow-sm',
        (disabled || isLoading) && 'opacity-50',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' || variant === 'secondary' ? '#37352f' : '#ffffff'}
        />
      ) : (
        typeof content === 'string' ? (
          <Text
            className={cn(
              'font-medium text-center',
              // NativeWind v4 group opacity transition
              'group-active:opacity-80 transition-opacity duration-100',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base',
              variant === 'primary' && 'text-notion-bg',
              variant === 'secondary' && 'text-notion-text',
              variant === 'outline' && 'text-notion-text',
              variant === 'ghost' && 'text-notion-text-secondary',
              variant === 'danger' && 'text-white',
              textClassName
            )}
          >
            {content}
          </Text>
        ) : (
          content
        )
      )}
    </Pressable>
  );
}
