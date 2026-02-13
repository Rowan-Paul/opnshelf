import type { MovieListSummaryDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { List, Star } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface ListCardProps {
	list: MovieListSummaryDto;
}

export function ListCard({ list }: ListCardProps) {
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
		<Link to="/lists/$slug" params={{ slug: list.slug }}>
			<Card className="bg-gray-900 border-gray-800 hover:border-purple-600 transition-colors cursor-pointer h-full">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-2">
						<div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
							{getIcon()}
						</div>
						<div className="flex-1 min-w-0">
							<CardTitle className="text-lg truncate">{list.name}</CardTitle>
							{list.isDefault && (
								<span className="text-xs text-purple-400">Default list</span>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{list.description && (
						<CardDescription className="line-clamp-2 mb-2">
							{list.description}
						</CardDescription>
					)}
					<p className="text-sm text-gray-400">
						{list.movieCount} movie{list.movieCount !== 1 ? "s" : ""}
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}
