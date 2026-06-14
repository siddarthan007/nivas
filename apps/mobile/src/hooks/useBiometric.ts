import { useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsAvailable(false);
      return false;
    }
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      setIsAvailable(false);
      return false;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsAvailable(enrolled);
    return enrolled;
  }, []);

  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason || 'Authenticate to continue',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  }, []);

  return { isAvailable, checkAvailability, authenticate };
}
