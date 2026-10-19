import { describe, expect, it } from "vitest";
import { average, masteryToLevel, normalizeScore, scoreToLevel, updateMastery } from "~/lib/grading";

describe("normalizeScore", () => {
  it.each([
    [85, 85],
    [92.46, 92.5],
    ["85分", 85],
    ["85%", 85],
    ["18/20", 90],
    [" 7 / 8 ", 87.5],
    ["A", 95],
    ["b+", 88],
    ["优秀", 95],
    ["不及格", 50],
  ])("converts %j to %j", (raw, expected) => {
    expect(normalizeScore(raw)).toBe(expected);
  });

  it.each([[null], [undefined], [-1], [101], ["120"], ["5/0"], ["很好"], [""], [{}], [Number.NaN]])(
    "returns null for %j",
    (raw) => {
      expect(normalizeScore(raw)).toBeNull();
    },
  );
});

describe("scoreToLevel", () => {
  it("uses 90/80/70/60 boundaries", () => {
    expect([95, 90, 85, 75, 65, 59].map(scoreToLevel)).toEqual([
      "excellent",
      "excellent",
      "good",
      "fair",
      "pass",
      "fail",
    ]);
  });
});

describe("updateMastery", () => {
  it("starts from 0.5 and moves towards 1 when the area was answered correctly", () => {
    expect(updateMastery(undefined, 0)).toBe(0.6);
    expect(updateMastery(0.9, 0)).toBe(0.92);
  });

  it("decays once per mistake", () => {
    expect(updateMastery(0.5, 1)).toBe(0.4);
    expect(updateMastery(0.5, 3)).toBe(0.256);
  });

  it("clamps out-of-range previous values", () => {
    expect(updateMastery(7, 0)).toBe(1);
    expect(updateMastery(-3, 2)).toBe(0);
  });
});

describe("masteryToLevel / average", () => {
  it("maps mastery to levels", () => {
    expect([0.85, 0.8, 0.7, 0.6, 0.3].map(masteryToLevel)).toEqual([
      "advanced",
      "advanced",
      "intermediate",
      "intermediate",
      "beginner",
    ]);
  });

  it("ignores missing values when averaging", () => {
    expect(average([80, null, undefined, 90])).toBe(85);
    expect(average([null])).toBeNull();
  });
});
