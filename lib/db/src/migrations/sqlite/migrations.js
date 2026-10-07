// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_happy_johnny_storm.sql';
import m0001 from './0001_full_schema.sql';
import m0002 from './0002_sync_state_tables.sql';
import m0003 from './0003_sync_capture_triggers.sql';
import m0004 from './0004_session_set_drafts.sql';
import m0005 from './0005_rest_notification_columns.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  