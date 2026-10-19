-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Analysis lifecycle on submissions
ALTER TABLE "assignments"
  ADD COLUMN "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "analysisError" TEXT,
  ADD COLUMN "analysisStartedAt" TIMESTAMP(3);

ALTER TABLE "exams"
  ADD COLUMN "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "analysisError" TEXT,
  ADD COLUMN "analysisStartedAt" TIMESTAMP(3);

UPDATE "assignments" a SET "analysisStatus" = 'completed'
WHERE EXISTS (SELECT 1 FROM "assignment_analyses" x WHERE x."assignmentId" = a."id");

UPDATE "exams" e SET "analysisStatus" = 'completed'
WHERE EXISTS (SELECT 1 FROM "exam_analyses" x WHERE x."examId" = e."id");

-- Numeric score (0-100) is the single source of truth; "grade" keeps the raw text
ALTER TABLE "assignment_analyses" ADD COLUMN "score" DOUBLE PRECISION;
ALTER TABLE "exam_analyses" ADD COLUMN "score" DOUBLE PRECISION;

-- Mapping must stay in sync with normalizeScore() in src/lib/grading.ts
CREATE FUNCTION pg_temp.grade_to_score(raw TEXT) RETURNS DOUBLE PRECISION AS $$
DECLARE
  g TEXT := upper(btrim(coalesce(raw, '')));
  num DOUBLE PRECISION;
  den DOUBLE PRECISION;
BEGIN
  IF g = '' THEN RETURN NULL; END IF;
  CASE g
    WHEN 'A+' THEN RETURN 98; WHEN 'A' THEN RETURN 95; WHEN 'A-' THEN RETURN 92;
    WHEN 'B+' THEN RETURN 88; WHEN 'B' THEN RETURN 85; WHEN 'B-' THEN RETURN 82;
    WHEN 'C+' THEN RETURN 78; WHEN 'C' THEN RETURN 75; WHEN 'C-' THEN RETURN 72;
    WHEN 'D+' THEN RETURN 68; WHEN 'D' THEN RETURN 65; WHEN 'D-' THEN RETURN 62;
    WHEN 'E' THEN RETURN 50; WHEN 'F' THEN RETURN 50;
    WHEN '优秀' THEN RETURN 95; WHEN '优' THEN RETURN 95;
    WHEN '良好' THEN RETURN 85; WHEN '良' THEN RETURN 85;
    WHEN '中等' THEN RETURN 75; WHEN '中' THEN RETURN 75;
    WHEN '及格' THEN RETURN 65; WHEN '合格' THEN RETURN 65;
    WHEN '不及格' THEN RETURN 50; WHEN '不合格' THEN RETURN 50; WHEN '待提高' THEN RETURN 50;
    ELSE NULL;
  END CASE;

  IF g ~ '^\d+(\.\d+)?\s*/\s*\d+(\.\d+)?$' THEN
    num := btrim(split_part(g, '/', 1))::DOUBLE PRECISION;
    den := btrim(split_part(g, '/', 2))::DOUBLE PRECISION;
    IF den <= 0 THEN RETURN NULL; END IF;
    RETURN round(LEAST(100, GREATEST(0, num / den * 100))::NUMERIC, 1);
  END IF;

  IF g ~ '^\d+(\.\d+)?\s*(分|%)?$' THEN
    num := substring(g FROM '^\d+(?:\.\d+)?')::DOUBLE PRECISION;
    IF num > 100 THEN RETURN NULL; END IF;
    RETURN num;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "assignment_analyses" SET "score" = pg_temp.grade_to_score("grade");
UPDATE "exam_analyses" SET "score" = pg_temp.grade_to_score("grade");

-- Knowledge mastery: 0-1 float instead of a free-form string
ALTER TABLE "student_knowledge_areas"
  ADD COLUMN "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "student_knowledge_areas" SET
  "mastery" = CASE
    WHEN "proficiencyLevel" = 'advanced' THEN 0.85
    WHEN "proficiencyLevel" = 'intermediate' THEN 0.65
    WHEN "proficiencyLevel" = 'beginner' THEN 0.35
    WHEN "proficiencyLevel" ~ '^\d+(\.\d+)?$' THEN LEAST(1, GREATEST(0, "proficiencyLevel"::DOUBLE PRECISION))
    ELSE 0.5
  END,
  "evidenceCount" = CASE WHEN "proficiencyLevel" IS NULL THEN 0 ELSE 1 END;

ALTER TABLE "student_knowledge_areas" DROP COLUMN "proficiencyLevel";
