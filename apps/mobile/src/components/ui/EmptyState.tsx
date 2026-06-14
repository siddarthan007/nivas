import { View, Text } from 'react-native';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-16 px-6">
      {icon && <View className="mb-4 opacity-40">{icon}</View>}
      <Text className="text-lg font-semibold text-gray-700 text-center">{title}</Text>
      {description && (
        <Text className="text-sm text-gray-400 text-center mt-2">{description}</Text>
      )}
    </View>
  );
}
