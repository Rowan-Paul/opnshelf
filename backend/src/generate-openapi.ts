import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createOpenApiDocument } from "./openapi";

const outputPath = resolve(__dirname, "../openapi.json");

async function generateOpenApi() {
	const app = await NestFactory.create(AppModule, { logger: false });

	try {
		const document = createOpenApiDocument(app);
		await writeFile(
			outputPath,
			`${JSON.stringify(document, null, 2)}\n`,
			"utf8",
		);
	} finally {
		await app.close();
	}
}

generateOpenApi().catch((error: unknown) => {
	console.error("Failed to generate OpenAPI document", error);
	process.exitCode = 1;
});
