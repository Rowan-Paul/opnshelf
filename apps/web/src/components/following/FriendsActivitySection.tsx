import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Users } from "lucide-react";
import { MiniActivityCard } from "./MiniActivityCard";

const MAX_AGE_DAYS = 30;

interface FriendsActivitySectionProps {
	items: FollowedActivityItemDto[];
	isLoading: boolean;
	userTimezone?: string;
	userTimeFormat?: "12h" | "24h";
}

export function FriendsActivitySection({
	items,
	isLoading,
	userTimezone,
	userTimeFormat,
}: FriendsActivitySectionProps) {
	const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
	const recentItems = items.filter(
		(item) => new Date(item.activityAt) >= cutoff,
	);

	return (
		<section>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-display-3">Social</h2>
				<Link
					to="/social"
					className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
				>
					View all
				</Link>
			</div>

			{isLoading ? (
				<div className="card p-8">
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex animate-pulse items-start gap-3">
								<div className="h-16 w-11 shrink-0 rounded-md bg-(--background-subtle)" />
								<div className="flex-1 space-y-2 pt-1">
									<div className="h-4 w-1/2 rounded bg-(--background-subtle)" />
									<div className="h-3 w-1/3 rounded bg-(--background-subtle)" />
								</div>
							</div>
						))}
					</div>
				</div>
			) : recentItems.length > 0 ? (
				<div className="card divide-y divide-(--border)">
					{recentItems.map((item: FollowedActivityItemDto) => (
						<MiniActivityCard
							key={item.id}
							activity={item}
							userTimezone={userTimezone}
							userTimeFormat={userTimeFormat}
						/>
					))}
				</div>
			) : (
				<div className="card p-8 text-center">
					<MessageCircle className="mx-auto mb-3 size-12 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">
						Activity from people you follow will appear here.
					</p>
					<Link to="/social/find" className="btn btn-primary mt-4 inline-flex">
						<Users className="mr-2 size-4" />
						Find people to follow
					</Link>
				</div>
			)}
		</section>
	);
}
