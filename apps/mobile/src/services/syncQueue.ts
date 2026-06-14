import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { database } from '../db';
import { SyncQueue } from '../db/models/SyncQueue';
import { mobileTokenStorage } from '../utils/auth';
import Toast from 'react-native-toast-message';

export interface SyncQueueItem {
  method: string;
  endpoint: string;
  payload?: unknown;
}

export async function enqueueSyncAction(item: SyncQueueItem) {
  try {
    await database.write(async () => {
      await database.get<SyncQueue>('sync_queue').create((record) => {
        record.method = item.method;
        record.endpoint = item.endpoint;
        record.payload = item.payload ? JSON.stringify(item.payload) : '';
        record.createdAt = Date.now();
      });
    });
    return true;
  } catch (e) {
    console.error('[syncQueue] enqueue failed', e);
    return false;
  }
}

let isSyncing = false;

export async function processSyncQueue() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const queueCollection = database.get<SyncQueue>('sync_queue');
    const pendingItems = await queueCollection.query().fetch();

    if (pendingItems.length === 0) {
      isSyncing = false;
      return;
    }

    let successCount = 0;

    for (const item of pendingItems) {
      try {
        const payload = item.payload ? JSON.parse(item.payload) : undefined;
        
        // Execute the queued API call
        // Using dynamic fetch via the shared api client
        const baseUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!baseUrl) throw new Error('EXPO_PUBLIC_API_URL not configured');
        const token = await mobileTokenStorage.getToken();
        const res = await fetch(`${baseUrl}/api/v1${item.endpoint}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: item.method === 'GET' ? undefined : (item.payload ? JSON.stringify(JSON.parse(item.payload)) : undefined),
        });

        if (res.ok) {
          // Remove from queue upon success
          await database.write(async () => {
            await item.destroyPermanently();
          });
          successCount++;
        }
      } catch (e) {
        console.error('Failed to sync item:', item.id, e);
        // Break out of the loop if network fails again to prevent thrashing
        break; 
      }
    }

    if (successCount > 0) {
      Toast.show({
        type: 'success',
        text1: 'Synced Offline Data',
        text2: `Successfully synchronized ${successCount} pending actions.`,
      });
    }

  } catch (error) {
    console.error('Sync process error:', error);
  } finally {
    isSyncing = false;
  }
}

// Start watching network status and app foreground to trigger sync
export function initOfflineSync() {
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      processSyncQueue();
    }
  });

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      processSyncQueue();
    }
  });
}
