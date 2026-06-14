import { View, Text } from 'react-native';
import { cn } from '@/utils/cn';

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ label, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <View
      className={cn(
        'rounded-full items-center justify-center',
        size === 'sm' && 'px-2.5 py-1',
        size === 'md' && 'px-3 py-1.5',
        variant === 'default' && 'bg-gray-100',
        variant === 'success' && 'bg-success-100',
        variant === 'warning' && 'bg-warning-100',
        variant === 'danger' && 'bg-danger-100',
        variant === 'info' && 'bg-secondary-100',
        className
      )}
    >
      <Text
        className={cn(
          'font-medium',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          variant === 'default' && 'text-gray-700',
          variant === 'success' && 'text-success-700',
          variant === 'warning' && 'text-warning-700',
          variant === 'danger' && 'text-danger-700',
          variant === 'info' && 'text-secondary-700'
        )}
      >
        {label}
      </Text>
    </View>
  );
}
