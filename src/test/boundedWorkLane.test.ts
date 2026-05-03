import { describe, expect, it } from "vitest";

import {
  runBoundedWorkLane,
  type BoundedWorkLaneCandidate,
  type BoundedWorkLanePolicy,
} from "../runtime/boundedWorkLane";

type TestPriority = "urgent" | "normal" | "idle";

interface TestCandidate extends BoundedWorkLaneCandidate<TestPriority> {
  label: string;
}

const basePolicy: BoundedWorkLanePolicy = {
  batchSize: 8,
  maxConcurrentWork: 2,
  maxCandidateQueueDepth: 8,
  queueOverflowStrategy: "drop-lowest-priority",
  cancelStaleBatches: true,
};

function createCandidate(
  label: string,
  priority: TestPriority,
  sequence: number,
  overrides: Partial<TestCandidate> = {},
): TestCandidate {
  return {
    label,
    workKey: label,
    priority,
    priorityRank: priorityRank(priority),
    distanceFromFocus: sequence,
    sequence,
    ...overrides,
  };
}

describe("boundedWorkLane", () => {
  it("orders work by priority, distance, and original sequence", async () => {
    const candidates = [
      createCandidate("idle-near", "idle", 1, { distanceFromFocus: 0 }),
      createCandidate("urgent-far", "urgent", 2, { distanceFromFocus: 4 }),
      createCandidate("urgent-near", "urgent", 3, { distanceFromFocus: 1 }),
      createCandidate("normal", "normal", 4, { distanceFromFocus: 0 }),
    ];
    const executed: string[] = [];

    const result = await runBoundedWorkLane({
      candidates,
      policy: { ...basePolicy, maxConcurrentWork: 1 },
      runCandidate: async (candidate) => {
        executed.push(candidate.label);
        return candidate.label;
      },
    });

    expect(executed).toEqual([
      "urgent-near",
      "urgent-far",
      "normal",
      "idle-near",
    ]);
    expect(result.telemetry.priorityCounts).toEqual({
      urgent: 2,
      normal: 1,
      idle: 1,
    });
  });

  it("drops the lowest-priority candidates when capacity is exceeded", async () => {
    const candidates = [
      createCandidate("idle", "idle", 0),
      createCandidate("normal", "normal", 1),
      createCandidate("urgent-a", "urgent", 2),
      createCandidate("urgent-b", "urgent", 3),
    ];

    const result = await runBoundedWorkLane({
      candidates,
      policy: { ...basePolicy, maxCandidateQueueDepth: 2 },
      runCandidate: async (candidate) => candidate.label,
    });

    expect(result.scheduledCandidates.map((candidate) => candidate.label)).toEqual([
      "urgent-a",
      "urgent-b",
    ]);
    expect(result.droppedCandidates.map((candidate) => candidate.label)).toEqual([
      "normal",
      "idle",
    ]);
    expect(result.telemetry.queuedCount).toBe(2);
    expect(result.telemetry.droppedCount).toBe(2);
  });

  it("supports newest and oldest overflow strategies", async () => {
    const candidates = [
      createCandidate("first", "normal", 0),
      createCandidate("second", "normal", 1),
      createCandidate("third", "normal", 2),
    ];

    const dropNewestResult = await runBoundedWorkLane({
      candidates,
      policy: {
        ...basePolicy,
        maxCandidateQueueDepth: 2,
        queueOverflowStrategy: "drop-newest",
      },
      runCandidate: async (candidate) => candidate.label,
    });
    const dropOldestResult = await runBoundedWorkLane({
      candidates,
      policy: {
        ...basePolicy,
        maxCandidateQueueDepth: 2,
        queueOverflowStrategy: "drop-oldest",
      },
      runCandidate: async (candidate) => candidate.label,
    });

    expect(dropNewestResult.scheduledCandidates.map((candidate) => candidate.label)).toEqual([
      "first",
      "second",
    ]);
    expect(dropOldestResult.scheduledCandidates.map((candidate) => candidate.label)).toEqual([
      "second",
      "third",
    ]);
  });

  it("coalesces candidates by work key and keeps the strongest lane", async () => {
    const candidates = [
      createCandidate("low", "idle", 0, { workKey: "same" }),
      createCandidate("high", "urgent", 1, { workKey: "same" }),
      createCandidate("other", "normal", 2),
    ];

    const result = await runBoundedWorkLane({
      candidates,
      policy: basePolicy,
      runCandidate: async (candidate) => candidate.label,
    });

    expect(result.scheduledCandidates.map((candidate) => candidate.label)).toEqual([
      "high",
      "other",
    ]);
    expect(result.telemetry.coalescedCount).toBe(1);
  });

  it("cancels stale generations before committing completed work", async () => {
    const candidates = [
      createCandidate("first", "urgent", 0),
      createCandidate("second", "urgent", 1),
    ];
    let stale = false;
    let executedCount = 0;

    const result = await runBoundedWorkLane({
      candidates,
      policy: { ...basePolicy, maxConcurrentWork: 1 },
      isStale: () => stale,
      runCandidate: async () => {
        executedCount += 1;
        stale = true;
        return "value";
      },
    });

    expect(executedCount).toBe(1);
    expect(result.results).toEqual([]);
    expect(result.telemetry.cancelled).toBe(true);
    expect(result.telemetry.completedCount).toBe(0);
  });

  it("caps concurrent work and reports failed candidates", async () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      createCandidate(`candidate-${index}`, "normal", index),
    );
    let active = 0;
    let maxActive = 0;

    const result = await runBoundedWorkLane({
      candidates,
      policy: { ...basePolicy, batchSize: 6, maxConcurrentWork: 3 },
      runCandidate: async (candidate) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        if (candidate.label === "candidate-4") {
          throw new Error("boom");
        }
        return candidate.label;
      },
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(result.telemetry.maxConcurrentWork).toBe(3);
    expect(result.telemetry.scheduledCount).toBe(6);
    expect(result.telemetry.completedCount).toBe(6);
    expect(result.telemetry.failedCount).toBe(1);
    expect(result.results.find((item) => item.candidate.label === "candidate-4")?.status)
      .toBe("rejected");
  });
});

function priorityRank(priority: TestPriority): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "normal":
      return 1;
    case "idle":
      return 2;
  }
}
