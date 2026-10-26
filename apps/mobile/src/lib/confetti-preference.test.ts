import { beforeEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
	getItemAsync: vi.fn(),
	setItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => storage);
beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
});
it("loads the saved opt-out and persists changes for the renderer", async () => {
	storage.getItemAsync.mockResolvedValue("false");
	storage.setItemAsync.mockResolvedValue(undefined);
	const preference = await import("./confetti-preference");
	expect(await preference.isConfettiEnabled()).toBe(false);
	await preference.setConfettiEnabled(true);
	expect(storage.setItemAsync).toHaveBeenCalledWith(
		"completion_confetti",
		"true",
	);
	expect(await preference.isConfettiEnabled()).toBe(true);
});
it("preserves the current choice if saving fails", async () => {
	storage.getItemAsync.mockResolvedValue("false");
	storage.setItemAsync.mockRejectedValue(new Error("storage full"));
	const preference = await import("./confetti-preference");
	await expect(preference.setConfettiEnabled(true)).rejects.toThrow(
		"storage full",
	);
	expect(await preference.isConfettiEnabled()).toBe(false);
});
it("defaults to enabled when there is no saved choice", async () => {
	storage.getItemAsync.mockResolvedValue(null);
	const preference = await import("./confetti-preference");
	expect(await preference.isConfettiEnabled()).toBe(true);
});
