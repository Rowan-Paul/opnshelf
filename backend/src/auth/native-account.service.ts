import { Agent, AtpAgent } from "@atproto/api";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Accounts Opnshelf creates on its own Tranquil PDS: password signup with an
 * invite code, the emailed verification step that unlocks record writes, and
 * the delegated Google registration the PDS verifies for us. Sign-in through
 * an external PDS never touches this service.
 */
@Injectable()
export class NativeAccountService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Create an account directly on our Tranquil PDS.
	 *
	 * Requires a valid (single-use) invite code because the PDS runs with
	 * `invite_code_required = true`. Returns the credential tokens for the new
	 * account so the caller can persist a session.
	 */
	async registerAccount(params: {
		handle: string;
		email: string;
		password: string;
		inviteCode: string;
	}): Promise<{
		did: string;
		handle: string;
		accessJwt: string;
		refreshJwt: string;
		pdsUrl: string;
	}> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}

		const agent = new AtpAgent({ service: pdsUrl });
		await agent.createAccount({
			handle: params.handle,
			email: params.email,
			password: params.password,
			inviteCode: params.inviteCode,
		});

		const session = agent.session;
		if (!session) {
			throw new Error("createAccount returned no session");
		}

		return {
			did: session.did,
			handle: session.handle,
			accessJwt: session.accessJwt,
			refreshJwt: session.refreshJwt,
			pdsUrl,
		};
	}

	/**
	 * Confirm the signup verification code for a native PDS account.
	 *
	 * The code was emailed by the PDS on `createAccount`. We read the account's
	 * email from its own session (`getSession`), then call
	 * `com.atproto.server.confirmEmail`. Verifying the email satisfies the PDS's
	 * verified-comms-channel gate, after which records can be written.
	 *
	 * Takes the session the request guard already restored rather than restoring
	 * again: a second restore in the same request spins up a competing credential
	 * session that races the guard's on the PDS's single-use refresh token, and
	 * the loser's failure revokes the session — logging the user out mid-verify.
	 *
	 * @returns `true` if the account was just verified (or already verified).
	 * @throws an XRPC error (mapped by the controller) on an invalid/expired code.
	 */
	async confirmEmailWithCode(session: unknown, code: string): Promise<boolean> {
		if (!session) {
			throw new Error("Session not found");
		}
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const { data: sessionInfo } = await agent.com.atproto.server.getSession();
		if (!sessionInfo.email) {
			throw new Error("Account has no email to verify");
		}
		if (sessionInfo.emailConfirmed) {
			return true;
		}

		await agent.com.atproto.server.confirmEmail({
			email: sessionInfo.email,
			token: code.trim(),
		});
		return true;
	}

	/**
	 * Ask the PDS to (re)send the signup verification email for this account.
	 *
	 * Tranquil exposes this as `com.atproto.server.resendVerification` and does
	 * NOT implement the standard `com.atproto.server.requestEmailConfirmation`.
	 * The endpoint is unauthenticated and keyed by DID — it re-enqueues the same
	 * signup code `createAccount` originally sent — so no session/agent is needed.
	 */
	async resendEmailConfirmation(did: string): Promise<void> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const res = await fetch(
			`${pdsUrl}/xrpc/com.atproto.server.resendVerification`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ did }),
				signal: AbortSignal.timeout(30_000),
			},
		);
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`resendVerification failed (${res.status}): ${body}`);
		}
	}

	/**
	 * Mirror the PDS verification status into our DB so `/auth/me` stays a pure
	 * DB read. Idempotent.
	 */
	async markEmailVerified(did: string): Promise<void> {
		await this.prisma.user.update({
			where: { did },
			data: { emailVerifiedAt: new Date() },
		});
	}

	/**
	 * Trade a Google `id_token` for a pending PDS registration.
	 *
	 * `POST /oauth/sso/register-token` is our own addition to the Tranquil fork.
	 * The PDS verifies the token against Google's JWKS itself (signature,
	 * audience, issuer, expiry), so opnshelf can never assert an identity it
	 * hasn't proven. The returned token is what `completeSsoRegistration` spends.
	 */
	async startSsoRegistration(
		idToken: string,
		requestUri: string,
	): Promise<{
		token: string | null;
		email: string | null;
		emailVerified: boolean;
		providerUsername: string | null;
		redirectUrl: string | null;
	}> {
		const data = (await this.pdsSsoPost("register-token", {
			provider: "google",
			id_token: idToken,
			request_uri: requestUri,
		})) as {
			token?: string | null;
			email?: string | null;
			emailVerified?: boolean;
			providerUsername?: string | null;
			redirectUrl?: string | null;
		};
		const pdsUrl = this.configService.get<string>("PDS_URL");
		return {
			token: data.token ?? null,
			email: data.email ?? null,
			emailVerified: data.emailVerified === true,
			providerUsername: data.providerUsername ?? null,
			redirectUrl:
				data.redirectUrl && pdsUrl
					? new URL(data.redirectUrl, pdsUrl).toString()
					: null,
		};
	}

	/**
	 * Spend a pending SSO registration: this is what actually creates the account.
	 *
	 * We deliberately send no `email`. The PDS then falls back to the email the
	 * provider reported, which is the only value its auto-verify check accepts
	 * (it compares character for character). Sending our own copy would risk a
	 * mismatch that drops the user onto an emailed code Tranquil cannot send.
	 *
	 * A registration bound to Core OAuth returns its consent redirect. Legacy
	 * standalone registrations may additionally return session JWTs.
	 */
	async completeSsoRegistration(params: {
		token: string;
		handle: string;
		inviteCode: string;
	}): Promise<{
		did: string;
		handle: string;
		redirectUrl: string;
		accessJwt: string | null;
		refreshJwt: string | null;
	}> {
		const data = (await this.pdsSsoPost("complete-registration", {
			token: params.token,
			handle: params.handle,
			invite_code: params.inviteCode,
		})) as {
			did: string;
			handle: string;
			redirectUrl: string;
			accessJwt?: string;
			refreshJwt?: string;
		};
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		return {
			did: data.did,
			handle: data.handle,
			redirectUrl: new URL(data.redirectUrl, pdsUrl).toString(),
			accessJwt: data.accessJwt ?? null,
			refreshJwt: data.refreshJwt ?? null,
		};
	}

	/**
	 * POST to one of the PDS's `/oauth/sso/*` endpoints. These are plain JSON
	 * routes, not XRPC, and need no auth — the invite code is the only gate.
	 *
	 * Errors are rethrown in the `{ error, message }` shape the rest of the
	 * signup path already maps to HTTP responses.
	 */
	private async pdsSsoPost(
		path: string,
		body: Record<string, unknown>,
	): Promise<unknown> {
		const pdsUrl = this.configService.get<string>("PDS_URL");
		if (!pdsUrl) {
			throw new Error("PDS_URL not configured");
		}
		const res = await fetch(`${pdsUrl}/oauth/sso/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(30_000),
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			const parsed = (data ?? {}) as { error?: string; message?: string };
			throw {
				status: res.status,
				error: parsed.error ?? "PdsSsoRequestFailed",
				message: parsed.message ?? `sso/${path} failed (${res.status})`,
			};
		}
		return data;
	}
}
