import {
	BadRequestException,
	ConflictException,
	HttpException,
} from "@nestjs/common";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import { ZodError } from "zod";
import type { IntegrationConnection } from "../generated/client";
import { IntegrationError } from "./integration-error";
import {
	failingSince,
	IntegrationSyncService,
} from "./integration-sync.service";

export type OAuthToken = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
};
type OAuthClient<Token> = {
	readonly configured: boolean;
	readonly clientId: string;
	readonly callbackUrl: string;
	exchange(code: string, verifier: string): Promise<Token>;
	refresh(token: string): Promise<Token>;
	revoke(token: string): Promise<void>;
};
/** Shared encrypted credentials, PKCE state and account lifecycle for OAuth Integrations. */
export abstract class OAuthIntegrationSyncService<
	Credential,
	Token extends OAuthToken,
> extends IntegrationSyncService<Credential> {
	protected abstract readonly oauth: OAuthClient<Token>;
	protected abstract readonly authorizationEndpoint: string;
	protected get returnPath() {
		return `integrations/${this.provider}`;
	}
	protected get callbackQuery() {
		return "";
	}
	protected get connectionDefaults(): Partial<
		Pick<IntegrationConnection, "direction">
	> {
		return {};
	}
	protected authorizationParams(_state: string): Record<string, string> {
		return {};
	}
	protected abstract tokenExpiry(token: Token): Date;
	protected abstract oauthProfile(
		token: Token,
		state: string,
	): Promise<{ accountId: string; username: string }>;
	protected get configured() {
		return this.oauth.configured && Boolean(this.config.PROVIDER_STATE_SECRET);
	}
	protected crypt(value: string, decrypt = false) {
		if (!this.config.PROVIDER_STATE_SECRET)
			throw new BadRequestException(`${this.name} Sync is not configured.`);
		const key = createHash("sha256")
			.update(
				`opnshelf-${this.provider}-sync:${this.config.PROVIDER_STATE_SECRET}`,
			)
			.digest();
		if (decrypt) {
			const data = Buffer.from(value, "base64url");
			const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
			cipher.setAuthTag(data.subarray(12, 28));
			return Buffer.concat([
				cipher.update(data.subarray(28)),
				cipher.final(),
			]).toString();
		}
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", key, iv);
		const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
			"base64url",
		);
	}
	private tokenData(t: Token) {
		return {
			accessToken: this.crypt(t.access_token),
			refreshToken: this.crypt(t.refresh_token),
			expiresAt: this.tokenExpiry(t),
		};
	}
	async authorize(
		userDid: string,
		platform: "web" | "mobile",
		returnTo?: "onboarding",
	) {
		if (!this.configured)
			throw new BadRequestException(
				`${this.name} Sync is not configured on this server.`,
			);
		const verifier = randomBytes(32).toString("base64url");
		const state = randomBytes(32).toString("base64url");
		await this.prisma.authState.create({
			data: {
				key: `${this.provider}:${state}`,
				stateData: this.crypt(
					JSON.stringify({ userDid, verifier, platform, returnTo }),
				),
				expiresAt: new Date(Date.now() + 10 * 60_000),
			},
		});
		const url = new URL(this.authorizationEndpoint);
		for (const [k, v] of Object.entries({
			...this.authorizationParams(state),
			client_id: this.oauth.clientId,
			response_type: "code",
			redirect_uri: this.oauth.callbackUrl,
			state,
			code_challenge: createHash("sha256").update(verifier).digest("base64url"),
			code_challenge_method: "S256",
		}))
			url.searchParams.set(k, v);
		const path = returnTo === "onboarding" ? "onboarding" : this.returnPath;
		return {
			url: url.toString(),
			returnUrl:
				platform === "mobile"
					? `opnshelf://${path}`
					: `${this.config.FRONTEND_URL}/${path}`,
		};
	}
	async callback(state: string, code?: string) {
		let redirect = `${this.config.FRONTEND_URL}/${this.returnPath}`;
		let stage = "state-validation";
		try {
			const saved = await this.prisma.authState.findUnique({
				where: { key: `${this.provider}:${state}` },
			});
			const data = JSON.parse(this.crypt(saved?.stateData ?? "", true)) as {
				userDid: string;
				verifier: string;
				platform: string;
				returnTo?: string;
			};
			const path =
				data.returnTo === "onboarding" ? "onboarding" : this.returnPath;
			redirect =
				data.platform === "mobile"
					? `opnshelf://${path}`
					: `${this.config.FRONTEND_URL}/${path}`;
			if (!saved || saved.expiresAt <= new Date())
				throw new BadRequestException(
					`${this.name} authorization expired. Start again.`,
				);
			const claimed = await this.prisma.authState.deleteMany({
				where: { key: saved.key, expiresAt: { gt: new Date() } },
			});
			if (claimed.count !== 1)
				throw new BadRequestException(
					`${this.name} authorization has already been used.`,
				);
			if (!code) return `${redirect}?${this.callbackQuery}connection=cancelled`;
			stage = "token-exchange";
			const token = await this.oauth.exchange(code, data.verifier);
			try {
				stage = "profile-fetch";
				const profile = await this.oauthProfile(token, state);
				stage = "connection-save";
				const previous = await this.current(data.userDid);
				if (
					previous &&
					previous.status !== "disconnected" &&
					previous.accountId !== profile.accountId
				)
					throw new ConflictException(
						`Disconnect the current ${this.name} account before switching.`,
					);
				const existing = await this.prisma.integrationConnection.findUnique({
					where: {
						userDid_provider_accountId: {
							userDid: data.userDid,
							provider: this.provider,
							accountId: profile.accountId,
						},
					},
				});
				if (existing)
					await this.locked(existing, async () => {
						await this.prisma.integrationConnection.update({
							select: { id: true },
							where: { id: existing.id },
							data: {
								...this.tokenData(token),
								...this.connectionDefaults,
								username: profile.username,
								status: "paused",
								lastError: null,
							},
						});
					});
				else
					await this.prisma.integrationConnection.create({
						data: {
							userDid: data.userDid,
							provider: this.provider,
							accountId: profile.accountId,
							username: profile.username,
							...this.tokenData(token),
							...this.connectionDefaults,
						},
					});
			} catch (error) {
				await Promise.allSettled(
					[token.refresh_token, token.access_token].map((credential) =>
						this.oauth.revoke(credential),
					),
				);
				throw error;
			}
			return `${redirect}?${this.callbackQuery}connection=connected`;
		} catch (error) {
			// Never log exception messages, payloads, codes, state, or credentials.
			this.logger.warn(
				JSON.stringify({
					message: `${this.name} OAuth callback failed`,
					stage,
					category:
						error instanceof IntegrationError
							? `${this.provider}-api`
							: error instanceof ZodError
								? "response-validation"
								: error instanceof HttpException
									? "request-validation"
									: "internal",
					status:
						error instanceof IntegrationError
							? error.status
							: error instanceof HttpException
								? error.getStatus()
								: undefined,
					response:
						error instanceof IntegrationError && "diagnostics" in error
							? error.diagnostics
							: undefined,
				}),
			);
			return `${redirect}?${this.callbackQuery}connection=failed`;
		}
	}
	protected async accessToken(c: IntegrationConnection) {
		const current = await this.prisma.integrationConnection.findUniqueOrThrow({
			where: { id: c.id },
			select: {
				id: true,
				accessToken: true,
				refreshToken: true,
				expiresAt: true,
				status: true,
				lastError: true,
				failingSince: true,
			},
		});
		if (!current.accessToken || !current.refreshToken)
			throw new BadRequestException(`Connect ${this.name} first.`);
		if (
			!current.expiresAt ||
			current.expiresAt.getTime() < Date.now() + 60_000
		) {
			try {
				const fresh = await this.oauth.refresh(
					this.crypt(current.refreshToken, true),
				);
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: current.id },
					data: this.tokenData(fresh),
				});
				return fresh.access_token;
			} catch (error) {
				if (
					!(error instanceof IntegrationError) ||
					![400, 401].includes(error.status)
				)
					throw error;
				await this.prisma.integrationConnection.update({
					select: { id: true },
					where: { id: current.id },
					data: {
						status: "reconnect",
						lastError: `Reconnect ${this.name} to continue syncing.`,
						failingSince: failingSince(current),
					},
				});
				throw new IntegrationError(
					`Reconnect ${this.name} to continue syncing.`,
					401,
				);
			}
		}
		return this.crypt(current.accessToken, true);
	}
	protected credentialed(c: IntegrationConnection) {
		return Boolean(c.accessToken);
	}
	protected async revoke(c: IntegrationConnection) {
		if (c.accessToken) await this.oauth.revoke(this.crypt(c.accessToken, true));
	}
}
