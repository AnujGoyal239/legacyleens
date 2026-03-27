import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('pgvector extension enabled');

  // Create missing tables not covered by migrations
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "chat_channels" (
      "id" TEXT NOT NULL,
      "project_id" TEXT,
      "type" TEXT NOT NULL,
      "name" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "chat_channels_project_id_idx" ON "chat_channels"("project_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "chat_members" (
      "id" TEXT NOT NULL,
      "channel_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'member',
      "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chat_members_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "chat_members_channel_id_user_id_key" UNIQUE ("channel_id", "user_id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "chat_members_user_id_idx" ON "chat_members"("user_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "messages" (
      "id" TEXT NOT NULL,
      "channel_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "mentions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "reply_to_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "messages_channel_id_idx" ON "messages"("channel_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "messages_user_id_idx" ON "messages"("user_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "file_assignments" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "file_path" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "assigned_by" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "file_assignments_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "file_assignments_project_id_file_path_user_id_key" UNIQUE ("project_id", "file_path", "user_id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "file_assignments_project_id_idx" ON "file_assignments"("project_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "file_assignments_user_id_idx" ON "file_assignments"("user_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "card_pull_requests" (
      "id" TEXT NOT NULL,
      "card_id" TEXT NOT NULL,
      "pr_id" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "card_pull_requests_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "card_pull_requests_card_id_pr_id_key" UNIQUE ("card_id", "pr_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "benchmark_suites" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "benchmark_suites_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_suites_project_id_idx" ON "benchmark_suites"("project_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "benchmark_cases" (
      "id" TEXT NOT NULL,
      "suite_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "prompt" TEXT NOT NULL,
      "expected_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "expected_file_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "min_score" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "benchmark_cases_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_cases_suite_id_idx" ON "benchmark_cases"("suite_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "benchmark_runs" (
      "id" TEXT NOT NULL,
      "suite_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "model_name" TEXT,
      "temperature" DOUBLE PRECISION,
      "max_tokens" INTEGER,
      "ai_test_mode" BOOLEAN NOT NULL DEFAULT false,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "error" TEXT,
      "started_at" TIMESTAMP(3),
      "finished_at" TIMESTAMP(3),
      "total_cases" INTEGER NOT NULL DEFAULT 0,
      "passed_cases" INTEGER NOT NULL DEFAULT 0,
      "average_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "total_latency_ms" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "benchmark_runs_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_runs_suite_id_idx" ON "benchmark_runs"("suite_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_runs_user_id_idx" ON "benchmark_runs"("user_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_runs_status_idx" ON "benchmark_runs"("status")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "benchmark_results" (
      "id" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "case_id" TEXT NOT NULL,
      "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "passed" BOOLEAN NOT NULL DEFAULT false,
      "latency_ms" INTEGER NOT NULL DEFAULT 0,
      "answer_text" TEXT,
      "matched_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "matched_file_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "benchmark_results_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "benchmark_results_run_id_case_id_key" UNIQUE ("run_id", "case_id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_results_run_id_idx" ON "benchmark_results"("run_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "benchmark_results_case_id_idx" ON "benchmark_results"("case_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "codebase_health_scores" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "overall_score" INTEGER NOT NULL,
      "doc_coverage_score" INTEGER NOT NULL,
      "critical_file_risk_score" INTEGER NOT NULL,
      "complexity_score" INTEGER NOT NULL,
      "onboarding_readiness" INTEGER NOT NULL,
      "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "codebase_health_scores_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "codebase_health_scores_project_id_key" UNIQUE ("project_id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "onboarding_guides" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "content" JSONB NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "onboarding_guides_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "onboarding_guides_project_id_idx" ON "onboarding_guides"("project_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "commit_insights" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "commit_hash" TEXT NOT NULL,
      "why" TEXT NOT NULL,
      "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "commit_insights_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "commit_insights_project_id_commit_hash_key" UNIQUE ("project_id", "commit_hash")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "commit_insights_project_id_idx" ON "commit_insights"("project_id")`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pull_requests" (
      "id" TEXT NOT NULL,
      "project_id" TEXT NOT NULL,
      "github_pr_id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT,
      "state" TEXT NOT NULL,
      "author" TEXT NOT NULL,
      "author_email" TEXT,
      "base_branch" TEXT NOT NULL,
      "head_branch" TEXT NOT NULL,
      "files_changed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "reviewers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "merged_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "pull_requests_project_id_github_pr_id_key" UNIQUE ("project_id", "github_pr_id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pull_requests_project_id_idx" ON "pull_requests"("project_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pull_requests_state_idx" ON "pull_requests"("state")`);

  console.log('All missing tables created successfully');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
