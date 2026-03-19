import type { ListSummaryDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { List, Star } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { getProfileListDetailRoute } from "@/lib/profile-routes";

interface ListCardProps {
	handle: string;
	list: ListSummaryDto;
}

export function ListCard({ handle, list }: ListCardProps) {
	const { seedColor } = useTheme();

	const getIcon = () => {
		if (list.slug.includes("watchlist")) {
			return <List className="w-5 h-5" />;
		}
		if (list.slug.includes("favorites")) {
			return <Star className="w-5 h-5" />;
		}
		return <List className="w-5 h-5" />;
	};

	return (
		<Link
			{...getProfileListDetailRoute(handle, list.slug)}
			search={{ page: 1 }}
		>
			<M3Card
				variant="elevated"
				className="cursor-pointer h-full transition-all hover:md-elevation-2"
			>
				<M3CardHeader className="pb-2">
					<div className="flex items-center gap-2">
						<div
							className="p-2 rounded-lg"
							style={{
								backgroundColor: `${seedColor}20`,
								color: seedColor,
							}}
						>
							{getIcon()}
						</div>
						<div className="flex-1 min-w-0">
							<M3CardTitle className="md-title-medium truncate">
								{list.name}
							</M3CardTitle>
							{list.isDefault && (
								<span className="md-label-small" style={{ color: seedColor }}>
									Default list
								</span>
							)}
						</div>
					</div>
				</M3CardHeader>
				<M3CardContent>
					{list.description && (
						<M3CardDescription className="line-clamp-2 mb-2">
							{list.description}
						</M3CardDescription>
					)}
					<p
						className="md-body-medium"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}
					</p>
				</M3CardContent>
			</M3Card>
		</Link>
	);
}
