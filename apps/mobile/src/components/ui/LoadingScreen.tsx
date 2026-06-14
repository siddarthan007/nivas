import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      <ActivityIndicator size="large" color="#1a365d" />
      <Text className="text-gray-500 mt-4 text-base font-medium text-center">{message}</Text>
      {slow && (
        <Text className="text-gray-400 mt-3 text-sm text-center leading-5">
          Still loading? Check that the backend is running and EXPO_PUBLIC_API_URL points to your computer&apos;s LAN IP (not localhost) on a physical device.
        </Text>
      )}
    </View>
  );
}
