CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`primary_muscle` text NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`type` text NOT NULL,
	`is_preset` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `exercises_by_name` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `food_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`calories_per_100g` real NOT NULL,
	`protein_per_100g` real NOT NULL,
	`carbs_per_100g` real NOT NULL,
	`fat_per_100g` real NOT NULL,
	`default_serving_g` real,
	`is_preset` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`goal` text,
	`is_preset` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `routine_days` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_days_routine_position_unique` ON `routine_days` (`routine_id`,`position`);--> statement-breakpoint
CREATE TABLE `routine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer NOT NULL,
	`target_reps` integer NOT NULL,
	`warmup_sets` integer DEFAULT 0 NOT NULL,
	`superset_with` text,
	`rest_seconds` integer NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_exercises_day_position_unique` ON `routine_exercises` (`routine_day_id`,`position`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text,
	`routine_day_id` text,
	`routine_name` text NOT NULL,
	`day_name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`exercise_order` text NOT NULL,
	`skipped_exercise_ids` text DEFAULT '[]' NOT NULL,
	`total_volume_kg` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `completed_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`weight` real NOT NULL,
	`reps` integer NOT NULL,
	`rpe` real,
	`is_warmup` integer NOT NULL,
	`set_index` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sets_by_ex_weight` ON `completed_sets` (`exercise_id`,`weight`);--> statement-breakpoint
CREATE INDEX `sets_by_session` ON `completed_sets` (`session_id`);--> statement-breakpoint
CREATE TABLE `pr_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_name` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`previous_value` real,
	`achieved_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pr_by_exercise` ON `pr_records` (`exercise_id`,`type`,`value`);--> statement-breakpoint
CREATE INDEX `pr_by_session` ON `pr_records` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pr_session_exercise_type_unique` ON `pr_records` (`session_id`,`exercise_id`,`type`);--> statement-breakpoint
CREATE TABLE `body_weights` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`waist` real,
	`chest` real,
	`hips` real,
	`left_arm` real,
	`right_arm` real,
	`left_thigh` real,
	`right_thigh` real,
	`neck` real,
	`shoulders` real,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`uri` text NOT NULL,
	`weight_kg` real,
	`notes` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `food_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`meal_type` text NOT NULL,
	`food_item_id` text NOT NULL,
	`grams` real NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`food_item_id`) REFERENCES `food_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fitness_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`target_date` integer NOT NULL,
	`exercise_id` text,
	`target_weight` real,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scheduled_routines` (
	`day_of_week` integer PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`routine_day_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedule_overrides` (
	`date_key` text PRIMARY KEY NOT NULL,
	`routine_id` text,
	`routine_day_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_plans` (
	`date_key` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`routine_day_id` text NOT NULL,
	`exercises` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_day_id`) REFERENCES `routine_days`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `achievements_unlocked` (
	`id` text PRIMARY KEY NOT NULL,
	`unlocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`set_id` text,
	`exercise_id` text,
	`created_at` integer NOT NULL,
	`category` text NOT NULL,
	`body_part` text,
	`severity` integer,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_at` integer,
	`text` text NOT NULL,
	`source` text NOT NULL,
	`audio_uri` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`set_id`) REFERENCES `completed_sets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notes_by_session` ON `session_notes` (`session_id`);--> statement-breakpoint
CREATE INDEX `notes_by_exercise` ON `session_notes` (`exercise_id`);--> statement-breakpoint
CREATE INDEX `notes_by_created` ON `session_notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `notes_pain_active` ON `session_notes` (`body_part`,`severity`,`created_at`);--> statement-breakpoint
CREATE TABLE `feature_discoveries` (
	`feature_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`shown_at` integer,
	`decided_at` integer,
	`snooze_until` integer
);
--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`height_cm` real NOT NULL,
	`sex` text NOT NULL,
	`activity_level` text NOT NULL,
	`goal` text NOT NULL,
	`units` text NOT NULL,
	`theme` text NOT NULL,
	`calories_goal` integer,
	`protein_goal_g` integer,
	`carbs_goal_g` integer,
	`fat_goal_g` integer,
	`volume_targets` text,
	`updated_at` integer NOT NULL
);
