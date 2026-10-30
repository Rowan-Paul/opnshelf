import type { Href } from "expo-router";
import { ListChecks } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { ListSummaryRow } from "@/components/lists/ListSummaryRow";
import {
	ListsSortButton,
	ListsSortSheet,
} from "@/components/lists/ListsSortSheet";
import { ListSummaryRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { type ListsSort, sortLists } from "@/lib/lists-sort";
import { useProfileLists } from "@/lib/use-public-profile";

/**
 * Lists tab: the user's public list summaries. Rows link to
 * `/profile/[handle]/lists/[slug]`, the Web App's URL, which opens the owner
 * screen for the viewer's own List and the read-only one for anyone else's.
 */
export function ListsTab({
	userDid,
	handle,
}: {
	userDid: string;
	handle: string;
}) {
	const { user } = useAuth();
	const { data, isLoading, isError } = useProfileLists(userDid);
	const [sort, setSort] = useState<ListsSort>("default");
	const [sortSheetVisible, setSortSheetVisible] = useState(false);

	const sorted = useMemo(
		() => (data ? sortLists(data, sort) : undefined),
		[data, sort],
	);

	const hrefFor = (slug: string) =>
		`/profile/${encodeURIComponent(handle)}/lists/${slug}` as Href;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<View className="gap-3">
				<Text className="text-display-2 text-foreground">Lists</Text>
				{/* Nothing to sort with a single list. */}
				{data && data.length > 1 ? (
					<ListsSortButton
						sort={sort}
						onPress={() => setSortSheetVisible(true)}
					/>
				) : null}
			</View>

			{isLoading ? (
				<ListSummaryRowsSkeleton />
			) : isError ? (
				<ErrorState message="Couldn't load lists." />
			) : !sorted || sorted.length === 0 ? (
				<EmptyState
					icon={ListChecks}
					title="No lists yet"
					// Owners get the way in that the Web App's Lists page offers;
					// creating happens on the manageable Lists screen.
					message={
						user?.did === userDid
							? "Create a list to start organizing movies and shows."
							: undefined
					}
					action={
						user?.did === userDid
							? {
									label: "Create a list",
									href: `/profile/${encodeURIComponent(handle)}/lists` as Href,
								}
							: undefined
					}
				/>
			) : (
				<View className="gap-2">
					{sorted.map((list) => (
						<ListSummaryRow
							key={list.id}
							list={list}
							href={hrefFor(list.slug)}
						/>
					))}
				</View>
			)}

			<ListsSortSheet
				visible={sortSheetVisible}
				onDismiss={() => setSortSheetVisible(false)}
				value={sort}
				onChange={setSort}
			/>
		</View>
	);
}
