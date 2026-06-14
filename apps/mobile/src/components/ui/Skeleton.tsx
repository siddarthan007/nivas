import { View, type ViewStyle } from 'react-native';
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  circle?: boolean;
}

export function Skeleton({ className, width, height, circle }: SkeletonProps) {
  return (
    <View
      className={cn(
        'bg-gray-200 animate-pulse',
        circle && 'rounded-full',
        !circle && 'rounded-lg',
        className
      )}
      style={{ width, height } as ViewStyle}
    />
  );
}

export function CardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm">
      <View className="flex-row items-center">
        <Skeleton circle width={44} height={44} />
        <View className="ml-3 flex-1">
          <Skeleton width="60%" height={16} />
          <Skeleton className="mt-2" width="40%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function StatCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm min-w-[140px] items-center">
      <Skeleton width={24} height={24} />
      <Skeleton className="mt-2" width={50} height={28} />
      <Skeleton className="mt-1" width={60} height={12} />
    </View>
  );
}
