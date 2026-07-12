import { runClaimFirstPipeline } from './claimFirstPipeline';
import { planExternalVerificationRequests } from './externalVerificationRequestPlanner';
import { executeExternalVerificationPlan } from './externalVerificationOrchestrator';
import type {
  ExternalVerificationOrchestrationResult,
  ExternalVerificationPlanningResult,
} from '../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type ExternalVerificationWorkflowResult = {
  plan: ReturnType<typeof runClaimFirstPipeline>['documentExternalVerificationPlan'];
  planning: ExternalVerificationPlanningResult;
  execution: ExternalVerificationOrchestrationResult | null;
};

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

  return { plan, planning, execution };
}
