/**
 * Ledger time helpers for governance display (issue #262 N6.02, N6.06).
 *
 * Stellar closes ledgers ~every 5 seconds (ADR-006 confirms 5s for
 * MIN_DELAY_LEDGERS). We keep exact ledger counts authoritative and show
 * approximate human durations as supplemental info only.
 */

export const STELLAR_LEDGER_CLOSE_SECONDS = 5;

export const LEDGER_TIME_ASSUMPTION_NOTE =
  "assumes ~5s per ledger — ledgers are authoritative";

export function formatLedgerDuration(ledgers: number | null): string | null {
  if (ledgers === null || !Number.isSafeInteger(ledgers) || ledgers < 0) return null;
  if (ledgers === 0) return "~0s";
  const totalSeconds = ledgers * STELLAR_LEDGER_CLOSE_SECONDS;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds}s`);
  // Keep to at most 2 most significant parts for brevity.
  return `|~${parts.slice(0, 2).join(" ")}`;
}

export const GOVERNANCE_HELPERS: Record<string, string> = {
  proposalThreshold: "Votes needed to create a proposal (prevents spam).",
  quorum: "Votes needed for a proposal to pass once voting ends.",
  votingDelay: "Ledgers after creation before voting starts (time to review).",
  votingPeriod: "Voting window length — how long votes can be cast.",
};

/**
 * Proposal action availability for the community-scoped detail page.
 *
 * The current signaling Governor model exposes two mutating actions:
 *  - cancel: proposer-only, while the proposal is still cancellable.
 *  - execute: permissionless, once the proposal has succeeded.
 *
 * This keeps the visibility matrix in one place so the UI and tests can
 * agree on what should be shown.
 */

export type GovernanceProposalState =
  | "Pending"
  | "Active"
  | "Defeated"
  | "Succeeded"
  | "Canceled"
  | "Executed"
  | "Expired";

export interface GovernanceActionAvailability {
  /** Whether the current wallet may cancel the proposal. */
  canCancel: boolean;
  /** Whether the current wallet may execute the proposal. */
  canExecute: boolean;
  /** Explanation for why cancel is hidden, when it is. */
  cancelDisabledReason: string | null;
  /** Explanation for why execute is hidden, when it is. */
  executeDisabledReason: string | null;
}

/**
 * States in which a proposal can still be canceled by the proposer.
 * The Governor contract allows cancellation while the proposal has not yet
 * been executed or already canceled/defeated/expired.
 */
const CANCELLABLE_STATES: ReadonlySet<GovernanceProposalState> = new Set([
  "Pending",
  "Active",
  "Succeeded",
]);

export function isProposalCancellable(
  state: GovernanceProposalState,
): boolean {
  return CANCELLABLE_STATES.has(state);
}

export function isProposalExecutable(
  state: GovernanceProposalState,
): boolean {
  return state === "Succeeded";
}

export function getGovernanceActionAvailability(params: {
  state: GovernanceProposalState;
  /** Connected wallet address, or null when disconnected. */
  walletAddress?: string | null;
  /** Address that created the proposal. */
  proposerAddress?: string | null;
  /** Whether the wallet is on the expected network. */
  isCorrectNetwork?: boolean;
}): GovernanceActionAvailability {
  const {
    state,
    walletAddress = null,
    proposerAddress = null,
    isCorrectNetwork = true,
  } = params;

  const walletConnected = Boolean(walletAddress);
  const isProposer =
    walletConnected &&
    Boolean(proposerAddress) &&
    walletAddress === proposerAddress;

  const cancellable = isProposalCancellable(state);
  const executable = isProposalExecutable(state);

  const canCancel = cancellable && isProposer && isCorrectNetwork;
  const canExecute = executable && walletConnected && isCorrectNetwork;

  let cancelDisabledReason: string | null = null;
  if (!canCancel) {
    if (!cancellable) {
      cancelDisabledReason = `proposal is ${state.toLowerCase()}`;
    } else if (!walletConnected) {
      cancelDisabledReason = "wallet not connected";
    } else if (!isCorrectNetwork) {
      cancelDisabledReason = "wrong network";
    } else {
      cancelDisabledReason = "only the proposer may cancel";
    }
  }

  let executeDisabledReason: string | null = null;
  if (!canExecute) {
    if (!executable) {
      executeDisabledReason = `proposal is ${state.toLowerCase()}`;
    } else if (!walletConnected) {
      executeDisabledReason = "wallet not connected";
    } else {
      executeDisabledReason = "wrong network";
    }
  }

  return {
    canCancel,
    canExecute,
    cancelDisabledReason,
    executeDisabledReason,
  };
}
