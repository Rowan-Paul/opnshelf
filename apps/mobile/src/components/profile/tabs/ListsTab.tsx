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
 * Lists tab: the user's public list summaries. Rows link to the owner list
 * screen (`/lists/[slug]`) for the viewer's own profile, and to the dedicated
 * read-only list page (`/list/[handle]/[slug]`) for other users.
 * Mirrors the web profile Lists page, which also routes to a per-list screen.
 *
 * The standalone list route resolves the owner from its `[handle]` segment and
 * also accepts raw DIDs from older deep links.
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

	// Own lists open the manageable owner screen (sort/reorder/add/edit);
	// other users' lists open the read-only public route.
	const hrefFor = (slug: string) =>
		(user?.did === userDid
			? `/lists/${slug}`
			: `/list/${encodeURIComponent(handle)}/${slug}`) as Href;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<View className="gap-3">
				<Text className="font-bold font-display text-2xl text-foreground">
					Lists
				</Text>
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
				<EmptyState icon={ListChecks} title="No lists yet" />
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
