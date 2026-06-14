import { useState, useEffect, useCallback } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/api/client';
import { trackScreenView, trackAction, trackError } from '@/utils/analytics';
import { registerForPushNotificationsAsync } from '@/utils/push';
import { useHaptics } from '@/hooks/useHaptics';
import { useBiometric } from '@/hooks/useBiometric';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Heading, Text, Caption } from '@/components/ui/Typography';
import { Fingerprint, Hotel, LogOut } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setAuth, requiresBiometric, completeBiometricAuth, logout } = useAuthStore();
  const { medium, success, error: hapticError } = useHaptics();
  const { isAvailable, checkAvailability, authenticate } = useBiometric();

  const handleBiometricUnlock = useCallback(async () => {
    if (!isAvailable) return;
    const ok = await authenticate('Unlock Nivas Staff App');
    if (ok) {
      success();
      completeBiometricAuth();
    } else {
      hapticError();
    }
  }, [isAvailable, authenticate, completeBiometricAuth, success, hapticError]);

  useEffect(() => {
    trackScreenView('LoginScreen');
    checkAvailability();
  }, [checkAvailability]);

  // Auto-prompt biometric if required
  useEffect(() => {
    if (requiresBiometric && isAvailable) {
      handleBiometricUnlock();
    }
  }, [requiresBiometric, isAvailable, handleBiometricUnlock]);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);
    medium();
    try {
      const res = await api.iam.login.post({ email, password });
      if (res.data?.status === 'success' && res.data.data) {
        const { token, user } = res.data.data as any;
        await setAuth(token, user);
        success();
        trackAction('login_success', { role: user.role });
        await registerForPushNotificationsAsync();
      } else {
        hapticError();
        setError(res.data?.message || 'Login failed');
        trackError('login_failed', { reason: res.data?.message });
      }
    } catch (err: any) {
      hapticError();
      setError(err.message || 'Login failed');
      trackError('login_error', { message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    medium();
    logout();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-notion-bg-secondary"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        className="px-6"
      >
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-notion-bg border border-notion-border rounded-lg items-center justify-center mb-4">
            <Hotel size={32} color="#37352f" />
          </View>
          <Heading className="text-3xl text-center mb-0">Nivas</Heading>
          <Caption className="font-medium tracking-widest uppercase mt-1 text-notion-text-secondary">
            Staff Operations
          </Caption>
        </View>

        <Card variant="default" padding="lg">
          {error ? (
            <View className="bg-notion-red-bg border border-notion-red/30 rounded-md px-4 py-3 mb-6">
              <Text className="text-notion-red text-sm text-center font-medium">
                {error}
              </Text>
            </View>
          ) : null}

          {requiresBiometric ? (
            <View className="items-center py-4">
              <Fingerprint size={64} color="#37352f" style={{ marginBottom: 24, opacity: 0.8 }} />
              <Button
                label="Unlock with Biometrics"
                variant="primary"
                size="lg"
                onPress={handleBiometricUnlock}
                className="w-full mb-4"
              />
              <Button
                variant="outline"
                size="lg"
                onPress={handleLogout}
                className="w-full"
              >
                <View className="flex-row items-center justify-center">
                  <LogOut size={18} color="#37352f" style={{ marginRight: 8 }} />
                  <Text className="font-medium text-notion-text">
                    Sign Out & Use Password
                  </Text>
                </View>
              </Button>
            </View>
          ) : (
            <>
              <Input
                label="Email Address"
                placeholder="you@hotel.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                containerClassName="mb-6"
              />

              <Button
                label="Sign In"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                onPress={handleLogin}
                className="mb-4"
              />

              <Caption className="text-center mt-2">
                Secure staff-only access. Contact IT if locked out.
              </Caption>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
