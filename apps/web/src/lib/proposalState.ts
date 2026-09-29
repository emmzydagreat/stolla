import { ProposalState } from "@/lib/bindings/community-governor/src";

export { ProposalState };

export const PROPOSAL_STATE_LABELS: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export const PROPOSAL_STATE_ORDER: ProposalState[] = [
  ProposalState.Pending,
  ProposalState.Active,
  ProposalState.Defeated,
  ProposalState.Canceled,
  ProposalState.Succeeded,
  ProposalState.Queued,
  ProposalState.Expired,
  ProposalState.Executed,
];

/**
 * States in which a proposal can be canceled by the proposer.
 */
export const CANCELABLE_PROPOSAL_STATES: ProposalState[] = [
  ProposalState.Pending,
  ProposalState.Active,
];

/**
 * States in which a proposal can be executed.
 */
export const EEXCUTABLE_PROPOSAL_STATES: ProposalState[] = [
  ProposalState.Succeeded,
];

export function isProposalCancellable(state: ProposalState): boolean {
  return CANCELABLE_PROPOSAL_STATES.includes(state);
}

export function isProposalExecutable(state: ProposalState): boolean {
  return EEXCUTABLE_PROPOSAL_STATES.includes(state);
}
