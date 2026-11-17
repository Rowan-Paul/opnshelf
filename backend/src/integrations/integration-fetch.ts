import { IntegrationUnavailable } from "./integration-error";

/**
 * Transport helpers shared by every adapter (ADR 0051, ADR 0052). A provider
 * that is down, slow or returning garbage is an outage: the run stops and
 * retries, and no individual item is marked in Needs attention.
 */

/** Statuses that describe the provider's health, not one request's content. */
export const isOutageStatus = (status: number) =>
	status === 408 || status >= 500;

/** `fetch` with a timeout; a timeout or network failure is an outage. */
export async function integrationFetch(
	name: string,
	input: string | URL,
	init: RequestInit = {},
	timeoutMs = 15_000,
): Promise<Response> {
	try {
		return await fetch(input, {
			...init,
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch {
		// Never surface a transport message: it can carry a URL or host detail.
		throw new IntegrationUnavailable(
			`${name} could not be reached. Sync will retry.`,
		);
	}
}

/** The JSON body of a successful response, or null when it is empty. */
export async function integrationJson(
	name: string,
	response: Response,
): Promise<unknown> {
	try {
		const text = await response.text();
		return text.trim() ? JSON.parse(text) : null;
	} catch {
		throw new IntegrationUnavailable(
			`${name} returned a response Opnshelf could not read. Sync will retry.`,
			response.status,
		);
	}
}
