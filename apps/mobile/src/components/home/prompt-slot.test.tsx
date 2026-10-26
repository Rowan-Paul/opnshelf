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

const appState = vi.hoisted(() => ({
	listeners: new Set<(state: string) => void>(),
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		AppState: {
			addEventListener: (_: string, listener: (state: string) => void) => {
				appState.listeners.add(listener);
				return { remove: () => appState.listeners.delete(listener) };
			},
		},
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

beforeEach(() => {
	store.clear();
	vi.useRealTimers();
});

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

	it("comes back once the cooldown ends, even if Home never unmounted", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
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

		await act(async () => {
			vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000 + 1);
		});
		expect(shown(renderer)).toEqual(["notification"]);
	});

	it("rechecks the cooldown when the app returns to the foreground", async () => {
		store.set("prompt-cooldown-until", String(Date.now() + 1000));
		const renderer = await render(
			<PromptSlotItem id="notification">
				<Card name="notification" />
			</PromptSlotItem>,
		);
		expect(shown(renderer)).toEqual([]);

		// Timers do not run while the app is suspended; the resume event does.
		store.set("prompt-cooldown-until", "0");
		vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2000);
		await act(async () => {
			for (const listener of appState.listeners) listener("active");
		});
		expect(shown(renderer)).toEqual(["notification"]);
	});

	it("reports an impression only when the card is actually on screen", async () => {
		const onShown = vi.fn();
		const renderer = await render(
			<>
				<PromptSlotItem id="release-note">
					<Card name="release-note" />
				</PromptSlotItem>
				<PromptSlotItem id="atstore-review" onShown={onShown}>
					<Card name="atstore-review" />
				</PromptSlotItem>
			</>,
		);
		expect(onShown).not.toHaveBeenCalled();

		await act(async () => {
			renderer.update(
				<PromptSlot>
					<PromptSlotItem id="atstore-review" onShown={onShown}>
						<Card name="atstore-review" />
					</PromptSlotItem>
				</PromptSlot>,
			);
		});
		expect(onShown).toHaveBeenCalledTimes(1);
	});
});
