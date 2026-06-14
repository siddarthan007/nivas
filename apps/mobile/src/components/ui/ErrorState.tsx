import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { WifiOff, RefreshCcw } from 'lucide-react-native';
import { Heading, Text } from './Typography';
import Animated, { FadeIn } from 'react-native-reanimated';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}

export function ErrorState({ 
  title = "Connection Error", 
  message = "We couldn't connect to the server. Please check your internet connection and try again.", 
  onRetry,
  icon 
}: ErrorStateProps) {
  return (
    <Animated.View entering={FadeIn} className="flex-1 items-center justify-center p-6 bg-notion-bg dark:bg-notion-bg-secondary">
      <View className="w-20 h-20 bg-notion-red/10 rounded-full items-center justify-center mb-6 border border-notion-red/20">
        {icon || <WifiOff size={32} color="#e03e3e" />}
      </View>
      <Heading className="text-center mb-2">{title}</Heading>
      <Text className="text-center text-notion-text-secondary mb-8 leading-relaxed max-w-[280px]">
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity 
          onPress={onRetry}
          className="bg-notion-text px-6 py-3 rounded-lg flex-row items-center"
        >
          <RefreshCcw size={16} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-bold">Retry Now</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
