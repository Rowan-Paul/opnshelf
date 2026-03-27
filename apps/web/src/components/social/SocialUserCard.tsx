import type { SocialUserCardDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { SocialFollowButton } from "@/components/social/SocialFollowButton";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { getSocialDisplayName } from "@/components/social/social-display";
import { M3Button } from "@/components/ui/m3-button";
import { M3Card, M3CardContent } from "@/components/ui/m3-card";
import { getProfileRoute } from "@/lib/profile-routes";

export function SocialUserCard({
	user,
	viewerHandle,
	showFollowButton = true,
}: {
	user: SocialUserCardDto;
	viewerHandle?: string | null;
	showFollowButton?: boolean;
}) {
	const displayName = getSocialDisplayName(user.displayName, user.handle);
	const relationshipBadge = user.isFollowing
		? user.isFollowedBy
			? "Mutual"
			: "Following"
		: user.isFollowedBy
			? "Follows you"
			: null;

	return (
		<M3Card
			variant="elevated"
			className="rounded-xl border"
			style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
		>
			<M3CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					<SocialUserAvatar
						avatar={user.avatar}
						displayName={user.displayName}
						handle={user.handle}
					/>
					<div className="min-w-0">
						<Link
							{...getProfileRoute(user.handle, "shelf", { page: 1 })}
							className="block"
						>
							<p className="md-title-large truncate">{displayName}</p>
							<p
								className="truncate md-body-medium"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								@{user.handle}
							</p>
						</Link>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
							<span>{user.followingCount} following</span>
							<span
								style={{ color: "var(--md-sys-color-outline)" }}
								aria-hidden="true"
							>
								•
							</span>
							<span>{user.followersCount} followers</span>
							{relationshipBadge ? (
								<>
									<span
										style={{ color: "var(--md-sys-color-outline)" }}
										aria-hidden="true"
									>
										•
									</span>
									<span
										className="rounded-full px-2 py-1 text-xs font-semibold"
										style={{
											backgroundColor:
												"var(--md-sys-color-secondary-container)",
											color: "var(--md-sys-color-on-secondary-container)",
										}}
									>
										{relationshipBadge}
									</span>
								</>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<M3Button variant="text" className="rounded-full px-4" asChild>
						<Link {...getProfileRoute(user.handle, "shelf", { page: 1 })}>
							View profile
						</Link>
					</M3Button>
					{showFollowButton ? (
						<SocialFollowButton
							targetDid={user.did}
							targetHandle={user.handle}
							viewerHandle={viewerHandle}
							isFollowing={user.isFollowing}
							isFollowedBy={user.isFollowedBy}
							className="rounded-full px-5"
						/>
					) : null}
				</div>
			</M3CardContent>
		</M3Card>
	);
}
