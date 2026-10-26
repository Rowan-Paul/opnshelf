import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptSlot, PromptSlotItem, usePromptCooldown } from "./prompt-slot";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
	getItemAsync: async (key: string) => store.get(key) ?? null,
	setItemAsync: async (key: string, value: string) => {
		store.set(key, value);
	},
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

function Card({ name }: { name: string }) {
	return createElement("card", { name });
}

function DismissButton() {
	const startCooldown = usePromptCooldown();
	return createElement("dismiss", { onPress: startCooldown });
}

function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

async function render(children: ReactNode) {
	let renderer!: ReactTestRenderer;
	await act(async () => {
		renderer = create(<PromptSlot>{children}</PromptSlot>);
	});
	return renderer;
}

const shown = (renderer: ReactTestRenderer) =>
	renderer.root
		.findAll((node) => hostType(node) === "card")
		.map((node) => node.props.name);

beforeEach(() => store.clear());

describe("PromptSlot", () => {
	it("shows only the highest-priority Prompt that has a card", async () => {
		// Rendered out of priority order on purpose: priority, not tree order, wins.
		const renderer = await render(
			<>
				<PromptSlotItem id="atstore-review">
					<Card name="atstore-review" />
				</PromptSlotItem>
				<PromptSlotItem id="notification">
					<Card name="notification" />
				</PromptSlotItem>
			</>,
		);
		expect(shown(renderer)).toEqual(["notification"]);
	});

	it("hands the slot to the next Prompt when the winner stops applying", async () => {
		const renderer = await render(
			<>
				<PromptSlotItem id="release-note">
					<Card name="release-note" />
				</PromptSlotItem>
				<PromptSlotItem id="notification">
					<Card name="notification" />
				</PromptSlotItem>
			</>,
		);
		expect(shown(renderer)).toEqual(["release-note"]);

		await act(async () => {
			renderer.update(
				<PromptSlot>
					<PromptSlotItem id="notification">
						<Card name="notification" />
					</PromptSlotItem>
				</PromptSlot>,
			);
		});
		expect(shown(renderer)).toEqual(["notification"]);
	});

	it("goes quiet for a few days after any dismissal", async () => {
		const renderer = await render(
			<>
				<PromptSlotItem id="notification">
					<Card name="notification" />
				</PromptSlotItem>
				<DismissButton />
			</>,
		);
		await act(async () => {
			renderer.root
				.find((node) => hostType(node) === "dismiss")
				.props.onPress();
		});
		expect(shown(renderer)).toEqual([]);

		// A fresh mount (next app launch) still honours the stored cooldown.
		const next = await render(
			<PromptSlotItem id="atstore-review">
				<Card name="atstore-review" />
			</PromptSlotItem>,
		);
		expect(shown(next)).toEqual([]);
	});
});
