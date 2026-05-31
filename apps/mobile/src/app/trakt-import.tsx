import { isActiveTraktImportStatus } from "@opnshelf/api";
import { Stack } from "expo-router";
import { Download, Film, Tv } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { TraktImportBanner } from "@/components/trakt/TraktImportBanner";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTraktImport } from "@/lib/use-trakt-import";

export default function TraktImportScreen() {
	const [username, setUsername] = useState("");
	const { currentJob, fetchPreview, startImport } = useTraktImport();

	const preview = fetchPreview.data;
	const trimmed = username.trim();
	const importActive = currentJob
		? isActiveTraktImportStatus(currentJob.status)
		: false;

	const handleFetch = () => {
		if (!trimmed) return;
		fetchPreview.mutate({ body: { username: trimmed } });
	};

	const handleStart = () => {
		if (!trimmed) return;
		startImport.mutate({ body: { username: trimmed } });
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: "Import from Trakt" }}
			/>
			<ScrollView
				className="flex-1"
				contentContainerClassName="gap-4 px-4 py-4 pb-12"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Text className="text-muted-foreground text-sm leading-5">
					Enter a public Trakt username. We’ll fetch that profile’s watch
					history and import it in the background — no CSV needed.
				</Text>

				<View className="gap-2">
					<TextField
						label="Trakt username"
						value={username}
						onChangeText={setUsername}
						placeholder="your-trakt-username"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
						onSubmitEditing={handleFetch}
					/>
					<Pressable
						onPress={handleFetch}
						disabled={!trimmed || fetchPreview.isPending}
						className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
						style={{ opacity: !trimmed || fetchPreview.isPending ? 0.5 : 1 }}
					>
						<Text className="font-semibold text-foreground">
							{fetchPreview.isPending ? "Fetching…" : "Fetch history"}
						</Text>
					</Pressable>
				</View>

				{preview ? (
					<View className="gap-3 rounded-xl border border-border bg-card p-4">
						<View>
							<Text className="font-semibold text-base text-foreground">
								{preview.profile.name || preview.profile.username}
							</Text>
							<Text className="text-muted-foreground text-xs">
								@{preview.profile.username}
							</Text>
						</View>
						<Text className="text-muted-foreground text-sm">
							{preview.importableCount} importable item
							{preview.importableCount === 1 ? "" : "s"} found in the recent
							history preview.
						</Text>

						{preview.previewItems.length > 0 ? (
							<View className="gap-2">
								{preview.previewItems.slice(0, 6).map((item) => (
									<View
										key={`${item.type}-${item.title}-${item.watchedAt}`}
										className="flex-row items-center gap-2"
									>
										{item.type === "movie" ? (
											<Film color="#94a3b8" size={14} />
										) : (
											<Tv color="#94a3b8" size={14} />
										)}
										<Text
											className="flex-1 text-foreground text-sm"
											numberOfLines={1}
										>
											{item.title}
											{item.subtitle ? (
												<Text className="text-muted-foreground">
													{"  "}
													{item.subtitle}
												</Text>
											) : null}
										</Text>
									</View>
								))}
							</View>
						) : null}

						<Pressable
							onPress={handleStart}
							disabled={startImport.isPending || importActive}
							className="flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
							style={{
								opacity: startImport.isPending || importActive ? 0.6 : 1,
							}}
						>
							<Download color="#3f2e00" size={18} />
							<Text className="font-semibold text-primary-foreground">
								{importActive ? "Import in progress…" : "Start import"}
							</Text>
						</Pressable>
					</View>
				) : null}

				{currentJob ? <TraktImportBanner job={currentJob} /> : null}
			</ScrollView>
		</View>
	);
}
