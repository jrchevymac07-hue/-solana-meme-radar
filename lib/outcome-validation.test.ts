import { describe, expect, it } from "vitest";
import { parseEvaluationLimit, parseOutcomesQuery } from "./outcome-validation";

const address = "So11111111111111111111111111111111111111112";

describe("outcomes query validation", () => {
  it("accepts supported filters and limits", () => {
    expect(parseOutcomesQuery(new URLSearchParams({ tokenAddress: address, horizonMinutes: "180", status: "winner", limit: "25" }))).toEqual({ value: { tokenAddress: address, horizonMinutes: 180, status: "WINNER", limit: 25 } });
  });
  it("rejects unsupported filters", () => {
    expect(parseOutcomesQuery(new URLSearchParams({ horizonMinutes: "120" })).error).toContain("horizonMinutes");
    expect(parseOutcomesQuery(new URLSearchParams({ status: "MOON" })).error).toContain("status");
    expect(parseOutcomesQuery(new URLSearchParams({ tokenAddress: "invalid" })).error).toContain("tokenAddress");
  });
});

describe("evaluation limit validation", () => {
  it("uses a safe default and enforces the maximum", () => {
    expect(parseEvaluationLimit(new URLSearchParams())).toEqual({ value: 20 });
    expect(parseEvaluationLimit(new URLSearchParams({ limit: "30" }))).toEqual({ value: 30 });
    expect(parseEvaluationLimit(new URLSearchParams({ limit: "31" })).error).toContain("1 to 30");
    expect(parseEvaluationLimit(new URLSearchParams({ limit: "nope" })).error).toContain("integer");
  });
});
