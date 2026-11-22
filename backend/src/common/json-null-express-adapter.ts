import { ExpressAdapter } from "@nestjs/platform-express";
import type { Response } from "express";

export class JsonNullExpressAdapter extends ExpressAdapter {
	override reply(response: Response, body: unknown, statusCode?: number) {
		if (body === null && (statusCode ?? response.statusCode) === 200) {
			return response.status(200).json(null);
		}

		return super.reply(response, body, statusCode);
	}
}
