import { useCallback } from 'react';
import { useBiometric } from './useBiometric';
import { useSettingsStore } from '../stores/settingsStore';
import { useHaptics } from './useHaptics';

export function useBiometricAuth() {
  const { isAvailable, authenticate } = useBiometric();
  const { settings } = useSettingsStore();
  const { error } = useHaptics();

  /**
   * Prompts the user for biometric auth if it's enabled and available.
   * Resolves to true if auth is successful OR if biometrics are disabled/unavailable.
   * Resolves to false ONLY if biometrics are enabled and the user fails/cancels the prompt.
   */
  const requireAuth = useCallback(async (reason: string = 'Authenticate to continue'): Promise<boolean> => {
    if (!settings.biometricEnabled || !isAvailable) {
      return true; // Bypass if not enabled or not available
    }

    const success = await authenticate(reason);
    if (!success) {
      error();
    }
    return success;
  }, [settings.biometricEnabled, isAvailable, authenticate, error]);

  return { requireAuth };
}
