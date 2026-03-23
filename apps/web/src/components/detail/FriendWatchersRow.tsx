import type { FollowedWatchersDto } from "@opnshelf/api";
import { Users } from "lucide-react";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { normalizeProfileHandle } from "@/lib/profile-routes";
import type { ColorTheme } from "./types";

type FriendWatchersRowProps = {
	watchers?: FollowedWatchersDto;
	isLoading?: boolean;
	colors: ColorTheme;
};

export function FriendWatchersRow({
	watchers,
	isLoading = false,
	colors,
}: FriendWatchersRowProps) {
	if (isLoading) {
		return (
			<div className="flex max-w-full animate-pulse flex-col gap-2 pl-1">
				<div className="h-3 w-24 rounded-full bg-(--md-sys-color-surface-container-highest)" />
				<div className="flex w-fit max-w-full items-center gap-2 overflow-hidden">
					<div className="flex -space-x-3">
						<div className="size-8 rounded-full bg-(--md-sys-color-surface-container-highest)" />
						<div className="size-8 rounded-full bg-(--md-sys-color-surface-container-highest)" />
						<div className="size-8 rounded-full bg-(--md-sys-color-surface-container-highest)" />
						<div className="size-8 rounded-full bg-(--md-sys-color-surface-container-highest)" />
					</div>
					<div className="h-8 w-12 rounded-full bg-(--md-sys-color-surface-container-highest)" />
				</div>
			</div>
		);
	}

	if (!watchers || watchers.total === 0 || watchers.items.length === 0) {
		return null;
	}

	const overflowCount = Math.max(watchers.total - watchers.items.length, 0);

	return (
		<div className="flex max-w-full flex-col gap-2 pl-1">
			<p
				className="text-[11px] font-medium uppercase tracking-[0.16em]"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				Friend Activity
			</p>
			<div className="flex w-fit max-w-full items-center gap-2 overflow-hidden">
				<div className="flex items-center gap-3 overflow-hidden">
					<div className="flex min-w-0 items-center -space-x-3 overflow-hidden">
						{watchers.items.map((watcher) => {
							const href = `/profile/${normalizeProfileHandle(watcher.actor.handle)}/shelf?page=1`;

							return (
								<a
									key={watcher.actor.did}
									href={href}
									aria-label={`Open ${watcher.actor.displayName ?? watcher.actor.handle}'s profile`}
									title={watcher.actor.displayName ?? watcher.actor.handle}
									className="shrink-0 rounded-full ring-2 ring-(--md-sys-color-surface)"
								>
									<SocialUserAvatar
										avatar={watcher.actor.avatar}
										displayName={watcher.actor.displayName}
										handle={watcher.actor.handle}
										className="size-8"
									/>
								</a>
							);
						})}
					</div>
					{overflowCount > 0 ? (
						<div
							className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container)",
								color: "var(--md-sys-color-on-surface-variant)",
							}}
						>
							<Users
								className="size-3.5 shrink-0"
								style={{ color: colors.primary }}
							/>
							<span className="text-xs font-medium">+{overflowCount}</span>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
