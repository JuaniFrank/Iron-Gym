ALTER TABLE `user_profile` ADD `rest_notification_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `rest_notification_type` text DEFAULT 'rich' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `rest_notification_sound` text DEFAULT 'default' NOT NULL;