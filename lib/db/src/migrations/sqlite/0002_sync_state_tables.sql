CREATE TABLE `_outbox` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`op` text NOT NULL,
	`queued_at` integer NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`)
);
--> statement-breakpoint
CREATE TABLE `_sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
