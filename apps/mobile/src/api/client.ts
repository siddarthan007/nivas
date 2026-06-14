import { createApiClient, type ApiClient } from '@nivas/shared-api';
import { mobileTokenStorage } from '../utils/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is required');
}

let onUnauthorizedHandler: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorizedHandler = handler;
};

const baseClient = createApiClient(
  API_URL,
  () => mobileTokenStorage.getToken(),
  () => {
    if (onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }
  }
);

export const api = (baseClient.api as any).v1 as ApiClient['api']['v1'];
