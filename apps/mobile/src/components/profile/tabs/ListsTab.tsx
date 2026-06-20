import type { ListSummaryDto } from "@opnshelf/api";
import { ChevronRight, ListChecks } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { MediaCard } from "@/components/media/MediaCard";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { listItemToMediaCardItem } from "@/lib/list-media";
import { useProfileList, useProfileLists } from "@/lib/use-public-profile";

const POSTER_W = 110;

/**
 * Lists tab: the user's public list summaries. Tapping a list expands it inline
 * to show a horizontal preview of its items (fetched on demand from the public
 * list endpoint). Mirrors the web Lists page, kept compact for mobile.
 */
export function ListsTab({ userDid }: { userDid: string }) {
	const { data, isLoading, isError } = useProfileLists(userDid);
	const [expanded, setExpanded] = useState<string | null>(null);

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Lists
			</Text>

			{isLoading ? (
				<View className="py-16">
					<ActivityIndicator color="#f3bc00" />
				</View>
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
							expanded={expanded === list.slug}
							onToggle={() =>
								setExpanded((cur) => (cur === list.slug ? null : list.slug))
							}
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
	expanded,
	onToggle,
}: {
	list: ListSummaryDto;
	userDid: string;
	expanded: boolean;
	onToggle: () => void;
}) {
	const { data: detail, isLoading } = useProfileList(
		userDid,
		list.slug,
		expanded && list.itemCount > 0,
	);
	const items = detail?.items ?? [];

	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card">
			<Pressable onPress={onToggle} className="flex-row items-center gap-3 p-4">
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
				<View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
					<ChevronRight color="#94a3b8" size={18} />
				</View>
			</Pressable>

			{expanded ? (
				<View className="px-4 pb-4">
					{list.itemCount === 0 ? (
						<Text className="text-muted-foreground text-sm">Empty list.</Text>
					) : isLoading ? (
						<ActivityIndicator color="#94a3b8" />
					) : (
						<View className="flex-row flex-wrap gap-2">
							{items.map((item) => (
								<View key={item.id} style={{ width: POSTER_W }}>
									<MediaCard item={listItemToMediaCardItem(item)} />
								</View>
							))}
						</View>
					)}
				</View>
			) : null}
		</View>
	);
}
