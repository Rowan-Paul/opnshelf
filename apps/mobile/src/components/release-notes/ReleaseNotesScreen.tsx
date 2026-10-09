import {
	RELEASE_PLATFORM_NAMES,
	RELEASE_PLATFORMS,
	type ReleaseNote,
	releaseAvailabilityLabel,
	releaseNoteDate,
} from "@opnshelf/api";
import { Link, Stack, useFocusEffect } from "expo-router";
import { ArrowUpRight } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Markdown } from "@/components/ui/Markdown";
import { Screen } from "@/components/ui/screen";
import { ErrorState, StaleDataNotice } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useReleaseNotes } from "@/lib/use-release-notes";

function Availability({ entry }: { entry: ReleaseNote }) {
	return (
		<View className="gap-3 rounded-xl border border-border bg-card p-4">
			{RELEASE_PLATFORMS.map((platform) => (
				<View key={platform} className="gap-1">
					<Text className="font-semibold text-foreground text-xs">
						{RELEASE_PLATFORM_NAMES[platform]}
					</Text>
					<Text className="text-muted-foreground text-xs">
						{releaseAvailabilityLabel(entry.platforms[platform])}
					</Text>
				</View>
			))}
		</View>
	);
}
export function ReleaseNotesScreen({ slug }: { slug?: string }) {
	const [focused, setFocused] = useState(false);
	useFocusEffect(
		useCallback(() => {
			setFocused(true);
			return () => setFocused(false);
		}, []),
	);
	const notes = useReleaseNotes({ history: !slug && focused });
	const entry = notes.data?.find((item) => item.slug === slug);
	return (
		<>
			<Stack.Screen options={{ title: "What’s new", headerShown: true }} />
			<Screen topInset={false}>
				<ScrollView
					contentContainerClassName="gap-6 py-6"
					showsVerticalScrollIndicator={false}
				>
					{slug && (
						<Link href="/whats-new">
							<Text className="text-primary text-sm">← All release notes</Text>
						</Link>
					)}
					<View className="gap-3">
						{slug && (
							<Text className="font-bold font-display text-3xl text-foreground">
								{entry?.title ??
									(!notes.data ? "Release notes" : "Release note not found")}
							</Text>
						)}
						{!slug && (
							<Text className="text-muted-foreground">
								The latest improvements, and how to use them.
							</Text>
						)}
						{entry && (
							<Text className="text-muted-foreground text-sm">
								{releaseNoteDate(entry.publishedAt)}
							</Text>
						)}
					</View>
					{notes.isPending && !notes.data && (
						<View accessibilityLabel="Loading release notes" className="gap-8">
							{[0, 1, 2].map((i) => (
								<View key={i} className="gap-4">
									<View className="h-3 w-28 rounded bg-background-subtle" />
									<View className="h-7 w-3/4 rounded bg-background-subtle" />
									<View className="h-4 w-full rounded bg-background-subtle" />
									<View className="h-36 rounded-xl bg-background-subtle" />
								</View>
							))}
						</View>
					)}
					{notes.isError &&
						(notes.data ? (
							<StaleDataNotice
								message="Couldn’t refresh release notes. Showing the last loaded version."
								onRetry={() => void notes.refetch()}
							/>
						) : (
							<ErrorState
								title="Couldn’t load release notes"
								onRetry={() => void notes.refetch()}
							/>
						))}
					{notes.markError && (
						<StaleDataNotice
							message="Couldn’t save your read status."
							onRetry={notes.retryMark}
						/>
					)}
					{slug ? (
						entry ? (
							<View className="gap-6">
								<Availability entry={entry} />
								<Markdown value={entry.markdown} />
							</View>
						) : (
							notes.data && (
								<Text className="text-muted-foreground">
									This release note isn’t available. Browse the history for
									published updates.
								</Text>
							)
						)
					) : (
						<>
							{notes.data?.length === 0 && (
								<View className="gap-2 rounded-xl border border-border bg-card p-6">
									<Text className="font-display font-semibold text-lg">
										The next chapter starts here
									</Text>
									<Text className="text-muted-foreground text-sm">
										Our next release notes will appear here. Check back for the
										latest improvements.
									</Text>
								</View>
							)}
							{notes.data?.map((note) => (
								<View
									key={note.slug}
									className="gap-4 border-border border-b pb-8"
								>
									<Text className="text-muted-foreground text-xs">
										{releaseNoteDate(note.publishedAt)}
									</Text>
									<Link
										href={{
											pathname: "/whats-new/[slug]",
											params: { slug: note.slug },
										}}
										asChild
									>
										<Pressable
											accessibilityRole="link"
											className="flex-row items-center gap-3"
										>
											<Text className="flex-1 font-display font-semibold text-2xl text-foreground">
												{note.title}
											</Text>
											<ArrowUpRight size={20} color="#f3bc00" />
										</Pressable>
									</Link>
									<Text className="text-muted-foreground leading-6">
										{note.summary}
									</Text>
									<Availability entry={note} />
								</View>
							))}
						</>
					)}
				</ScrollView>
			</Screen>
		</>
	);
}
