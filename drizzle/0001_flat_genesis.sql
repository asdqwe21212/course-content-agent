CREATE TABLE `agent_execution_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`agent_type` enum('content','exercise','assessment') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_execution_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_report` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`lecture_score` int NOT NULL,
	`exercise_score` int NOT NULL,
	`overall_score` int NOT NULL,
	`lecture_feedback` text NOT NULL,
	`exercise_feedback` text NOT NULL,
	`suggestions` text NOT NULL,
	`status` enum('pass','fail') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_report_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`outline` text NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercises_and_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`exercises` text NOT NULL,
	`answers` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercises_and_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lecture_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`content` text NOT NULL,
	`knowledge_points` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lecture_content_id` PRIMARY KEY(`id`)
);
