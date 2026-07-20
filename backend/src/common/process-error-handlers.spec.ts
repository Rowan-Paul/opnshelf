import { describe, expect, it, vi } from "vitest";
import {
	createProcessErrorHandlers,
	installProcessErrorHandlers,
} from "./process-error-handlers";

describe("process error handlers", () => {
	it("logs an uncaught Error before exiting with code 1", () => {
		const calls: string[] = [];
		const logger = {
			error: vi.fn(() => calls.push("log")),
		};
		const exit = vi.fn(() => {
			calls.push("exit");
		});
		const handlers = createProcessErrorHandlers(logger, exit);
		const error = new Error("boom");

		handlers.uncaughtException(error);

		expect(logger.error).toHaveBeenCalledWith(
			"Uncaught exception",
			error.stack,
		);
		expect(exit).toHaveBeenCalledWith(1);
		expect(calls).toEqual(["log", "exit"]);
	});

	it("safely logs a non-Error uncaught value before exiting", () => {
		const logger = { error: vi.fn() };
		const exit = vi.fn();
		const handlers = createProcessErrorHandlers(logger, exit);
		const unprintable = Object.create(null);

		handlers.uncaughtException(unprintable);

		expect(logger.error).toHaveBeenCalledWith(
			"Uncaught exception",
			"[unprintable value]",
		);
		expect(exit).toHaveBeenCalledWith(1);
	});

	it("logs an unhandled rejection without exiting", () => {
		const logger = { error: vi.fn() };
		const exit = vi.fn();
		const handlers = createProcessErrorHandlers(logger, exit);

		handlers.unhandledRejection("rejected");

		expect(logger.error).toHaveBeenCalledWith(
			"Unhandled promise rejection",
			"rejected",
		);
		expect(exit).not.toHaveBeenCalled();
	});

	it("returns cleanup that removes exactly the installed listeners", () => {
		const logger = { error: vi.fn() };
		const on = vi.fn();
		const off = vi.fn();

		const cleanup = installProcessErrorHandlers(logger, vi.fn(), {
			on,
			off,
		} as unknown as NodeJS.Process);

		expect(on).toHaveBeenCalledTimes(2);
		cleanup();
		expect(off).toHaveBeenCalledTimes(2);
		expect(off.mock.calls).toEqual([
			["uncaughtException", on.mock.calls[0]?.[1]],
			["unhandledRejection", on.mock.calls[1]?.[1]],
		]);
	});
});
