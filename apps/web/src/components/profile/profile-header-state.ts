export function canClickRelationshipCounts(isSignedIn: boolean) {
	return isSignedIn;
}

export function shouldShowFollowButton(args: {
	isSignedIn: boolean;
	isOwner: boolean;
}) {
	return args.isSignedIn && !args.isOwner;
}

export function getFollowLabel(args: {
	isFollowing: boolean;
	isFollowedBy: boolean;
}) {
	if (!args.isFollowing && args.isFollowedBy) {
		return "Follow back";
	}

	return args.isFollowing ? "Following" : "Follow";
}
