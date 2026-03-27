-- CreateTable
CREATE TABLE "project_runbooks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rollback_steps" TEXT,
    "hotfix_steps" TEXT,
    "env_vars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_runbooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_runbooks_project_id_key" ON "project_runbooks"("project_id");

-- CreateIndex
CREATE INDEX "project_runbooks_project_id_idx" ON "project_runbooks"("project_id");

-- AddForeignKey
ALTER TABLE "project_runbooks" ADD CONSTRAINT "project_runbooks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
