import type { Logger } from "@nestjs/common";

type ProcessLogger = Pick<Logger, "error">;
type Exit = (code: number) => void;
type ProcessEvents = Pick<NodeJS.Process, "on" | "off">;

export interface ProcessErrorHandlers {
	uncaughtException: (error: unknown) => void;
	unhandledRejection: (reason: unknown) => void;
}

function describe(reason: unknown): string {
	if (reason instanceof Error) {
		return reason.stack ?? reason.message;
	}

	try {
		return String(reason);
	} catch {
		return "[unprintable value]";
	}
}

export function createProcessErrorHandlers(
	logger: ProcessLogger,
	exit: Exit = (code) => process.exit(code),
): ProcessErrorHandlers {
	return {
		uncaughtException(error) {
			logger.error("Uncaught exception", describe(error));
			exit(1);
		},
		unhandledRejection(reason) {
			logger.error("Unhandled promise rejection", describe(reason));
		},
	};
}

/**
 * Installs one owned pair of process listeners and returns a cleanup callback.
 * The application calls this once; tests and hot-reload callers must invoke the
 * cleanup callback before installing another pair.
 */
export function installProcessErrorHandlers(
	logger: ProcessLogger,
	exit?: Exit,
	events: ProcessEvents = process,
): () => void {
	const handlers = createProcessErrorHandlers(logger, exit);
	events.on("uncaughtException", handlers.uncaughtException);
	events.on("unhandledRejection", handlers.unhandledRejection);

	return () => {
		events.off("uncaughtException", handlers.uncaughtException);
		events.off("unhandledRejection", handlers.unhandledRejection);
	};
}
