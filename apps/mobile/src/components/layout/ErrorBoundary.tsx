import { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
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

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary]', error, errorInfo);
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
        <View className="flex-1 bg-gray-50 items-center justify-center px-6">
          <TriangleAlert size={48} color="#ef4444" />
          <Text className="text-xl font-bold text-gray-900 mt-4 text-center">
            Something went wrong
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.handleReset}
            className="mt-6 bg-primary-900 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
