/**
 * The user could sign in, but not on this device: no native credential, or no
 * client id configured for this platform.
 *
 * Lives apart from `provider-signin` for the same reason as
 * [NoPendingHandoffError]: callers branch on `instanceof`, and that module
 * imports the native Google and Apple SDKs, so a test that mocks it would
 * otherwise have to load them just to get this class.
 */
export class ProviderUnavailableError extends Error {
	override name = "ProviderUnavailableError";
}
