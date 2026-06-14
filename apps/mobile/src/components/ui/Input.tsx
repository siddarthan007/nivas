import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Typography';
import { cn } from '@/utils/cn';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  className,
  containerClassName,
  onFocus,
  onBlur,
  ...props
}: InputProps) {

  return (
    <View className={cn('w-full mb-4', containerClassName)}>
      {label && (
        <Text className="mb-1.5 text-xs font-semibold text-notion-text-secondary uppercase tracking-wider">
          {label}
        </Text>
      )}
      <TextInput
        className={cn(
          'w-full h-11 px-3 rounded-md text-sm text-notion-text',
          'bg-notion-bg-secondary border border-notion-border',
          'focus:border-notion-blue focus:bg-notion-bg focus:shadow-sm',
          error && 'border-notion-red focus:border-notion-red bg-notion-red-bg',
          className
        )}
        placeholderTextColor="#9b9a97"
        onFocus={onFocus}
        onBlur={onBlur}
        {...props}
      />
      {error && (
        <Text className="mt-1.5 text-xs text-notion-red">
          {error}
        </Text>
      )}
    </View>
  );
}
