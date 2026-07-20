import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication) {
	const config = new DocumentBuilder()
		.setTitle("Opnshelf API")
		.setDescription("Personal media tracker powered by AT Protocol")
		.setVersion("1.0")
		.addCookieAuth("session")
		.build();

	return SwaggerModule.createDocument(app, config);
}
