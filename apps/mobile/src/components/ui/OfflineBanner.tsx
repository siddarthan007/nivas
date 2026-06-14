import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from './Typography';
import { WifiOff } from 'lucide-react-native';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useSharedValue(-100);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      if (offline) {
        translateY.value = withSpring(0, { damping: 15 });
      } else {
        translateY.value = withTiming(-100, { duration: 300 });
      }
    });

    return () => unsubscribe();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isOffline && translateY.value === -100) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <SafeAreaView edges={['top']}>
        <View className="bg-red-500/90 py-2 px-4 flex-row items-center justify-center gap-2 shadow-lg">
          <WifiOff color="white" size={16} />
          <Text className="text-white font-bold text-sm text-center">
            You are offline. Some actions will sync when you're back online.
          </Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});
