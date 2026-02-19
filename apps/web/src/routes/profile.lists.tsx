import {
	authControllerMeOptions,
	listsControllerGetUserListsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListPlus } from "lucide-react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { ListCard } from "@/components/ListCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export const Route = createFileRoute("/profile/lists")({
	head: () => ({
		meta: [{ title: "My Lists | OpnShelf" }],
	}),
	component: ListsPage,
});

function ListsPage() {
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user?.did,
	});

	if (isListsLoading) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-32 rounded-lg animate-pulse"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-highest)",
						}}
					/>
				))}
			</div>
		);
	}

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<CreateListDialog />
			</div>
			{lists && lists.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{lists.map((list) => (
						<ListCard key={list.id} list={list} />
					))}
				</div>
			)}

			{lists && lists.length === 0 && (
				<M3Card variant="elevated" className="text-center max-w-md mx-auto">
					<M3CardHeader>
						<ListPlus
							className="w-16 h-16 mx-auto mb-4"
							style={{ color: "var(--md-sys-color-outline)" }}
						/>
						<M3CardTitle className="md-headline-small">
							No lists yet
						</M3CardTitle>
						<M3CardDescription>
							Your default lists will appear after you add movies
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent>
						<M3Button variant="filled" asChild>
							<Link to="/search" search={{ q: "", type: "all" }}>
								Search for movies
							</Link>
						</M3Button>
					</M3CardContent>
				</M3Card>
			)}
		</div>
	);
}
