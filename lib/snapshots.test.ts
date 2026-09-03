import { describe, expect, it } from "vitest";
import { snapshotBucket } from "./snapshots";

describe("snapshotBucket", () => {
  it("groups observations into five-minute intervals", () => {
    expect(snapshotBucket(new Date("2026-09-03T12:09:59.999Z")).toISOString()).toBe("2026-09-03T12:05:00.000Z");
    expect(snapshotBucket(new Date("2026-09-03T12:10:00.000Z")).toISOString()).toBe("2026-09-03T12:10:00.000Z");
  });
});
