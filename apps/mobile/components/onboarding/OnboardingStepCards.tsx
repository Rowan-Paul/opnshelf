import { Image } from "expo-image";
import { FileSpreadsheet } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { M3TextField } from "@/components/ui/m3";
import { useTheme } from "@/contexts/theme";
import { AVATAR_UPLOAD_HELP_TEXT } from "@/lib/avatar-upload";
import type {
	FollowImportResult,
	FollowImportStatus,
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
	TraktImportPreview,
} from "./types";
import { styles } from "./styles";

export function BriefingStepCard({
	onStart,
	onSkip,
	isCompleting,
}: {
	onStart: () => void;
	onSkip: () => void;
	isCompleting: boolean;
}) {
	const { colors } = useTheme();

	return (
		<Card>
			<CardHeader>
				<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Briefing</Text>
				<Text style={[styles.sectionBody, { color: colors.onSurfaceVariant }]}>You can finish setup in under two minutes. We will save your display name, timezone, and optionally import your watch history.</Text>
			</CardHeader>
			<CardContent>
				<View style={styles.bulletList}>
					<Text style={[styles.bulletItem, { color: colors.onSurfaceVariant }]}>• Profile and timezone come first.</Text>
					<Text style={[styles.bulletItem, { color: colors.onSurfaceVariant }]}>• Import Bluesky friends already on OpnShelf.</Text>
					<Text style={[styles.bulletItem, { color: colors.onSurfaceVariant }]}>• Import from Trakt username or CSV export.</Text>
					<Text style={[styles.bulletItem, { color: colors.onSurfaceVariant }]}>• Skip import if you want to start tracking immediately.</Text>
				</View>
				<View style={[styles.actionsRow, styles.briefingActionsRow]}>
					<Button onPress={onStart}>Begin setup</Button>
					<Button variant="text" onPress={onSkip} disabled={isCompleting}>
						{isCompleting ? "Finishing..." : "Skip to dashboard"}
					</Button>
				</View>
			</CardContent>
		</Card>
	);
}

type IdentityStepCardProps = {
	displayName: string;
	hasBlueskyProfile: boolean;
	avatarPreviewUri: string | null;
	avatarErrorMessage: string | null;
	timezone: string;
	timeFormat: "12h" | "24h";
	isSavingProfile: boolean;
	onDisplayNameChange: (value: string) => void;
	onPickAvatar: () => void;
	onOpenTimezonePicker: () => void;
	onTimeFormatChange: (value: "12h" | "24h") => void;
	onBack: () => void;
	onSave: () => void;
};

