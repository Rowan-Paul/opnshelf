/** A provider failure with a user-safe message. Status 401 asks the User to reconnect. */
export class IntegrationError extends Error {
	constructor(
		message: string,
		readonly status = 0,
		readonly retrySeconds = 60,
	) {
		super(message);
	}
}
