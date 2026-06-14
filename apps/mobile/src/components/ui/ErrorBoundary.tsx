import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View className="flex-1 bg-notion-bg items-center justify-center p-6">
          <TriangleAlert size={48} color="#e03e3e" />
          <Text className="text-notion-text text-xl font-bold mt-4 mb-2">Something went wrong</Text>
          <Text className="text-notion-text-secondary text-center mb-6">{this.state.error?.message || 'An unexpected error occurred.'}</Text>
          <TouchableOpacity
            onPress={this.handleReset}
            className="bg-notion-blue px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-bold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
