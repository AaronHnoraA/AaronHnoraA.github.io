import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import {
  leanDiagnosticPresentationForTest,
  leanDominantStatusForTest,
  leanProgressPresentationForTest,
} from "../src/cm6/widgets/lean-placeholder.ts";

describe("lean status presentation", () => {
  test("plain diagnostic severities map to ordinary status signs", () => {
    expect(leanDiagnosticPresentationForTest({ severity: 1, message: "bad" })).toEqual({
      decoration: "error",
      status: "error",
      title: "bad",
    });
    expect(leanDiagnosticPresentationForTest({ severity: 2, message: "careful" })).toMatchObject({
      decoration: "warning",
      status: "warning",
    });
    expect(leanDiagnosticPresentationForTest({ severity: 3, message: "note" })).toMatchObject({
      decoration: "info",
      status: "info",
    });
  });

  test("Lean goal tags override diagnostic severity for presentation", () => {
    expect(leanDiagnosticPresentationForTest({ severity: 1, leanTags: ["UnsolvedGoals"] })).toEqual({
      decoration: "incomplete",
      status: "incomplete",
      title: "Unsolved goals",
    });
    expect(leanDiagnosticPresentationForTest({ severity: 1, leanTags: [2] })).toEqual({
      decoration: "success",
      status: "success",
      title: "Goals accomplished",
    });
  });

  test("file progress statuses stay distinct from diagnostics", () => {
    expect(leanProgressPresentationForTest({})).toMatchObject({ status: "processing" });
    expect(leanProgressPresentationForTest({ kind: 1 })).toMatchObject({ status: "processing" });
    expect(leanProgressPresentationForTest({ kind: 2 })).toMatchObject({ status: "blocked" });
    expect(leanProgressPresentationForTest({ kind: 99 })).toBe(null);
  });

  test("status priority keeps real errors above incomplete goals", () => {
    expect(leanDominantStatusForTest(["processing", "info", "success", "warning"])).toBe("warning");
    expect(leanDominantStatusForTest(["warning", "incomplete"])).toBe("incomplete");
    expect(leanDominantStatusForTest(["incomplete", "blocked"])).toBe("blocked");
    expect(leanDominantStatusForTest(["incomplete", "error"])).toBe("error");
  });
});
