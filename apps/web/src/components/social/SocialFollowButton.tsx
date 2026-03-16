import { Loader2 } from "lucide-react";
import { getFollowLabel } from "@/components/profile/profile-header-state";
import { M3Button } from "@/components/ui/m3-button";
import { useSocialFollowActions } from "@/hooks/useSocialFollowActions";

export function SocialFollowButton({
	targetDid,
	targetHandle,
	viewerHandle,
	isFollowing,
	isFollowedBy,
	disabled = false,
	className,
}: {
	targetDid: string;
	targetHandle: string;
	viewerHandle?: string | null;
	isFollowing: boolean;
	isFollowedBy: boolean;
	disabled?: boolean;
	className?: string;
}) {
	const actions = useSocialFollowActions({
		targetDid,
		targetHandle,
		viewerHandle,
	});
	const label = getFollowLabel({ isFollowing, isFollowedBy });

	return (
		<M3Button
			type="button"
			variant={
				isFollowing ? "filled-tonal" : isFollowedBy ? "outlined" : "filled"
			}
			className={className}
			disabled={disabled || actions.isPending}
			onClick={() => {
				if (isFollowing) {
					actions.unfollow();
					return;
				}

				actions.follow();
			}}
		>
			{actions.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
			{label}
		</M3Button>
	);
}
