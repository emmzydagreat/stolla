"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmm";
import type { Community, CommunityRegistry } from "@/lib/community/types";
import { useRegistryCommunity } from "@/lib/community/useRegistryCommunity";
import {
  useCommunityProposal,
  type ProposalReaderFactory,
} from "@/lib/communities/proposals";
import {
  ProposalState,
  communityGovernorAbi,
} from "@/lib/bindings/community-governor/src";
import { CommunityBreadcrumbs } from "./CommunityBreadcrumbs";
import { CommunityNotFound } from "./CommunityNotFound";
import { AsyncState } from "@/components/ui/AsyncState";
import { ErrorState } from "@/components/ui/ErrorState";

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

const CANCELLABLE_STATES: ProposalState[] = [
  ProposalState.Pending,
  ProposalState.Active,
];

export type CommunityProposalDetailViewProps = {
  communityId: string;
  proposalId: string;
  registry?: CommunityRegistry;
  getReader?: ProposalReaderFactory;
};

export function CommunityProposalDetailView({
  communityId,
  proposalId,
  registry,
  getReader,
}: CommunityProposalDetailViewProps) {
  const resolution = useRegistryCommunity(communityId, registry);

  if (resolution.status === "loading") {
    return <p className="p-6 text-sm text-slate-400">Loading community…</p>;
  }
  if (resolution.status === "error") {
    return (
      <p role="alert" className="p-6 text-sm text-rose-300">
        {resolution.error}
      </p>
    );
  }
  if (resolution.result.status !== "found") {
    return <CommunityNotFound communityId={communityId} />;
  }

  const community = resolution.result.community;

  return (
    <CommunityProposalDetailPanel
      community={community}
      proposalId={proposalId}
      getReader={getReader}
    />
  );
}

function CommunityProposalDetailPanel({
  community,
  proposalId,
  getReader,
}: {
  community: Community;
  proposalId: string;
  getReader?: ProposalReaderFactory;
}) {
  const resolution = useCommunityProposal(
    community.record.governorContract,
    proposalId,
    getReader,
  );

  const { address } = useAccount();
  const chainId = useChainId();
  const expectedChainId = community.record.chainId;
  const wrongNetwork =
    typeof expectedChainId === "number" && chainId !== expectedChainId;

  const {
    writeContract,
    data: txHash,
    isPending: signPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const {
    isLoading: confirmLoading,
    isSuccess: confirmSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ confirmations: 1 });

  const [actionError, setActionError] = useState<string | null>(null);

  const state = resolution.status === "ready" ? resolution.state : null;
  const proposer =
    resolution.status === "ready" ? resolution.proposer : undefined;

  const isProposer =
    Boolean(address) &&
    Boolean(proposer) &&
    address!.toLowerCase() === proposer!.toLowerCase();

  const cancellable = state !== null && CANCELLABLE_STATES.includes(state);
  const executable = state === ProposalState.Succeeded;

  const showCancel = cancellable && isProposer;
  const showExecute = executable;

  const txPending = signPending || confirmLoading;
  const disabled =
    txPending || !address || wrongNetwork;

  const explorerUrl = useMemo(() => {
    if (!txHash) return null;
    const base = community.record.explorerBaseUrl;
    if (!base) return null;
    return `${base.replace(/\/$/, "")}/tx/${txHash}`;
  }, [community.record.explorerBaseUrl, txHash]);

  const handleCancel = () => {
    setActionError(null);
    resetWrite();
    writeContract({
      address: community.record.governorContract as `0xd{40}`,
      abi: communityGovernorAbi,
      functionName: "cancel",
      args: [BigInt(proposalId)],
    });
  };

  const handleExecute = () => {
    setActionError(null);
    resetWrite();
    writeContract({
      address: community.record.governorContract as `0xd{40}`,
      abi: communityGovernorAbi,
      functionName: "execute",
      args: [BigInt(proposalId)],
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CommunityBreadcrumbs
        communityId={community.record.id}
        communityName={community.metadata?.name ?? community.record.id}
        proposalId={proposalId}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-100">
        Proposal #{proposalId}
      </h1>

      {resolution.status === "loading" && (
        <AsyncState className="mt-6 text-sm text-slate-500">
          Loading proposal…</AsyncState>
      )}
      {resolution.status === "error" && (
        <ErrorState className="mt-6" title="Proposal unavailable">
          {resolution.error}
        </ErrorState>
      )
      {resolution.status === "ready" && (
        <>
          <dl className="mt-6 grid gap-3 rounded-xl border border-slate-800 bg-[#151b2b] p-5 text-sm sm:grid-cols[-2]">
            <div>
              <dt className="text-slate-500">State</dt>
              <dd className="font-medium text-slate-100">
                {stateLabels[resolution.state]}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Community</dt>
              <dd className="font-medium text-slate-100">
                {community.metadata?.name ?? community.record.id}
              </dd>
            </div>
          </dl>

          {!address && (showCancel || showExecute) && (
            <p className="mt-4 text-sm text-slate-400">
              Connect your wallet to act on this proposal.
            </p>
          )}
          {address && wrongNetwork && (showCancel || showExecute) && (
            <p className="mt-4 text-sm text-amber-300">
              Switch networks to continue.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {showCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={disabled}
                className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 disabled:opacity-50"
              >
                {txPending ? "Canceling…" : "Cancel"}
              </button>
            )}
            {showExecute && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={disabled}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-50"
              >
                {txPending ? "Executing…" : "Execute"}
              </button>
            )}
          </div>

          {txPending && (
            <p className="mt-3 text-sm text-slate-400">
              {signPending
                ? "Awaiting wallet confirmation…"
                : "Waiting for confirmation…"}
            </p>
          )}
          {confirmSuccess && (
            <p className="mt-3 text-sm text-emerald-300">
              Transaction confirmed.
              {explorerUrl && (
                <>
                  {" "}
                  <a href={explorerUrl} target="_blank" rel="noreferrer noopener" className="underline">
                    View on explorer
                  </a>
                </a>
              )}
            </p>
          )}
          {(writeError || confirmError || actionError) && (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              {actionError ?? writeError?.message ?? confirmError?.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
