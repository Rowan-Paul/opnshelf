import { Users } from "lucide-react";

export function FollowingHeader() {
	return (
		<div className="mb-8">
			<div className="flex items-center gap-3 mb-2">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)]">
					<Users className="h-5 w-5" />
				</div>
				<h1 className="text-display-2">Following</h1>
			</div>
			<p className="text-[var(--foreground-muted)] ml-[52px]">
				See what your friends are watching and discover new content.
			</p>
		</div>
	);
}
