import journal from './meta/_journal.json';
import m0000 from './0000_happy_johnny_storm.sql';
import m0001 from './0001_full_schema.sql';
import m0002 from './0002_sync_state_tables.sql';
import m0003 from './0003_sync_capture_triggers.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  