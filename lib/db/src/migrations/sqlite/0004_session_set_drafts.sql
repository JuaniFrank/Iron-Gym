-- Idempotent on purpose: devices that ran the unmerged `fix/minor-issues`
-- build already created this table (and its indexes) with their own migration,
-- recorded under an older `when`. A plain CREATE would crash boot with
-- "table already exists". Keep every statement here `IF NOT EXISTS`.
CREATE TABLE IF NOT EXISTS `session_set_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`is_warmup` integer NOT NULL,
	`weight` real,
	`reps` integer,
	`rpe` real,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drafts_by_session` ON `session_set_drafts` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `drafts_slot_uq` ON `session_set_drafts` (`session_id`,`exercise_id`,`set_index`,`is_warmup`);
