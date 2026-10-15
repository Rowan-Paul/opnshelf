import { render, screen } from "@testing-library/react";
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

describe("email setup", () => {
	it("shows verified email options directly during onboarding", () => {
		render(<NotificationEmailSection onboarding />);
		expect(screen.getByText("Sending to viewer@example.com")).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Send test email" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Use a different email" }),
		).toBeDefined();
	});
	it("shows setup before verification and keeps options visible after verification", () => {
		mocks.settings.emailVerified = false;
		const { rerender } = render(<NotificationEmailSection onboarding />);
		expect(
			screen.getByRole("textbox", { name: "Notification email address" }),
		).toBeDefined();
		mocks.settings = { ...mocks.settings, emailVerified: true };
		rerender(<NotificationEmailSection onboarding />);
		expect(
			screen.getByRole("button", { name: "Send test email" }),
		).toBeDefined();
		expect(screen.getAllByRole("switch")).toHaveLength(4);
	});
	it("keeps maintenance options visible in Settings", () => {
		render(<NotificationEmailSection />);
		expect(
			screen.getByRole("button", { name: "Send test email" }),
		).toBeDefined();
	});
});
