import { describe, it, expect } from "vitest";
import {
  pickStageFromProgress,
  type AnalysisJobView,
  STUCK_PENDING_MS,
  STUCK_RUNNING_MS,
} from "../analyze/job";

describe("pickStageFromProgress", () => {
  it("returns parsing under 30%", () => {
    expect(pickStageFromProgress(0)).toBe("parsing");
    expect(pickStageFromProgress(29)).toBe("parsing");
  });

  it("returns chunking 30-50%", () => {
    expect(pickStageFromProgress(30)).toBe("chunking");
    expect(pickStageFromProgress(49)).toBe("chunking");
  });

  it("returns analyzing 50-85%", () => {
    expect(pickStageFromProgress(50)).toBe("analyzing");
    expect(pickStageFromProgress(84)).toBe("analyzing");
  });

  it("returns synthesizing 85-95%", () => {
    expect(pickStageFromProgress(85)).toBe("synthesizing");
    expect(pickStageFromProgress(94)).toBe("synthesizing");
  });

  it("returns saving 95-100%", () => {
    expect(pickStageFromProgress(95)).toBe("saving");
    expect(pickStageFromProgress(100)).toBe("saving");
  });
});

describe("AnalysisJobView shape", () => {
  it("compiles with all expected fields", () => {
    const sample: AnalysisJobView = {
      analysisId: "a1",
      documentId: "d1",
      fileName: "test.docx",
      status: "RUNNING",
      stage: "analyzing",
      progress: 60,
      errorMessage: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    expect(sample.status).toBe("RUNNING");
  });
});

describe("stuck-job thresholds", () => {
  it("PENDING threshold is 30 seconds", () => {
    expect(STUCK_PENDING_MS).toBe(30_000);
  });
  it("RUNNING threshold is 30 minutes", () => {
    expect(STUCK_RUNNING_MS).toBe(30 * 60 * 1000);
  });
});
