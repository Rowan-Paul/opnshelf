import type { ReleaseNote } from "@opnshelf/api";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReleaseNotePrompt } from "./release-note-prompt";

const state = vi.hoisted(() => ({ data: [] as ReleaseNote[] }));

vi.mock("expo-router", () => ({ Link: "Link" }));
vi.mock("expo-secure-store", () => ({ getItemAsync: async () => null }));
vi.mock("lucide-react-native", () => ({ Sparkles: "Sparkles" }));
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("@/components/home/prompt-slot", () => ({
	PromptCard: ({ actions, ...props }: { actions: ReactNode }) =>
		createElement("PromptCard", props, actions),
	PromptSlotItem: "PromptSlotItem",
	usePromptCooldown: () => vi.fn(),
}));
vi.mock("@/components/ui/button", () => ({ Button: "Button" }));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "did:plc:synthetic" } }),
}));
vi.mock("@/lib/use-release-notes", () => ({
	useReleaseNotes: () => ({
		data: state.data,
		unread: true,
		isPending: false,
		readPending: false,
	}),
}));

function note(slug: string, publishedAt: string): ReleaseNote {
	return {
		slug,
		title: `Release ${slug}`,
		summary: "Synthetic release summary",
		markdown: "Synthetic release body",
		publishedAt,
		platforms: {
			web: { status: "available" },
			ios: { status: "available" },
			android: { status: "available" },
		},
	};
}

// This is the announcement shipped with this bundle, not the newest server note.
const installed = note(
	"a-more-consistent-opnshelf",
	"2026-10-26T20:00:00.000Z",
);
let renderer: ReactTestRenderer;
afterEach(async () => {
	await act(async () => renderer?.unmount());
});

describe("installed Mobile release announcement", () => {
	it.each([
		{ label: "installed release", entries: [installed], visible: true },
		{
			label: "newer server release even when the installed note is in the feed",
			entries: [
				note("future-mobile-update", "2026-10-28T20:00:00.000Z"),
				installed,
			],
			visible: false,
		},
		{
			label: "older server release",
			entries: [note("older-mobile-update", "2026-10-25T20:00:00.000Z")],
			visible: false,
		},
	])("only announces the installed bundle: $label", async ({
		entries,
		visible,
	}) => {
		state.data = entries;
		await act(async () => {
			renderer = create(<ReleaseNotePrompt />);
		});
		const cards = renderer.root.findAllByType("PromptCard" as never);
		expect(cards).toHaveLength(visible ? 1 : 0);
		if (visible) {
			expect(cards[0].props.title).toBe(installed.title);

			expect(renderer.root.findByType("Link" as never).props.href).toEqual({
				pathname: "/whats-new/[slug]",
				params: { slug: installed.slug },
			});
		}
	});
});
