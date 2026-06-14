import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { SyncQueue } from './models/SyncQueue';

import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

const adapter = new SQLiteAdapter({
  schema,
  jsi: !isExpoGo, // Disable JSI in Expo Go to prevent initializeJSI crash
  onSetUpError: error => {
    console.error('WatermelonDB Setup Error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    SyncQueue,
  ],
});
