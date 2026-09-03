import { OUTCOME_HORIZONS, OUTCOME_STATUSES, type OutcomeStatusValue } from "./outcomes";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEFAULT_READ_LIMIT = 50;
const MAX_READ_LIMIT = 200;
const DEFAULT_EVALUATION_LIMIT = 20;
const MAX_EVALUATION_LIMIT = 30;

type ValidationResult<T> = { value: T; error?: never } | { value?: never; error: string };

function integerParam(raw: string | null, fallback: number, maximum: number, name: string): ValidationResult<number> {
  if (raw === null) return { value: fallback };
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) return { error: `${name} must be an integer from 1 to ${maximum}.` };
  return { value };
}

export type OutcomesQuery = {
  tokenAddress?: string;
  horizonMinutes?: number;
  status?: OutcomeStatusValue;
  limit: number;
};

export function parseOutcomesQuery(params: URLSearchParams): ValidationResult<OutcomesQuery> {
  const tokenAddress = params.get("tokenAddress")?.trim() || undefined;
  if (tokenAddress && !SOLANA_ADDRESS.test(tokenAddress)) return { error: "tokenAddress must be a valid Solana address." };

  const horizonRaw = params.get("horizonMinutes");
  const horizonMinutes = horizonRaw === null ? undefined : Number(horizonRaw);
  if (horizonMinutes !== undefined && !OUTCOME_HORIZONS.includes(horizonMinutes as (typeof OUTCOME_HORIZONS)[number])) {
    return { error: `horizonMinutes must be one of ${OUTCOME_HORIZONS.join(", ")}.` };
  }

  const statusRaw = params.get("status")?.toUpperCase();
  if (statusRaw && !OUTCOME_STATUSES.includes(statusRaw as OutcomeStatusValue)) {
    return { error: `status must be one of ${OUTCOME_STATUSES.join(", ")}.` };
  }

  const limit = integerParam(params.get("limit"), DEFAULT_READ_LIMIT, MAX_READ_LIMIT, "limit");
  if (limit.error) return { error: limit.error };
  return { value: { tokenAddress, horizonMinutes, status: statusRaw as OutcomeStatusValue | undefined, limit: limit.value } };
}

export function parseEvaluationLimit(params: URLSearchParams): ValidationResult<number> {
  return integerParam(params.get("limit"), DEFAULT_EVALUATION_LIMIT, MAX_EVALUATION_LIMIT, "limit");
}
