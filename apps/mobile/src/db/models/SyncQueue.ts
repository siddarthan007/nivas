import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export class SyncQueue extends Model {
  static table = 'sync_queue';

  @text('method') method?: string;
  @text('endpoint') endpoint?: string;
  @text('payload') payload?: string;
  @date('created_at') createdAt?: Date;
}
