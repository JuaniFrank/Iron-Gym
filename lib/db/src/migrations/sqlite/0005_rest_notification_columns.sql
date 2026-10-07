-- Devices that ran the unmerged `fix/minor-issues` build already have these
-- columns (SQLite has no ADD COLUMN IF NOT EXISTS). `migrateAsync` treats a
-- "duplicate column name" error on an `ALTER TABLE ... ADD` as already applied,
-- so keep every statement here a plain single-column ADD.
ALTER TABLE `user_profile` ADD `rest_notification_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `rest_notification_type` text DEFAULT 'rich' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `rest_notification_sound` text DEFAULT 'default' NOT NULL;