export function IdentityStepCard({
	displayName,
	hasBlueskyProfile,
	avatarPreviewUri,
	avatarErrorMessage,
	timezone,
	timeFormat,
	isSavingProfile,
	onDisplayNameChange,
	onPickAvatar,
	onOpenTimezonePicker,
	onTimeFormatChange,
	onBack,
	onSave,
}: IdentityStepCardProps) {
	const { colors } = useTheme();

	return (
		<Card>
			<CardHeader>
				<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Identity</Text>
				<Text style={[styles.sectionBody, { color: colors.onSurfaceVariant }]}>Tune your profile and time preferences before importing.</Text>
			</CardHeader>
			<CardContent>
				<View style={styles.profileFormStack}>
					<View
						style={[
							styles.previewCard,
							{
								backgroundColor: colors.surfaceContainerHigh,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<View style={styles.identityAvatarRow}>
							<View
								style={[
									styles.identityAvatar,
									{ backgroundColor: colors.surfaceContainerHighest },
								]}
							>
								{avatarPreviewUri ? (
									<Image
										source={{ uri: avatarPreviewUri }}
										style={styles.identityAvatarImage}
									/>
								) : (
									<Text
										style={[
											styles.identityAvatarFallback,
											{ color: colors.primary },
										]}
									>
										{(displayName || "U").charAt(0).toUpperCase()}
									</Text>
								)}
							</View>
							<View style={styles.previewHeaderText}>
								<Text style={[styles.previewTitle, { color: colors.onSurface }]}>
									Profile photo
								</Text>
								<Text
									style={[
										styles.previewSubtitle,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{hasBlueskyProfile
										? "Your Bluesky avatar is prefilled. Upload a new one if you want a different OpnShelf photo."
										: "Upload a profile photo now or skip and add one later in settings."}
								</Text>
							</View>
						</View>
						<Button variant="filled-tonal" onPress={onPickAvatar}>
							{hasBlueskyProfile ? "Upload new photo" : "Upload profile photo"}
						</Button>
						<Text
							style={[
								styles.previewSubtitle,
								{ color: colors.onSurfaceVariant },
							]}
						>
							{AVATAR_UPLOAD_HELP_TEXT}
						</Text>
						{avatarErrorMessage ? (
							<Text
								style={[styles.previewSubtitle, { color: colors.error }]}
							>
								{avatarErrorMessage}
							</Text>
						) : null}
					</View>

					<M3TextField
						label="Display name"
						value={displayName}
						onChangeText={onDisplayNameChange}
						containerStyle={{ width: "100%" }}
						variant="outlined"
					/>

					<Pressable
						onPress={onOpenTimezonePicker}
						style={[
							styles.selectionRow,
							{
								backgroundColor: colors.surfaceContainerLow,
								borderColor: colors.outline,
							},
						]}
					>
						<View>
							<Text style={[styles.selectionLabel, { color: colors.onSurface }]}>Timezone</Text>
							<Text style={[styles.selectionValue, { color: colors.onSurfaceVariant }]}>
								{timezone.replace(/_/g, " ")}
							</Text>
						</View>
						<Text style={[styles.selectionAction, { color: colors.primary }]}>Change</Text>
					</Pressable>

					<View style={styles.toggleWrap}>
						<Text style={[styles.selectionLabel, { color: colors.onSurface }]}>Clock style</Text>
						<View style={styles.timeFormatRow}>
							<Pressable
								onPress={() => onTimeFormatChange("12h")}
								style={[
									styles.timeFormatPill,
									{
										backgroundColor:
											timeFormat === "12h"
												? colors.secondaryContainer
												: colors.surfaceContainerHigh,
									},
								]}
							>
								<Text
									style={{
										color:
											timeFormat === "12h"
												? colors.onSecondaryContainer
												: colors.onSurfaceVariant,
										fontWeight: "600",
									}}
								>
									12-hour
								</Text>
							</Pressable>
							<Pressable
								onPress={() => onTimeFormatChange("24h")}
								style={[
									styles.timeFormatPill,
									{
										backgroundColor:
											timeFormat === "24h"
												? colors.secondaryContainer
												: colors.surfaceContainerHigh,
									},
								]}
							>
								<Text
									style={{
										color:
											timeFormat === "24h"
												? colors.onSecondaryContainer
												: colors.onSurfaceVariant,
										fontWeight: "600",
									}}
								>
									24-hour
								</Text>
							</Pressable>
						</View>
					</View>

					<View style={styles.actionsRow}>
						<Button variant="text" onPress={onBack} disabled={isSavingProfile}>
							Back
						</Button>
						<Button onPress={onSave} disabled={isSavingProfile}>
							{isSavingProfile ? "Saving..." : "Save and continue"}
						</Button>
					</View>
				</View>
			</CardContent>
		</Card>
	);
}

type FriendsStepCardProps = {
	followImportStatus: FollowImportStatus;
	followImportResult: FollowImportResult | null;
	onImport: () => void;
	onContinue: () => void;
	onBack: () => void;
	onSkip: () => void;
};

export function FriendsStepCard({
	followImportStatus,
	followImportResult,
	onImport,
	onContinue,
	onBack,
	onSkip,
}: FriendsStepCardProps) {
	const { colors } = useTheme();
	const followMessage = getFollowImportMessage(
		followImportStatus,
		followImportResult,
	);

	return (
		<Card>
			<CardHeader>
				<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Friends</Text>
				<Text style={[styles.sectionBody, { color: colors.onSurfaceVariant }]}>
					Import the people you already follow on Bluesky who are on OpnShelf.
				</Text>
			</CardHeader>
			<CardContent>
				<View style={styles.formStack}>
					<View
						style={[
							styles.previewCard,
							{
								backgroundColor: colors.surfaceContainerHigh,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<Text style={[styles.previewKicker, { color: colors.primary }]}>
							Bluesky friends
						</Text>
						<Text style={[styles.previewTitle, { color: colors.onSurface }]}>
							Bring your existing follows into OpnShelf in one step.
						</Text>
						<Text
							style={[styles.previewSubtitle, { color: colors.onSurfaceVariant }]}
						>
							No preview list, no invites. If someone you follow is already on
							OpnShelf, we will follow them here too.
						</Text>
						{followMessage ? (
							<View
								style={[
									styles.importStatusBox,
									{
										backgroundColor: colors.surface,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text
									style={[styles.importStatusText, { color: colors.onSurface }]}
								>
									{followMessage}
								</Text>
							</View>
						) : null}
						{followImportStatus === "success" ? (
							<Button onPress={onContinue}>Continue to watch history</Button>
						) : (
							<Button
								onPress={onImport}
								disabled={followImportStatus === "running"}
							>
								{followImportStatus === "running"
									? "Importing Bluesky following..."
									: followImportStatus === "error"
										? "Try again"
										: "Import my Bluesky following"}
							</Button>
						)}
					</View>

					<View style={styles.actionsRow}>
						<Button
							variant="text"
							onPress={onBack}
							disabled={followImportStatus === "running"}
						>
							Back
						</Button>
						<Button
							variant="text"
							onPress={onSkip}
							disabled={followImportStatus === "running"}
						>
							Skip for now
						</Button>
					</View>
				</View>
			</CardContent>
		</Card>
	);
}

type ImportStepCardProps = {
	activeTab: TabValue;
	traktUsername: string;
	traktPreview: TraktImportPreview | null;
	csvFileName: string | null;
	importProgress: ImportProgressState;
	importPercent: number;
	isImportBusy: boolean;
	isCompleting: boolean;
	onActiveTabChange: (tab: TabValue) => void;
	onTraktUsernameChange: (value: string) => void;
	onTraktImport: () => void;
	onTraktImportConfirm: () => void;
	onCsvImport: () => void;
	onBack: () => void;
	onSkip: () => void;
};

export function ImportStepCard({
	activeTab,
	traktUsername,
	traktPreview,
	csvFileName,
	importProgress,
	importPercent,
	isImportBusy,
	isCompleting,
	onActiveTabChange,
	onTraktUsernameChange,
	onTraktImport,
	onTraktImportConfirm,
	onCsvImport,
	onBack,
	onSkip,
}: ImportStepCardProps) {
	const { colors } = useTheme();
	const isTraktImporting =
		activeTab === "trakt" && importProgress.phase === "importing";
	const showImportStatusAboveInput =
		importProgress.phase !== "idle" && !isTraktImporting;

	return (
		<Card>
			<CardHeader>
				<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Import</Text>
				<Text style={[styles.sectionBody, { color: colors.onSurfaceVariant }]}>Import watch history from Trakt or a Trakt CSV export.</Text>
			</CardHeader>
			<CardContent>
				<View style={styles.importFormStack}>
					{showImportStatusAboveInput && (
						<View
							style={[
								styles.importStatusBox,
								{
									backgroundColor: colors.surfaceContainerHigh,
									borderColor:
										importProgress.phase === "error"
											? colors.error
											: colors.outlineVariant,
								},
							]}
						>
							<Text
								style={[
									styles.importStatusText,
									{
										color:
											importProgress.phase === "error"
												? colors.error
												: colors.onSurface,
									},
								]}
							>
								{importProgress.message}
							</Text>
							{importProgress.phase === "preview_ready" && traktPreview ? (
								<Text
									style={[
										styles.importStatusMeta,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{traktPreview.importableCount} importable items found from{" "}
									{traktPreview.sourceCount} Trakt history rows.
								</Text>
							) : null}
						</View>
					)}

					<View style={styles.tabRow}>
						<Pressable
							onPress={() => onActiveTabChange("trakt")}
							style={[
								styles.tabButton,
								{
									backgroundColor:
										activeTab === "trakt"
											? colors.secondaryContainer
											: colors.surfaceContainerHigh,
								},
							]}
						>
							<Text
								style={{
									color:
										activeTab === "trakt"
											? colors.onSecondaryContainer
											: colors.onSurfaceVariant,
									fontWeight: "600",
								}}
							>
								Trakt username
							</Text>
						</Pressable>
						<Pressable
							onPress={() => onActiveTabChange("csv")}
							style={[
								styles.tabButton,
								{
									backgroundColor:
										activeTab === "csv"
											? colors.secondaryContainer
											: colors.surfaceContainerHigh,
								},
							]}
						>
							<Text
								style={{
									color:
										activeTab === "csv"
											? colors.onSecondaryContainer
											: colors.onSurfaceVariant,
									fontWeight: "600",
								}}
							>
								CSV upload
							</Text>
						</Pressable>
					</View>

					{activeTab === "trakt" ? (
						<View style={styles.formStack}>
							<M3TextField
								label="Trakt username"
								value={traktUsername}
								onChangeText={onTraktUsernameChange}
								placeholder="your-trakt-handle"
								containerStyle={{ width: "100%" }}
								variant="outlined"
								editable={!isTraktImporting}
							/>
							<Text style={[styles.csvHelp, { color: colors.onSurfaceVariant }]}>
								We fetch the Trakt profile and recent plays first so you can
								confirm the account before importing.
							</Text>
							<Button onPress={onTraktImport} disabled={isImportBusy}>
								{isImportBusy
									? "Working..."
									: traktPreview
										? "Refresh preview"
										: "Fetch preview"}
							</Button>
							{isTraktImporting ? (
								<View
									style={[
										styles.previewCard,
										{
											backgroundColor: colors.surfaceContainerHigh,
											borderColor: colors.outlineVariant,
										},
									]}
								>
									<Text
										style={[
											styles.importStatusText,
											{ color: colors.onSurface },
										]}
									>
										{importProgress.message}
									</Text>
									<View
										style={[
											styles.progressTrack,
											{ backgroundColor: colors.surfaceContainerHighest },
										]}
									>
										<View
											style={[
												styles.progressFill,
												{
													backgroundColor: colors.primary,
													width: `${importPercent}%`,
												},
											]}
										/>
									</View>
									<Text
										style={[
											styles.importStatusMeta,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{importProgress.processedItems} / {importProgress.totalItems}{" "}
										items ({importPercent}%)
									</Text>
									<Text
										style={[
											styles.importStatusMeta,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Batch {importProgress.currentBatch} of{" "}
										{importProgress.totalBatches}. Imported{" "}
										{importProgress.imported}, skipped{" "}
										{importProgress.skipped}, failed {importProgress.failed}.
									</Text>
								</View>
							) : traktPreview ? (
								<View
									style={[
										styles.previewCard,
										{
											backgroundColor: colors.surfaceContainerHigh,
											borderColor: colors.outlineVariant,
										},
									]}
								>
									<View style={styles.previewHeaderRow}>
										<View style={styles.previewHeaderText}>
											<Text
												style={[
													styles.previewKicker,
													{ color: colors.primary },
												]}
											>
												Trakt profile
											</Text>
											<Text
												style={[
													styles.previewTitle,
													{ color: colors.onSurface },
												]}
											>
												{traktPreview.profile.name ??
													`@${traktPreview.profile.username}`}
											</Text>
											<Text
												style={[
													styles.previewSubtitle,
													{ color: colors.onSurfaceVariant },
												]}
											>
												@{traktPreview.profile.username}
												{traktPreview.profile.isVip ? " • VIP" : ""}
												{traktPreview.profile.isPrivate
													? " • Private"
													: ""}
											</Text>
										</View>
										<View style={styles.previewCountWrap}>
											<Text
												style={[
													styles.previewCountLabel,
													{ color: colors.onSurfaceVariant },
												]}
											>
												Ready to import
											</Text>
											<Text
												style={[
													styles.previewCountValue,
													{ color: colors.primary },
												]}
											>
												{traktPreview.importableCount}
											</Text>
										</View>
									</View>

									<View style={styles.previewListWrap}>
										<Text
											style={[
												styles.previewSectionLabel,
												{ color: colors.onSurfaceVariant },
											]}
										>
											Last played items
										</Text>
										{traktPreview.previewItems.length > 0 ? (
											traktPreview.previewItems.map((item) => (
												<View
													key={`${item.type}-${item.watchedAt}-${item.title}`}
													style={[
														styles.previewItem,
														{
															backgroundColor: colors.surface,
															borderColor: colors.outlineVariant,
														},
													]}
												>
													<View style={styles.previewItemText}>
														<Text
															style={[
																styles.previewItemTitle,
																{ color: colors.onSurface },
															]}
														>
															{item.title}
														</Text>
														{item.subtitle ? (
															<Text
																style={[
																	styles.previewItemSubtitle,
																	{ color: colors.onSurfaceVariant },
																]}
															>
																{item.subtitle}
															</Text>
														) : null}
													</View>
													<Text
														style={[
															styles.previewItemDate,
															{ color: colors.onSurfaceVariant },
														]}
													>
														{formatPreviewDate(item.watchedAt)}
													</Text>
												</View>
											))
										) : (
											<Text
												style={[
													styles.csvHelp,
													{ color: colors.onSurfaceVariant },
												]}
											>
												No importable watch items were found for this profile.
											</Text>
										)}
									</View>

										<Button
											onPress={onTraktImportConfirm}
											disabled={isImportBusy || traktPreview.importableCount < 1}
										>
											{`Import ${traktPreview.importableCount} item${traktPreview.importableCount === 1 ? "" : "s"}`}
										</Button>
								</View>
							) : null}
						</View>
					) : (
						<View style={styles.formStack}>
							<Pressable
								onPress={onCsvImport}
								disabled={isImportBusy}
								style={[
									styles.csvButton,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surface,
										opacity: isImportBusy ? 0.6 : 1,
									},
								]}
							>
								<FileSpreadsheet size={18} color={colors.primary} />
								<Text style={[styles.csvButtonText, { color: colors.onSurface }]}>
									{isImportBusy ? "Import in progress" : "Select Trakt CSV file"}
								</Text>
							</Pressable>
							{csvFileName ? (
								<Text style={[styles.csvFileName, { color: colors.onSurfaceVariant }]}>Selected: {csvFileName}</Text>
							) : null}
							<Text style={[styles.csvHelp, { color: colors.onSurfaceVariant }]}>Use Trakt export columns: watched_at, action, type, tmdb_id, season_number, episode_number.</Text>
						</View>
					)}

					<View style={styles.actionsRow}>
						<Button variant="text" onPress={onBack} disabled={isImportBusy}>
							Back
						</Button>
						<Button variant="text" onPress={onSkip} disabled={isImportBusy || isCompleting}>
							{isCompleting ? "Finishing..." : "Skip import"}
						</Button>
					</View>
				</View>
			</CardContent>
		</Card>
	);
}

function formatPreviewDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

function getFollowImportMessage(
	status: FollowImportStatus,
	result: FollowImportResult | null,
) {
	if (status === "error") {
		return "We could not import your Bluesky following right now.";
	}

	if (status !== "success" || !result) {
		return null;
	}

	if (result.createdCount > 0) {
		return `Followed ${result.createdCount} Bluesky friend${result.createdCount === 1 ? "" : "s"} on OpnShelf.`;
	}

	if (result.alreadyFollowingCount > 0) {
		return "Your Bluesky follows are already synced.";
	}

	if (result.matchedCount === 0) {
		return "None of the people you follow on Bluesky are on OpnShelf yet.";
	}

	return null;
}

export function LaunchStepCard({
	followImportResult,
	importResult,
	isCompleting,
	onComplete,
}: {
	followImportResult: FollowImportResult | null;
	importResult: OnboardingImportResult;
	isCompleting: boolean;
	onComplete: () => void;
}) {
	const { colors } = useTheme();

	return (
		<Card>
			<CardHeader>
				<Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Launch</Text>
				<Text style={[styles.sectionBody, { color: colors.onSurfaceVariant }]}>You are all set. Your shelf is ready for tracking.</Text>
			</CardHeader>
			<CardContent>
				{followImportResult?.createdCount ? (
					<Text style={[styles.csvHelp, { color: colors.onSurfaceVariant }]}>
						You&apos;re already connected to {followImportResult.createdCount}{" "}
						friend{followImportResult.createdCount === 1 ? "" : "s"} from
						Bluesky.
					</Text>
				) : null}
				<View style={styles.metricsRow}>
					<MetricCard label="Imported" value={importResult.imported} />
					<MetricCard label="Skipped" value={importResult.skipped} />
					<MetricCard label="Failed" value={importResult.failed} />
				</View>

				{importResult.errors.length > 0 && (
					<View
						style={[
							styles.errorBox,
							{
								backgroundColor: `${colors.error}20`,
								borderColor: colors.error,
							},
						]}
					>
						<Text style={[styles.errorTitle, { color: colors.error }]}>Import errors</Text>
						<ScrollView style={styles.errorScroll} nestedScrollEnabled>
							{importResult.errors.map((error) => (
								<Text key={error} style={[styles.errorItem, { color: colors.error }]}>• {error}</Text>
							))}
						</ScrollView>
					</View>
				)}

				<View style={styles.actionsRow}>
					<Button onPress={onComplete} disabled={isCompleting}>
						{isCompleting ? "Finishing..." : "Open dashboard"}
					</Button>
				</View>
			</CardContent>
		</Card>
	);
}

function MetricCard({ label, value }: { label: string; value: number }) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.metricCard,
				{
					backgroundColor: colors.surfaceContainerHigh,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			<Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
			<Text style={[styles.metricValue, { color: colors.primary }]}>{value}</Text>
		</View>
	);
}
