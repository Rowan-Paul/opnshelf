import { Users } from "lucide-react";

export function FollowingHeader() {
	return (
		<div className="mb-8">
			<div className="mb-2 flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
					<Users className="size-5" />
				</div>
				<h1 className="text-display-2">Following</h1>
			</div>
			<p className="ml-[52px] text-(--foreground-muted)">
				See what your friends are watching and discover new content.
			</p>
		</div>
	);
}
