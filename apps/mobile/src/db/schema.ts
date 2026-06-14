import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'method', type: 'string' },
        { name: 'endpoint', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
