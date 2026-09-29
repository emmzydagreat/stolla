import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { CommunityProposalDetailView } from "@/components/community/CommunityProposalDetailView";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityRegistry,
} from "@/test/fixtures/communities";
import { createGovernorReaderFactory } from "@/test-support/stellar";

describe("CommunityProposalDetailView", () => {
  it("scopes an identical proposal id to the routed community's own Governor", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "2a": ProposalState.Active } },
      { contractId: beaconCommunity.record.governorContract, proposals: { "2a": ProposalState.Executed } },
    ]);

    const { unmount } = render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="2a"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );
    expect(await screen.findByText("Active")).toBeInTheDocument();
    unmount();

    render(
      <CommunityProposalDetailView
        communityId={beaconCommunity.record.id}
        proposalId="2a"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );
    expect(await screen.findByText("Executed")).toBeInTheDocument();
  });

  it("renders the canonical breadcrumb chain through to the proposal", async () => {
    const getReader = createGovernorReaderFactory([
      { contractId: atlasCommunity.record.governorContract, proposals: { "01": ProposalState.Pending } },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: atlasCommunity.metadata!.name })).toHaveAttribute(
      "href",
      `/community/${atlasCommunity.record.id}`,
    );
    expect(within(nav).getByText("Proposal #01")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("surfaces a proposal load failure without crashing the page", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": new Error("RPC simulation failed") },
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    expect(await screen.findByText("RPC simulation failed")).toBeInTheDocument();
    // Breadcrumb navigation must still be present even though the proposal failed.
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("produces not-found behavior for an unknown community id", async () => {
    const getReader = createGovernorReaderFactory([]);
    render(
      <CommunityProposalDetailView
        communityId="does-not-exist"
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
      />,
    );

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
  });

  it("hides Cancel from non-proposers while the proposal is cancellable", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Pending },
        proposer: "GANOTHIRPROPOSER",
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        connectedAddress="GNOTTHEPROPOSER"
      />,
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("shows Cancel to the proposer while the proposal is cancellable", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Pending },
        proposer: "GANOTHIRPROPOSER",
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        connectedAddress="GANOTHIRPROPOSER"
      />,
    );

    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows Execute for a succeeded proposal and refreshes to Executed after success", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Succeeded },
        executeResult: ProposalState.Executed,
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        connectedAddress="GNOTHIRPROPOSER"
      />,
    );

    expect(await screen.findByText("Succeeded")).toBeInTheDocument();
    const execute = screen.getByRole("button", { name: /execute/i });
    expect(execute).toBeEnabled();
    execute.click();
    expect(await screen.findByText("Executed")).toBeInTheDocument();
  });

  it("disables duplicate submits while a transaction is pending", async () => {
    const getReader = createGovernorReaderFactory([
      {
        contractId: atlasCommunity.record.governorContract,
        proposals: { "01": ProposalState.Succeeded },
        executeDelayMs: 50,
        executeResult: ProposalState.Executed,
      },
    ]);

    render(
      <CommunityProposalDetailView
        communityId={atlasCommunity.record.id}
        proposalId="01"
        registry={multiCommunityRegistry}
        getReader={getReader}
        connectedAddress="GNOTHIRPROPOSER"
      />,
    );

    expect(await screen.findByText("Succeeded")).toBeInTheDocument();
    const execute = screen.getByRole("button", { name: /execute/i });
    execute.click();
    expect(await screen.findByRole("button", { name: /execute/i })).toBeDisabled();
  });
});
