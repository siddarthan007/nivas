/**
 * Nivas Shared API Client
 * Eden Treaty v2 client factory for both web and mobile apps.
 */

import { treaty } from '@elysiajs/eden';
import type { Treaty } from '@elysiajs/eden';
import type { App } from '../../../services/backend/src/index';

export type { App };

export function createApiClient(
    baseUrl: string,
    getToken: () => string | null | Promise<string | null>,
    onUnauthorized?: () => void
): Treaty.Create<App> {
    return treaty<App>(baseUrl, {
        headers: async () => {
            const token = await getToken();
            const headers: Record<string, string> = { 'x-client-type': 'mobile' };
            if (token) headers.Authorization = `Bearer ${token}`;
            return headers;
        },
        onResponse: (response) => {
            if (response.status === 401 && onUnauthorized) {
                // If it's a 401 Unauthorized, globally log the user out
                onUnauthorized();
            }
        }
    });
}

export type ApiClient = Treaty.Create<App>;
