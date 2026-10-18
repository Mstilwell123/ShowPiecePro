CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`customer` text,
	`subscription` text,
	`status` text DEFAULT 'free' NOT NULL,
	`period_start` integer DEFAULT 0 NOT NULL,
	`period_end` integer DEFAULT 0 NOT NULL,
	`brand` text DEFAULT '{}' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_customer_unique` ON `accounts` (`customer`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_subscription_unique` ON `accounts` (`subscription`);--> statement-breakpoint
CREATE TABLE `video_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`state` text NOT NULL,
	`free_trial` integer NOT NULL,
	`period_start` integer NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`object_key` text,
	`mime` text,
	`bytes` integer,
	FOREIGN KEY (`user_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exports_owner` ON `video_exports` (`user_id`,`period_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_free_video_per_account` ON `video_exports` (`user_id`) WHERE "video_exports"."free_trial" = 1 and "video_exports"."state" in ('reserved','uploading','completed');