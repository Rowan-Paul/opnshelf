import type { PrivacyStatusDto } from "@opnshelf/api";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySection } from "./PrivacySection";

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	data: {} as PrivacyStatusDto,
}));
vi.mock("@opnshelf/api", () => ({
	authControllerPermissions: vi.fn(),
	usePrivacy: () => ({
		query: { data: mocks.data },
		mutation: { mutate: mocks.mutate, isPending: false },
		pendingKey: null,
	}),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "owner" } }),
}));
beforeEach(() => {
	mocks.mutate.mockReset();
	sessionStorage.clear();
	mocks.data = {
		availability: "available",
		authorized: true,
		listsDefaultVisibility: "public",
		alphaDetails: "Alpha protocol",
		scopes: [
			{
				category: "watches",
				label: "Watches",
				visibility: "public",
				listRkey: null,
				migration: null,
			},
			{
				category: "lists",
				label: "Favorites",
				visibility: "private",
				listRkey: "favorites",
				migration: null,
			},
		],
	};
});
describe("Privacy settings", () => {
	it("resumes a legacy combined onboarding choice after OAuth", () => {
		const action = {
			kind: "initial",
			body: { category: "watches", visibility: "private" },
		};
		sessionStorage.setItem(
			"opnshelf-privacy-choice",
			JSON.stringify({
				did: "owner",
				action,
				at: Date.now(),
				onboarding: true,
			}),
		);
		render(<PrivacySection onboarding />);
		expect(mocks.mutate).toHaveBeenCalledWith(action);
	});

	it("chooses Private directly without a separate connection control", () => {
		render(<PrivacySection />);
		fireEvent.click(
			within(screen.getByRole("group", { name: "Shelf visibility" })).getByRole(
				"button",
				{ name: "Private" },
			),
		);
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "change",
			body: { category: "watches", listRkey: undefined, visibility: "private" },
		});
		expect(screen.queryByText("Connect Watch access")).toBeNull();
	});
	it("requires explicit confirmation before publishing an existing List", () => {
		render(<PrivacySection />);
		fireEvent.click(
			screen.getByRole("button", { name: "Manage individual Lists" }),
		);
		fireEvent.click(
			within(
				screen.getByRole("group", { name: "Favorites visibility" }),
			).getByRole("button", { name: "Public" }),
		);
		expect(mocks.mutate).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));
		expect(screen.getByRole("dialog", { name: "Your Lists" })).toBeDefined();
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "change",
			body: {
				category: "lists",
				listRkey: "favorites",
				visibility: "public",
				publicationConfirmed: true,
			},
		});
	});
	it("keeps Lists compact and changes nothing until a scope is chosen", () => {
		render(<PrivacySection />);
		expect(screen.queryByText("Favorites")).toBeNull();
		expect(screen.queryByText("Learn more")).toBeNull();
		fireEvent.click(
			within(screen.getByRole("group", { name: "Lists visibility" })).getByRole(
				"button",
				{ name: "Private" },
			),
		);
		expect(mocks.mutate).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "New Lists only" }));
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "default",
			body: { category: "lists", visibility: "private" },
		});
	});
	it("confirms publication when applying Public to all Lists", () => {
		render(<PrivacySection />);
		fireEvent.click(
			within(screen.getByRole("group", { name: "Lists visibility" })).getByRole(
				"button",
				{ name: "Public" },
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "All Lists" }));
		expect(mocks.mutate).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));
		expect(screen.getByRole("dialog", { name: "Your Lists" })).toBeDefined();
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "allLists",
			body: {
				category: "lists",
				visibility: "public",
				publicationConfirmed: true,
			},
		});
	});
	it("cancels a Lists choice without writing", () => {
		render(<PrivacySection />);
		fireEvent.click(
			within(screen.getByRole("group", { name: "Lists visibility" })).getByRole(
				"button",
				{ name: "Private" },
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(mocks.mutate).not.toHaveBeenCalled();
	});

	it("explains List copy progress and distinguishes finishing from completion", () => {
		const list = mocks.data.scopes.find((scope) => scope.category === "lists");
		if (!list) throw new Error("Missing List");
		list.migration = {
			id: "move",
			target: "private",
			status: "queued",
			copied: 2,
			total: 2,
			error: null,
		};
		render(<PrivacySection />);
		expect(screen.getByRole("dialog", { name: "Your Lists" })).toBeDefined();
		expect(screen.getByText(/2\/2 records copied.*Finishing/)).toBeDefined();
		expect(
			screen.getByText(/Records include the List details and its items/),
		).toBeDefined();
	});

	it("leaves Public usable on unsupported PDSs", () => {
		mocks.data.availability = "unsupported";
		render(<PrivacySection />);
		expect(screen.getByText(/does not support Spaces yet/)).toBeDefined();
		const group = within(
			screen.getByRole("group", { name: "Shelf visibility" }),
		);
		expect(
			group.getByRole("button", { name: "Private" }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			group.getByRole("button", { name: "Public" }).hasAttribute("disabled"),
		).toBe(false);
	});
	it("starts onboarding with Public selected without writing a privacy change", () => {
		mocks.data.scopes = mocks.data.scopes.map((scope) => ({
			...scope,
			visibility: "public",
		}));
		const next = vi.fn();
		render(<PrivacySection onboarding onContinue={next} />);
		expect(
			within(screen.getByRole("group", { name: "Shelf visibility" }))
				.getByRole("button", { name: "Public" })
				.getAttribute("aria-pressed"),
		).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(next).toHaveBeenCalled();
		expect(mocks.mutate).not.toHaveBeenCalled();
	});
	it("shows category choices immediately during onboarding", () => {
		render(<PrivacySection onboarding onContinue={vi.fn()} />);
		expect(
			screen.getByRole("group", { name: "Shelf visibility" }),
		).toBeDefined();
		expect(
			screen.getByRole("group", { name: "Lists visibility" }),
		).toBeDefined();
		expect(screen.queryByText("Customize by category")).toBeNull();
		fireEvent.click(
			within(screen.getByRole("group", { name: "Shelf visibility" })).getByRole(
				"button",
				{ name: "Private" },
			),
		);
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "change",
			body: { category: "watches", listRkey: undefined, visibility: "private" },
		});
	});
	it("reopens List progress after a migration starts but allows dismissal during polling", () => {
		const { rerender } = render(<PrivacySection />);
		const list = mocks.data.scopes[1];
		mocks.data = {
			...mocks.data,
			scopes: [
				mocks.data.scopes[0],
				{
					...list,
					migration: {
						id: "move",
						target: "private",
						status: "running",
						copied: 0,
						total: 2,
						error: null,
					},
				},
			],
		};
		rerender(<PrivacySection />);
		expect(screen.getByRole("dialog", { name: "Your Lists" })).toBeDefined();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		mocks.data = { ...mocks.data, scopes: [...mocks.data.scopes] };
		rerender(<PrivacySection />);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByText(/Lists are changing visibility/)).toBeNull();
	});
});
