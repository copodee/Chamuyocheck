import { runClaimFirstPipeline } from './claimFirstPipeline';
import { planExternalVerificationRequests } from './externalVerificationRequestPlanner';
import { executeExternalVerificationPlan } from './externalVerificationOrchestrator';
import type {
  ExternalVerificationAttempt,
  ExternalVerificationOrchestrationResult,
  ExternalVerificationPlanningResult,
  ExternalVerificationSourceRecord,
} from '../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ExternalVerificationWorkflowResult = {
  plan: ReturnType<typeof runClaimFirstPipeline>['documentExternalVerificationPlan'];
  planning: ExternalVerificationPlanningResult;
  execution: ExternalVerificationOrchestrationResult | null;
  claims: ExternalVerificationClaimOutcome[];
};

export type ExternalVerificationClaimOutcome = {
  claimIndex: number;
  text: string;
  externalVerificationRequired: boolean;
  externalVerificationPerformed: boolean;
  status: 'not-required' | 'pending' | 'partial' | 'complete';
  records: ExternalVerificationSourceRecord[];
  pendingReasons: string[];
  attempts: ExternalVerificationAttempt[];
};

function buildClaimOutcomes(
  claims: ReturnType<typeof runClaimFirstPipeline>['claims'],
  planning: ExternalVerificationPlanningResult,
  execution: ExternalVerificationOrchestrationResult | null
): ExternalVerificationClaimOutcome[] {
  const covered = new Set(execution?.execution.coveredClaimIndexes || []);
  const pendingReasons = new Map<number, string[]>();
  for (const item of planning.pending) {
    pendingReasons.set(item.claimIndex, [...(pendingReasons.get(item.claimIndex) || []), item.reason]);
  }

  return claims.map((claim, claimIndex) => {
    const required = claim.externalVerificationRequired;
    const performed = required && covered.has(claimIndex);
    const records = (execution?.execution.records || []).filter((record) =>
      record.claimIndexes.includes(claimIndex)
    );
    const claimPendingReasons = pendingReasons.get(claimIndex) || [];
    const attempts = (execution?.attempts || []).filter((attempt) =>
      attempt.claimIndexes.includes(claimIndex)
    );
    const status = !required
      ? 'not-required'
      : performed
        ? 'complete'
        : execution && claimPendingReasons.length === 0
          ? 'partial'
          : 'pending';

    return {
      claimIndex,
      text: claim.text,
      externalVerificationRequired: required,
      externalVerificationPerformed: performed,
      status,
      records,
      pendingReasons: claimPendingReasons,
      attempts,
    };
  });
}

/**
 * End-to-end V21C workflow. Planning is local; network access happens only when
 * execute=true and only for explicit references accepted by the planner.
 */
export async function runExternalVerificationWorkflow(
  text: string,
  execute = false,
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationWorkflowResult> {
  const claimResult = runClaimFirstPipeline(text);
  const plan = claimResult.documentExternalVerificationPlan;
  const planning = planExternalVerificationRequests(claimResult.claims);
  const execution = execute
    ? await executeExternalVerificationPlan(plan, planning.requests, fetchImpl)
    : null;

  return {
    plan,
    planning,
    execution,
    claims: buildClaimOutcomes(claimResult.claims, planning, execution),
  };
}
