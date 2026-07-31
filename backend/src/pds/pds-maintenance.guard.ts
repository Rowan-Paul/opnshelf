import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

export const PDS_MAINTENANCE_MESSAGE =
	"Account storage maintenance is in progress. Please try again shortly.";

/**
 * Blocks writes that can reach account storage while a PDS cutover is in
 * progress. Reads intentionally remain available.  The switch is an
 * environment variable so operators can enable it before touching PDS state
 * and disable it only after the migration smoke tests have passed.
 */
@Injectable()
export class PdsMaintenanceGuard implements CanActivate {
	constructor(private readonly config: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		if (!this.isEnabled()) return true;

		const http = context.switchToHttp();
		const request = http.getRequest<Request>();
		if (!this.isBlockedRequest(request)) return true;

		const response = http.getResponse<Response>();
		response.setHeader("Retry-After", this.retryAfterSeconds());
		throw new ServiceUnavailableException(PDS_MAINTENANCE_MESSAGE);
	}

	private isEnabled(): boolean {
		return ["1", "true", "yes", "on"].includes(
			(this.config.get<string>("PDS_MAINTENANCE_MODE") ?? "")
				.trim()
				.toLowerCase(),
		);
	}

	private retryAfterSeconds(): string {
		const configured = Number(
			this.config.get<string>("PDS_MAINTENANCE_RETRY_AFTER_SECONDS") ?? "300",
		);
		return String(
			Number.isFinite(configured) && configured > 0
				? Math.floor(configured)
				: 300,
		);
	}

	private isBlockedRequest(request: Request): boolean {
		// PDS record/account mutations use unsafe methods. This deliberately also
		// pauses application writes: allowing any user mutation during a PDS
		// migration risks a partial operation that cannot be reconciled on rollback.
		if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;

		// These OAuth routes begin or complete an authentication exchange. Keeping
		// them out of a maintenance window avoids sessions completing against a PDS
		// that is being moved. Public read routes are not affected.
		const path = request.path || request.url.split("?")[0];
		return ["/auth/login", "/auth/signup", "/auth/callback"].includes(path);
	}
}
