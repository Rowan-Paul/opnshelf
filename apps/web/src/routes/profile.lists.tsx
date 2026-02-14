import {
	authControllerMeOptions,
	listsControllerGetUserListsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListPlus } from "lucide-react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { ListCard } from "@/components/ListCard";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
					<div key={i} className="h-32 bg-gray-800 rounded-lg animate-pulse" />
				))}
			</div>
		);
	}

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-semibold">My Lists</h1>
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
				<Card className="bg-gray-900 border-gray-800 text-center max-w-md mx-auto">
					<CardHeader>
						<ListPlus className="w-16 h-16 text-gray-700 mx-auto mb-4" />
						<CardTitle className="text-2xl">No lists yet</CardTitle>
						<CardDescription>
							Your default lists will appear after you add movies
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<Link to="/search" search={{ q: "" }}>
								Search for movies
							</Link>
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
