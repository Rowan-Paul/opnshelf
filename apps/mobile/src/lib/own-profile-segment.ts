/**
 * Whether a `/profile/[handle]` segment names the signed-in user. The segment
 * is normally a handle, but older links carry a DID; handles compare
 * case-insensitively, as AT Protocol resolves them.
 */
export function isOwnProfileSegment(
	segment: string,
	user: { handle: string; did: string } | null | undefined,
): boolean {
	if (!user || !segment) return false;
	const value = decodeURIComponent(segment);
	return (
		value === user.did || value.toLowerCase() === user.handle.toLowerCase()
	);
}
