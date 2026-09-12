/**
 * There is no verifier to redeem a Mobile Handoff Code with.
 *
 * Usually that means something else already completed this sign-in: on Android
 * the OS can deliver the redirect to the `auth/complete` deep link *and*
 * resolve the auth session, and whichever runs first takes both the verifier
 * and the single-use code. But it also covers a handoff that was never begun,
 * or one whose SecureStore entry is gone, so a caller must confirm a session
 * actually exists before treating it as success.
 *
 * Lives apart from `auth-handoff` on purpose: callers branch on `instanceof`,
 * and a test that mocks that module would otherwise replace this class with a
 * copy that never matches.
 */
export class NoPendingHandoffError extends Error {
	// Without this, logs read "Error: ..." and lose the one useful detail.
	override name = "NoPendingHandoffError";
}
