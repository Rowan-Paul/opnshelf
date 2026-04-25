import type { FollowedActivityItemDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Users } from "lucide-react";
import { MiniActivityCard } from "./MiniActivityCard";

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
	return (
		<section>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-display-3">Friend Activity</h2>
				<Link
					to="/following"
					className="flex items-center gap-1 font-medium text-(--accent) text-sm hover:text-(--accent-hover)"
				>
					<Users className="h-4 w-4" />
					View all
				</Link>
			</div>

			{isLoading ? (
				<div className="card p-8">
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex animate-pulse items-center gap-3">
								<div className="h-10 w-10 rounded-full bg-(--background-subtle)" />
								<div className="flex-1 space-y-1">
									<div className="h-4 w-1/2 rounded bg-(--background-subtle)" />
									<div className="h-3 w-1/3 rounded bg-(--background-subtle)" />
								</div>
							</div>
						))}
					</div>
				</div>
			) : items.length > 0 ? (
				<div className="card divide-y divide-(--border)">
					{items.map((item: FollowedActivityItemDto) => (
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
					<MessageCircle className="mx-auto mb-3 h-12 w-12 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">
						Activity from people you follow will appear here.
					</p>
					<Link to="/following" className="btn btn-primary mt-4 inline-flex">
						<Users className="mr-2 h-4 w-4" />
						Find people to follow
					</Link>
				</div>
			)}
		</section>
	);
}
