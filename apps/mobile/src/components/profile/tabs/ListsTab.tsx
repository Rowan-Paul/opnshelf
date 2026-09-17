import type { ListSummaryDto } from "@opnshelf/api";
import { type Href, Link } from "expo-router";
import { ChevronRight, ListChecks } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
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
	const { data, isLoading, isError } = useProfileLists(userDid);

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Lists
			</Text>

			{isLoading ? (
				<ListRowsSkeleton />
			) : isError ? (
				<ErrorState message="Couldn't load lists." />
			) : !data || data.length === 0 ? (
				<EmptyState icon={ListChecks} title="No lists yet" />
			) : (
				<View className="gap-3">
					{data.map((list) => (
						<ListRow
							key={list.id}
							list={list}
							userDid={userDid}
							handle={handle}
						/>
					))}
				</View>
			)}
		</View>
	);
}

function ListRow({
	list,
	userDid,
	handle,
}: {
	list: ListSummaryDto;
	userDid: string;
	handle: string;
}) {
	const { user } = useAuth();
	// Own lists open the manageable owner screen (sort/reorder/add/edit);
	// other users' lists open the read-only public route.
	const href = (
		user?.did === userDid
			? `/lists/${list.slug}`
			: `/list/${encodeURIComponent(handle)}/${list.slug}`
	) as Href;

	return (
		<Link href={href} asChild>
			<Pressable className="flex-row items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
				<View className="min-w-0 flex-1">
					<Text
						className="font-semibold text-base text-foreground"
						numberOfLines={1}
					>
						{list.name}
					</Text>
					{list.description ? (
						<Text className="text-muted-foreground text-sm" numberOfLines={1}>
							{list.description}
						</Text>
					) : null}
					<Text className="mt-0.5 text-muted-foreground text-xs">
						{list.itemCount} item{list.itemCount === 1 ? "" : "s"}
					</Text>
				</View>
				<ChevronRight color="#94a3b8" size={18} />
			</Pressable>
		</Link>
	);
}
