import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/http-exception.filter";

const isProduction = process.env.NODE_ENV === "production";

// Process-level crash handlers. Logged via the Nest Logger so output is
// consistent. We do NOT exit on unhandledRejection (just log it); for an
// uncaughtException we log first and then let Node take its default action.
const processLogger = new Logger("Process");
process.on("unhandledRejection", (reason) => {
	processLogger.error(
		"Unhandled promise rejection",
		reason instanceof Error ? reason.stack : String(reason),
	);
});
process.on("uncaughtException", (error) => {
	processLogger.error("Uncaught exception", error.stack ?? String(error));
	// Intentionally not calling process.exit — let Node crash as it normally
	// would once we've recorded the error.
});

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: isProduction
			? ["log", "error", "warn"]
			: ["log", "error", "warn", "debug", "verbose"],
		bufferLogs: false,
	});

	// Single proxy hop in front of us (Railway), so trust the first X-Forwarded-*
	// entry. This makes req.ip resolve to the real client address.
	app.set("trust proxy", 1);

	// Security headers. Defaults are fine; Swagger is gated to non-prod below.
	app.use(helmet());

	// Enable cookie parsing
	app.use(cookieParser());

	// CORS with credentials for cookie-based auth
	const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:3000";
	app.enableCors({
		origin: [frontendUrl, "http://127.0.0.1:3000", "http://127.0.0.1:8081"],
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	// Consistent JSON error shape + server-side logging, no stack-trace leaks.
	app.useGlobalFilters(new AllExceptionsFilter());

	// Swagger only outside production.
	if (!isProduction) {
		const config = new DocumentBuilder()
			.setTitle("Opnshelf API")
			.setDescription("Personal media tracker powered by AT Protocol")
			.setVersion("1.0")
			.addCookieAuth("session")
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup("api", app, document);
	}

	const port = Number(process.env.PORT ?? 3001);
	const host = "0.0.0.0";

	await app.listen(port, host);

	console.log(`🚀 API running on http://${host}:${port}`);
	if (!isProduction) {
		console.log(`📚 API docs at http://${host}:${port}/api`);
	}
}
void bootstrap();
