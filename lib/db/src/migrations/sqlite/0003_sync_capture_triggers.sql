-- Sync change capture (ironlog-db-sync T1).
--
-- AFTER INSERT / UPDATE / DELETE triggers on every syncable table enqueue the
-- affected row into `_outbox` (one pending entry per row; latest op wins).
-- Syncable = every domain table except `_meta`, `key_value`,
-- `feature_discoveries`, `_outbox` and `_sync_state`.
--
-- Rules:
--   * Capture is suppressed while `_sync_state.applying = '1'` (the sync engine
--     sets it while applying pulled remote changes).
--   * Tables with an `is_preset` column (exercises, food_items, routines) only
--     capture non-preset rows.
--   * `row_id` is the single-column primary key cast to TEXT: `id` for most
--     tables, `day_of_week` (e.g. '3') for scheduled_routines and `date_key`
--     for schedule_overrides / session_plans. No syncable table has a composite key.
--   * FK cascades fire these triggers too, so cascaded child deletes enqueue
--     their own tombstones.
--   * Each trigger is its own statement (breakpoint-separated) because the
--     drizzle expo migrator splits on the breakpoint marker.

INSERT INTO `_sync_state` (`key`, `value`) VALUES ('applying', '0');
--> statement-breakpoint
CREATE TRIGGER `exercises_sync_insert` AFTER INSERT ON `exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('exercises', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `exercises_sync_update` AFTER UPDATE ON `exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('exercises', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `exercises_sync_delete` AFTER DELETE ON `exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND OLD.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('exercises', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_items_sync_insert` AFTER INSERT ON `food_items`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_items', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_items_sync_update` AFTER UPDATE ON `food_items`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_items', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_items_sync_delete` AFTER DELETE ON `food_items`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND OLD.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_items', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routines_sync_insert` AFTER INSERT ON `routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routines', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routines_sync_update` AFTER UPDATE ON `routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND NEW.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routines', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routines_sync_delete` AFTER DELETE ON `routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0' AND OLD.`is_preset` = 0
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routines', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_days_sync_insert` AFTER INSERT ON `routine_days`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_days', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_days_sync_update` AFTER UPDATE ON `routine_days`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_days', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_days_sync_delete` AFTER DELETE ON `routine_days`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_days', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_exercises_sync_insert` AFTER INSERT ON `routine_exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_exercises', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_exercises_sync_update` AFTER UPDATE ON `routine_exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_exercises', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `routine_exercises_sync_delete` AFTER DELETE ON `routine_exercises`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('routine_exercises', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `workout_sessions_sync_insert` AFTER INSERT ON `workout_sessions`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('workout_sessions', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `workout_sessions_sync_update` AFTER UPDATE ON `workout_sessions`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('workout_sessions', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `workout_sessions_sync_delete` AFTER DELETE ON `workout_sessions`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('workout_sessions', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `completed_sets_sync_insert` AFTER INSERT ON `completed_sets`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('completed_sets', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `completed_sets_sync_update` AFTER UPDATE ON `completed_sets`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('completed_sets', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `completed_sets_sync_delete` AFTER DELETE ON `completed_sets`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('completed_sets', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `pr_records_sync_insert` AFTER INSERT ON `pr_records`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('pr_records', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `pr_records_sync_update` AFTER UPDATE ON `pr_records`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('pr_records', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `pr_records_sync_delete` AFTER DELETE ON `pr_records`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('pr_records', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_weights_sync_insert` AFTER INSERT ON `body_weights`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_weights', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_weights_sync_update` AFTER UPDATE ON `body_weights`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_weights', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_weights_sync_delete` AFTER DELETE ON `body_weights`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_weights', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_measurements_sync_insert` AFTER INSERT ON `body_measurements`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_measurements', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_measurements_sync_update` AFTER UPDATE ON `body_measurements`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_measurements', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `body_measurements_sync_delete` AFTER DELETE ON `body_measurements`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('body_measurements', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `progress_photos_sync_insert` AFTER INSERT ON `progress_photos`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('progress_photos', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `progress_photos_sync_update` AFTER UPDATE ON `progress_photos`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('progress_photos', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `progress_photos_sync_delete` AFTER DELETE ON `progress_photos`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('progress_photos', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_entries_sync_insert` AFTER INSERT ON `food_entries`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_entries', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_entries_sync_update` AFTER UPDATE ON `food_entries`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_entries', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `food_entries_sync_delete` AFTER DELETE ON `food_entries`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('food_entries', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `fitness_goals_sync_insert` AFTER INSERT ON `fitness_goals`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('fitness_goals', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `fitness_goals_sync_update` AFTER UPDATE ON `fitness_goals`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('fitness_goals', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `fitness_goals_sync_delete` AFTER DELETE ON `fitness_goals`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('fitness_goals', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `scheduled_routines_sync_insert` AFTER INSERT ON `scheduled_routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('scheduled_routines', CAST(NEW.`day_of_week` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `scheduled_routines_sync_update` AFTER UPDATE ON `scheduled_routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('scheduled_routines', CAST(NEW.`day_of_week` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `scheduled_routines_sync_delete` AFTER DELETE ON `scheduled_routines`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('scheduled_routines', CAST(OLD.`day_of_week` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `schedule_overrides_sync_insert` AFTER INSERT ON `schedule_overrides`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('schedule_overrides', CAST(NEW.`date_key` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `schedule_overrides_sync_update` AFTER UPDATE ON `schedule_overrides`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('schedule_overrides', CAST(NEW.`date_key` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `schedule_overrides_sync_delete` AFTER DELETE ON `schedule_overrides`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('schedule_overrides', CAST(OLD.`date_key` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_plans_sync_insert` AFTER INSERT ON `session_plans`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_plans', CAST(NEW.`date_key` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_plans_sync_update` AFTER UPDATE ON `session_plans`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_plans', CAST(NEW.`date_key` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_plans_sync_delete` AFTER DELETE ON `session_plans`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_plans', CAST(OLD.`date_key` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `achievements_unlocked_sync_insert` AFTER INSERT ON `achievements_unlocked`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('achievements_unlocked', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `achievements_unlocked_sync_update` AFTER UPDATE ON `achievements_unlocked`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('achievements_unlocked', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `achievements_unlocked_sync_delete` AFTER DELETE ON `achievements_unlocked`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('achievements_unlocked', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_notes_sync_insert` AFTER INSERT ON `session_notes`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_notes', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_notes_sync_update` AFTER UPDATE ON `session_notes`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_notes', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `session_notes_sync_delete` AFTER DELETE ON `session_notes`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('session_notes', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `user_profile_sync_insert` AFTER INSERT ON `user_profile`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('user_profile', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `user_profile_sync_update` AFTER UPDATE ON `user_profile`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('user_profile', CAST(NEW.`id` AS TEXT), 'upsert', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
--> statement-breakpoint
CREATE TRIGGER `user_profile_sync_delete` AFTER DELETE ON `user_profile`
WHEN (SELECT `value` FROM `_sync_state` WHERE `key` = 'applying') = '0'
BEGIN
  INSERT INTO `_outbox` (`table_name`, `row_id`, `op`, `queued_at`)
  VALUES ('user_profile', CAST(OLD.`id` AS TEXT), 'delete', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  ON CONFLICT (`table_name`, `row_id`) DO UPDATE SET `op` = excluded.`op`, `queued_at` = excluded.`queued_at`;
END;
