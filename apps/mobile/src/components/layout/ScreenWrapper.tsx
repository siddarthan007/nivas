import { View, ScrollView, RefreshControl, type ViewProps, type ScrollViewProps, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { cn } from '@/utils/cn';

interface ScreenWrapperProps extends ViewProps {
  scrollable?: boolean;
  refreshControl?: RefreshControlProps;
  children: React.ReactNode;
}

export function ScreenWrapper({
  children,
  scrollable = false,
  refreshControl,
  className,
  ...props
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bg = isDark ? 'bg-[#191919]' : 'bg-[#f7f6f3]';

  const content = (
    <View
      className={cn('flex-1 px-4', bg, className)}
      style={{ paddingBottom: insets.bottom }}
      {...props}
    >
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        className={cn('flex-1', bg, className)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        refreshControl={refreshControl ? <RefreshControl {...refreshControl} /> : undefined}
        showsVerticalScrollIndicator={false}
        {...(props as ScrollViewProps)}
      >
        {children}
      </ScrollView>
    );
  }

  return content;
}
