/**
 * 成绩与知识掌握度的统一口径。
 *
 * - 数据库只存数值：成绩 `score` 为 0-100，掌握度 `mastery` 为 0-1。
 * - 等级（优秀/良好…、初级/中级/熟练）只在展示层由本文件派生，不入库。
 */

const LETTER_GRADE_SCORES: Record<string, number> = {
  "A+": 98, A: 95, "A-": 92,
  "B+": 88, B: 85, "B-": 82,
  "C+": 78, C: 75, "C-": 72,
  "D+": 68, D: 65, "D-": 62,
  E: 50, F: 50,
  优秀: 95, 优: 95,
  良好: 85, 良: 85,
  中等: 75, 中: 75,
  及格: 65, 合格: 65,
  不及格: 50, 不合格: 50, 待提高: 50,
};

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

/**
 * 把 AI 或卷面上的成绩表达统一换算为 0-100 分。
 * 支持：数字、"85分"、"85%"、"18/20"、字母等级、中文等级。无法识别时返回 null。
 * 修改映射时需同步迁移 20261004120000_unify_score_and_mastery 中的 grade_to_score。
 */
export function normalizeScore(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) return null;
    return clampScore(raw);
  }

  if (typeof raw !== "string") return null;
  const text = raw.trim().toUpperCase();
  if (!text) return null;

  const mapped = LETTER_GRADE_SCORES[text];
  if (mapped !== undefined) return mapped;

  const ratio = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (ratio) {
    const earned = Number(ratio[1]);
    const total = Number(ratio[2]);
    if (!(total > 0)) return null;
    return clampScore((earned / total) * 100);
  }

  const plain = text.match(/^(\d+(?:\.\d+)?)\s*(?:分|%)?$/);
  if (plain) {
    const value = Number(plain[1]);
    return value > 100 ? null : clampScore(value);
  }

  return null;
}

export type ScoreLevel = "excellent" | "good" | "fair" | "pass" | "fail";

export function scoreToLevel(score: number): ScoreLevel {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  if (score >= 60) return "pass";
  return "fail";
}

export const SCORE_LEVEL_LABELS: Record<ScoreLevel, string> = {
  excellent: "优秀",
  good: "良好",
  fair: "中等",
  pass: "及格",
  fail: "待提高",
};

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return Number.isInteger(score) ? `${score}` : score.toFixed(1);
}

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

// ─── 知识点掌握度 ────────────────────────────────────────────────────

export const DEFAULT_MASTERY = 0.5;

/** 每条证据对掌握度的影响权重（指数滑动平均的学习率）。 */
const MASTERY_LEARNING_RATE = 0.2;

export type MasteryLevel = "beginner" | "intermediate" | "advanced";

export function masteryToLevel(mastery: number): MasteryLevel {
  if (mastery >= 0.8) return "advanced";
  if (mastery >= 0.6) return "intermediate";
  return "beginner";
}

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "熟练",
};

/**
 * 根据一次批改的结果更新掌握度（指数滑动平均）。
 * - 该知识点本次被考查且没有错误：向 1 靠近一步；
 * - 每出现一处错误：向 0 靠近一步。
 * 结果始终落在 [0, 1]，后续可替换为贝叶斯知识追踪 / IRT。
 */
export function updateMastery(previous: number | null | undefined, mistakeCount: number): number {
  const base =
    typeof previous === "number" && Number.isFinite(previous)
      ? Math.min(1, Math.max(0, previous))
      : DEFAULT_MASTERY;

  let next = base;
  if (mistakeCount <= 0) {
    next = base + MASTERY_LEARNING_RATE * (1 - base);
  } else {
    for (let i = 0; i < mistakeCount; i++) {
      next = next * (1 - MASTERY_LEARNING_RATE);
    }
  }
  return Math.round(next * 1000) / 1000;
}
