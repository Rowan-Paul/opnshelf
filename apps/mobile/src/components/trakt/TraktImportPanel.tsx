import {
	isActiveTraktImportStatus,
	isTerminalTraktImportStatus,
} from "@opnshelf/api";
import { Download, Film, Tv } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TraktImportBanner } from "@/components/trakt/TraktImportBanner";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTraktImport } from "@/lib/use-trakt-import";

/**
 * Trakt public-history import UI: username entry, a fetched preview, and the
 * in-flight/finished status banner. Shared between the standalone
 * `/trakt-import` screen and the onboarding Trakt step.
 *
 * Passing `onSkip`/`onDone` switches the panel into onboarding mode: it fills
 * the available height, scrolls its content, and pins a step footer to the
 * bottom (skip until an import finishes, continue once it does). Without those
 * props it lays out as a plain column for the standalone screen's own scroll.
 */
export function TraktImportPanel({
	onSkip,
	onDone,
	showExistingJob = true,
}: {
	/** Renders a "Skip for now" control until an import has finished. */
	onSkip?: () => void;
	/** Renders a "Continue" control once an import has finished. */
	onDone?: () => void;
	/**
	 * Whether to surface a pre-existing import on mount. The standalone screen
	 * wants this (resume view); onboarding passes false so a stale/old job
	 * doesn't make a freshly-arrived step claim "Importing from Trakt" — there
	 * the banner only appears once the user starts an import this session.
	 */
	showExistingJob?: boolean;
}) {
	const [username, setUsername] = useState("");
	const [startedThisSession, setStartedThisSession] = useState(false);
	const { currentJob, fetchPreview, startImport } = useTraktImport();
	const insets = useSafeAreaInsets();

	const preview = fetchPreview.data;
	const trimmed = username.trim();
	const job = showExistingJob || startedThisSession ? currentJob : null;
	const importActive = job ? isActiveTraktImportStatus(job.status) : false;
	const importDone = job ? isTerminalTraktImportStatus(job.status) : false;

	const handleFetch = () => {
		if (!trimmed) return;
		fetchPreview.mutate({ body: { username: trimmed } });
	};

	const handleStart = () => {
		if (!trimmed) return;
		setStartedThisSession(true);
		startImport.mutate({ body: { username: trimmed } });
	};

	const content = (
		<>
			<Text className="text-muted-foreground text-sm leading-5">
				Enter a public Trakt username. We’ll fetch that profile’s watch history
				and import it in the background — no CSV needed.
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
					className="flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
					style={{ opacity: !trimmed || fetchPreview.isPending ? 0.5 : 1 }}
				>
					<Text className="font-semibold text-primary-foreground">
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

			{job ? <TraktImportBanner job={job} /> : null}
		</>
	);

	// Standalone screen: plain column; the screen owns the scroll.
	if (!onSkip && !onDone) {
		return <View className="gap-4">{content}</View>;
	}

	// Onboarding step: fill height, scroll content, pin the step footer.
	// Never trap the user on this step — once an import is running they can move
	// on and it finishes in the background (the site-wide banner tracks it).
	const footer =
		importDone && onDone ? (
			<Pressable
				onPress={onDone}
				className="flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3.5"
			>
				<Text className="font-semibold text-base text-primary-foreground">
					Continue
				</Text>
			</Pressable>
		) : importActive && onSkip ? (
			<Pressable
				onPress={onSkip}
				className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3.5"
			>
				<Text className="font-semibold text-base text-foreground">
					Continue — we’ll finish in the background
				</Text>
			</Pressable>
		) : onSkip ? (
			<Pressable onPress={onSkip} className="items-center py-3">
				<Text className="font-medium text-base text-muted-foreground">
					Skip for now
				</Text>
			</Pressable>
		) : null;

	return (
		<View className="flex-1">
			<ScrollView
				className="flex-1"
				contentContainerClassName="gap-4 pb-4"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{content}
			</ScrollView>
			{footer ? (
				<View className="pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
					{footer}
				</View>
			) : null}
		</View>
	);
}
