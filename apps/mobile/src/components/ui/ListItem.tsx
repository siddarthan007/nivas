import { TouchableOpacity, View, Text, type TouchableOpacityProps } from 'react-native';
import { cn } from '@/utils/cn';
import { ChevronRight } from 'lucide-react-native';

export interface ListItemProps extends TouchableOpacityProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  showChevron?: boolean;
}

export function ListItem({
  title,
  subtitle,
  badge,
  badgeVariant = 'default',
  icon,
  showChevron = true,
  className,
  ...props
}: ListItemProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={cn(
        'flex-row items-center px-4 py-4 bg-white border-b border-gray-100',
        className
      )}
      {...props}
    >
      {icon && <View className="mr-4">{icon}</View>}
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">{title}</Text>
        {subtitle && <Text className="text-sm text-gray-500 mt-0.5">{subtitle}</Text>}
      </View>
      {badge && (
        <View
          className={cn(
            'px-2.5 py-1 rounded-full mr-2',
            badgeVariant === 'default' && 'bg-gray-100',
            badgeVariant === 'success' && 'bg-green-100',
            badgeVariant === 'warning' && 'bg-amber-100',
            badgeVariant === 'danger' && 'bg-red-100',
            badgeVariant === 'info' && 'bg-blue-100'
          )}
        >
          <Text
            className={cn(
              'text-xs font-medium',
              badgeVariant === 'default' && 'text-gray-700',
              badgeVariant === 'success' && 'text-green-700',
              badgeVariant === 'warning' && 'text-amber-700',
              badgeVariant === 'danger' && 'text-red-700',
              badgeVariant === 'info' && 'text-blue-700'
            )}
          >
            {badge}
          </Text>
        </View>
      )}
      {showChevron && <ChevronRight size={20} color="#9ca3af" />}
    </TouchableOpacity>
  );
}
