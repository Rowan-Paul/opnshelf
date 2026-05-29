import { AtpAgent } from "@atproto/api";
import {
	Injectable,
	InternalServerErrorException,
	Logger,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Talks to our Tranquil PDS as an admin account.
 *
 * Tranquil's admin endpoints (com.atproto.server.createInviteCode, etc.) are
 * gated by `Auth<Admin>` — a normal account JWT whose user row has
 * `is_admin = true`. There is no separate admin password like the reference
 * PDS, so we log in with a dedicated admin account and reuse that session
 * (the underlying AtpAgent refreshes its own tokens).
 */
@Injectable()
export class TranquilAdminService implements OnModuleInit {
	private readonly logger = new Logger(TranquilAdminService.name);
	private readonly pdsUrl: string | undefined;
	private readonly identifier: string | undefined;
	private readonly password: string | undefined;

	private agent: AtpAgent | null = null;
	private loginPromise: Promise<AtpAgent> | null = null;

	constructor(private readonly config: ConfigService) {
		this.pdsUrl = this.config.get<string>("PDS_URL");
		this.identifier = this.config.get<string>("PDS_ADMIN_IDENTIFIER");
		this.password = this.config.get<string>("PDS_ADMIN_PASSWORD");
	}

	onModuleInit() {
		if (!this.pdsUrl || !this.identifier || !this.password) {
			this.logger.warn(
				"Tranquil admin not fully configured (need PDS_URL, PDS_ADMIN_IDENTIFIER, PDS_ADMIN_PASSWORD). Invite minting will fail.",
			);
		}
	}

	/**
	 * Mint a fresh invite code. Defaults to single-use so a leaked code is
	 * worthless after one signup.
	 */
	async mintInviteCode(useCount = 1): Promise<string> {
		const agent = await this.ensureLogin();
		try {
			const res = await agent.com.atproto.server.createInviteCode({ useCount });
			return res.data.code;
		} catch (error) {
			// The session may have gone stale; drop it and retry login once.
			if (this.isAuthError(error)) {
				this.logger.warn("Admin session rejected; re-authenticating");
				this.agent = null;
				const fresh = await this.ensureLogin();
				const res = await fresh.com.atproto.server.createInviteCode({
					useCount,
				});
				return res.data.code;
			}
			this.logger.error("Failed to mint invite code", error);
			throw new InternalServerErrorException("Could not create invite code");
		}
	}

	/**
	 * Revoke previously issued invite codes (e.g. clean up codes that were
	 * minted but never used, or abused).
	 */
	async disableInviteCodes(codes: string[]): Promise<void> {
		if (codes.length === 0) return;
		const agent = await this.ensureLogin();
		try {
			await agent.com.atproto.admin.disableInviteCodes({ codes });
		} catch (error) {
			this.logger.error("Failed to disable invite codes", error);
			throw new InternalServerErrorException("Could not disable invite codes");
		}
	}

	private async ensureLogin(): Promise<AtpAgent> {
		if (this.agent?.session) {
			return this.agent;
		}
		// De-dupe concurrent logins (e.g. burst of signups at boot).
		if (!this.loginPromise) {
			this.loginPromise = this.login().finally(() => {
				this.loginPromise = null;
			});
		}
		return this.loginPromise;
	}

	private async login(): Promise<AtpAgent> {
		if (!this.pdsUrl || !this.identifier || !this.password) {
			throw new InternalServerErrorException(
				"Tranquil admin credentials are not configured",
			);
		}
		const agent = new AtpAgent({ service: this.pdsUrl });
		await agent.login({
			identifier: this.identifier,
			password: this.password,
		});
		this.logger.log(`Admin authenticated as ${agent.session?.did}`);
		this.agent = agent;
		return agent;
	}

	private isAuthError(error: unknown): boolean {
		if (!error || typeof error !== "object") return false;
		const status = (error as { status?: number }).status;
		const name = (error as { error?: string }).error;
		return (
			status === 401 ||
			name === "ExpiredToken" ||
			name === "InvalidToken" ||
			name === "AuthenticationRequired"
		);
	}
}
