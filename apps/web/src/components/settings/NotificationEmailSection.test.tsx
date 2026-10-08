import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationEmailSection } from "./NotificationEmailSection";

const mocks = vi.hoisted(() => ({
	settings: { email: "viewer@example.com", emailVerified: true },
	mutateAsync: vi.fn(),
}));
vi.mock("@opnshelf/api", () => ({
	notificationsControllerSettingsOptions: () => ({
		queryKey: ["notifications"],
	}),
	notificationsControllerConfirmEmailMutation: () => ({}),
	notificationsControllerRequestEmailMutation: () => ({}),
	notificationsControllerTestNotificationMutation: () => ({}),
	notificationsControllerUpdateSettingsMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.settings, isLoading: false, isError: false }),
	useMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
beforeEach(() => {
	mocks.settings = { email: "viewer@example.com", emailVerified: true };
	vi.clearAllMocks();
});

describe("onboarding email disclosure", () => {
	it("starts collapsed for verified email and lets users open and close options", () => {
		const { container } = render(<NotificationEmailSection onboarding />);
		const details = container.querySelector("details");
		expect(details?.open).toBe(false);
		// jsdom does not perform the browser's native summary activation.
		if (!details) throw new Error("Missing email disclosure");
		details.open = true;
		fireEvent(details, new Event("toggle"));
		expect(
			screen.getByRole("button", { name: "Send test email" }),
		).toBeDefined();
		details.open = false;
		fireEvent(details, new Event("toggle"));
		expect(details.open).toBe(false);
	});
	it("keeps setup open until verification, then collapses it without hiding categories", () => {
		mocks.settings.emailVerified = false;
		const { container, rerender } = render(
			<NotificationEmailSection onboarding />,
		);
		expect(container.querySelector("details")?.open).toBe(true);
		expect(
			screen.getByRole("textbox", { name: "Notification email address" }),
		).toBeDefined();
		mocks.settings = { ...mocks.settings, emailVerified: true };
		rerender(<NotificationEmailSection onboarding />);
		expect(container.querySelector("details")?.open).toBe(false);
		expect(screen.getAllByRole("switch")).toHaveLength(4);
	});
	it("keeps maintenance options open in Settings", () => {
		const { container } = render(<NotificationEmailSection />);
		expect(container.querySelector("details")?.open).toBe(true);
	});
});
