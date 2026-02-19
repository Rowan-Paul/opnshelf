import { Ionicons } from "@expo/vector-icons";
import {
	authControllerMeOptions,
	type EpisodeHistoryItemDto,
	listsControllerGetListsForItemOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetShowWatchHistoryQueryKey,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbEpisodeDto,
	type TmdbSeasonDetailDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { DatePickerModal, TimePickerModal } from "react-native-paper-dates";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddToListModal } from "@/components/AddToListModal";
import { Button } from "@/components/ui/Button";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	getTmdbBackdropUrl,
	getTmdbPosterUrl,
	getTmdbProfileUrl,
} from "@/lib/utils";

function formatWatchDate(
	dateString: string,
	timezone: string,
	is24Hour: boolean,
): string {
	return new Date(dateString).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: !is24Hour,
		timeZone: timezone,
	});
}

function formatDateOnly(dateString?: string): string {
	if (!dateString) return "Unknown";
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function ShowEpisodeScreen() {
	const { id, seasonNumber, episodeNumber, title } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		episodeNumber: string;
		title?: string;
	}>();
	const router = useRouter();
	const { colors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [showDateModal, setShowDateModal] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showTimePicker, setShowTimePicker] = useState(false);
	const [customDate, setCustomDate] = useState(new Date());
	const [showAddToListModal, setShowAddToListModal] = useState(false);
	const [showHistoryModal, setShowHistoryModal] = useState(false);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const { data: showData } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const { data } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
	});
	const episode = data as TmdbEpisodeDto | undefined;

	const { data: seasonData } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
	});
	const season = seasonData as TmdbSeasonDetailDto | undefined;

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId: id },
		}),
		enabled: !!resolvedUserDid,
	});

	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!resolvedUserDid,
	});

	const { data: listsForShow } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType: "show", mediaId: id },
		}),
		enabled: !!resolvedUserDid,
	});

	const showColors = showData?.colors || {
		primary: colors.primary,
		secondary: colors.secondary,
		accent: colors.tertiary,
		muted: colors.surfaceContainer,
	};
	const backdropUrl = getTmdbBackdropUrl(
		episode?.still_path || showData?.backdrop_path,
	);
	const posterUrl = getTmdbPosterUrl(showData?.poster_path, "w500");

	const userTimezone = userSettings?.timezone || "UTC";
	const is24Hour = userSettings?.timeFormat === "24h";
	const listsCount = listsForShow?.filter((list) => list.isInList).length ?? 0;
	const isInAnyList = listsCount > 0;

	const episodeWatchHistory = useMemo(() => {
		if (!history?.length) return [];
		return history
			.filter(
				(item) =>
					item.seasonNumber === Number(seasonNumber) &&
					item.episodeNumber === Number(episodeNumber),
			)
			.sort(
				(a, b) =>
					new Date(b.watchedDate).getTime() - new Date(a.watchedDate).getTime(),
			);
	}, [history, seasonNumber, episodeNumber]);
	const latestEpisodeWatch = episodeWatchHistory[0] || null;
	const watchedCount = episodeWatchHistory.length;
	const isWatchedEpisode = watchedCount > 0;

	const seasonEpisodeContext = useMemo(() => {
		if (!season?.episodes?.length) {
			return { previous: null, current: null, next: null };
		}

		const sortedEpisodes = [...season.episodes].sort(
			(a, b) => a.episode_number - b.episode_number,
		);
		const currentIndex = sortedEpisodes.findIndex(
			(item) => item.episode_number === Number(episodeNumber),
		);
		if (currentIndex < 0) {
			return { previous: null, current: null, next: null };
		}

		return {
			previous: sortedEpisodes[currentIndex - 1] ?? null,
			current: sortedEpisodes[currentIndex] ?? null,
			next: sortedEpisodes[currentIndex + 1] ?? null,
		};
	}, [season?.episodes, episodeNumber]);

	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			setShowDateModal(false);
			showToast("Added to your shelf", "success");
		},
		onError: () => {
			showToast("Failed to add. Please try again.", "error");
		},
	});

	const unmarkMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove from shelf. Please try again.", "error");
		},
	});

	const deleteWatchEntryMutation = useMutation({
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: showsControllerGetShowWatchHistoryQueryKey({
					path: { userDid: resolvedUserDid, showId: id },
				}),
			});
			showToast("Watch entry removed", "success");
		},
		onError: () => {
			showToast("Failed to remove watch entry. Please try again.", "error");
		},
	});

	const isPending =
		markMutation.isPending &&
		markMutation.variables?.body?.showId === id &&
		markMutation.variables?.body?.seasonNumber === Number(seasonNumber) &&
		markMutation.variables?.body?.episodeNumber === Number(episodeNumber);

	const handleMarkWatched = () => {
		markMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
			},
		});
	};

	const handleMarkWatchedWithDate = () => {
		markMutation.mutate({
			body: {
				showId: id,
				seasonNumber: Number(seasonNumber),
				episodeNumber: Number(episodeNumber),
				watchedAt: customDate.toISOString(),
			},
		});
	};

	const handleUnmarkWatched = () => {
		unmarkMutation.mutate({
			path: { showId: id },
			query: {
				mode: "all",
				seasonNumber,
				episodeNumber,
			},
		});
	};

	const handleShare = async () => {
		try {
			await Share.share({
				title: `Check out S${seasonNumber}E${episodeNumber} of ${showData?.name || title || "this show"}`,
				url: `https://opnshelf.xyz/show/${id}/${seasonNumber}/${episodeNumber}`,
			});
		} catch {
			showToast("Failed to share", "error");
		}
	};

	const handleOpenDateModal = () => {
		setCustomDate(new Date());
		setShowDateModal(true);
	};

	const navigateToEpisode = (targetEpisode: TmdbEpisodeDto) => {
		router.push({
			pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
			params: {
				id,
				seasonNumber,
				episodeNumber: String(targetEpisode.episode_number),
				title: title || "",
			},
		});
	};

	const contextCards: Array<{
		key: string;
		label: string;
		episode: TmdbEpisodeDto | null;
		highlighted: boolean;
		iconName: "arrow-back" | "radio-button-on" | "arrow-forward";
	}> = [
		{
			key: "previous",
			label: "Previous Episode",
			episode: seasonEpisodeContext.previous,
			highlighted: false,
			iconName: "arrow-back",
		},
		{
			key: "current",
			label: "Current Episode",
			episode: seasonEpisodeContext.current,
			highlighted: true,
			iconName: "radio-button-on",
		},
		{
			key: "next",
			label: "Next Episode",
			episode: seasonEpisodeContext.next,
			highlighted: false,
			iconName: "arrow-forward",
		},
	];

	return (
		<>
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
			>
				<ScrollView contentContainerStyle={styles.scrollContent}>
					<View style={styles.heroWrapper}>
						{backdropUrl ? (
							<Image
								source={{ uri: backdropUrl }}
								style={styles.backdrop}
								contentFit="cover"
							/>
						) : (
							<View
								style={[
									styles.backdrop,
									{
										backgroundColor: showColors.muted || colors.surfaceVariant,
									},
								]}
							/>
						)}
						<LinearGradient
							colors={[
								"rgba(0,0,0,0.2)",
								"rgba(0,0,0,0.75)",
								colors.background,
							]}
							style={styles.backdropOverlay}
						/>
						<TouchableOpacity
							onPress={() => router.back()}
							style={styles.backButton}
							activeOpacity={0.8}
						>
							<Ionicons name="arrow-back" size={24} color="#f9fafb" />
						</TouchableOpacity>
						<View style={styles.heroOverlay}>
							<TouchableOpacity
								style={[
									styles.posterWrapper,
									{ shadowColor: showColors.primary || colors.primary },
								]}
								onPress={() =>
									router.push({ pathname: "/show/[id]", params: { id } })
								}
								activeOpacity={0.8}
							>
								{posterUrl ? (
									<Image
										source={{ uri: posterUrl }}
										style={styles.poster}
										contentFit="cover"
									/>
								) : (
									<View
										style={[
											styles.poster,
											styles.noPoster,
											{ backgroundColor: colors.surfaceContainer },
										]}
									>
										<Text
											style={[
												styles.noPosterText,
												{ color: colors.onSurfaceVariant },
											]}
										>
											No poster
										</Text>
									</View>
								)}
							</TouchableOpacity>
							<View style={styles.titleWrapper}>
								<Text
									style={[
										styles.title,
										{ textShadowColor: showColors.primary },
									]}
									numberOfLines={2}
								>
									{showData?.name || title || "Show"}
								</Text>
								<Text style={[styles.subtitle, { color: "#f9fafb" }]}>
									S{seasonNumber} · E{episodeNumber}
								</Text>
								<Text style={[styles.heroEpisodeName, { color: "#d1d5db" }]}>
									{episode?.name}
								</Text>
							</View>
						</View>
					</View>

					<View style={styles.content}>
						<View style={styles.metaRow}>
							<View
								style={[
									styles.metaPill,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surfaceContainer,
									},
								]}
							>
								<Ionicons
									name="layers-outline"
									size={14}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.metaText, { color: colors.onSurfaceVariant }]}
								>
									S{seasonNumber}
								</Text>
							</View>
							<View
								style={[
									styles.metaPill,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surfaceContainer,
									},
								]}
							>
								<Ionicons
									name="film-outline"
									size={14}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.metaText, { color: colors.onSurfaceVariant }]}
								>
									E{episodeNumber}
								</Text>
							</View>
							<View
								style={[
									styles.metaPill,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surfaceContainer,
									},
								]}
							>
								<Ionicons
									name="calendar-outline"
									size={14}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.metaText, { color: colors.onSurfaceVariant }]}
								>
									{formatDateOnly(episode?.air_date)}
								</Text>
							</View>
							<View
								style={[
									styles.metaPill,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surfaceContainer,
									},
								]}
							>
								<Ionicons
									name="star-outline"
									size={14}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.metaText, { color: colors.onSurfaceVariant }]}
								>
									{episode?.vote_average
										? `${episode.vote_average.toFixed(1)}/10`
										: "Not rated"}
								</Text>
							</View>
						</View>

						<Text style={[styles.overview, { color: colors.onSurfaceVariant }]}>
							{episode?.overview || "No overview available."}
						</Text>

						<View style={styles.actions}>
							{user ? (
								<>
									<TouchableOpacity
										onPress={handleMarkWatched}
										disabled={isPending}
										activeOpacity={0.8}
										style={{ opacity: isPending ? 0.7 : 1 }}
									>
										<LinearGradient
											colors={[
												showColors.primary || colors.primary,
												showColors.secondary || colors.primary,
											]}
											start={{ x: 0, y: 0 }}
											end={{ x: 1, y: 1 }}
											style={styles.primaryAction}
										>
											{isPending ? (
												<ActivityIndicator
													size="small"
													color={colors.onPrimary}
												/>
											) : (
												<>
													<Ionicons
														name={isWatchedEpisode ? "refresh" : "add"}
														size={18}
														color={colors.onPrimary}
													/>
													<Text
														style={[
															styles.primaryActionText,
															{ color: colors.onPrimary },
														]}
													>
														{isWatchedEpisode ? "Watch Again" : "Add to Shelf"}
													</Text>
												</>
											)}
										</LinearGradient>
									</TouchableOpacity>

									<TouchableOpacity
										onPress={handleOpenDateModal}
										activeOpacity={0.8}
										style={[
											styles.secondaryAction,
											{
												backgroundColor: colors.surfaceContainer,
												borderColor: colors.outline,
											},
										]}
									>
										<Ionicons
											name="calendar-outline"
											size={18}
											color={colors.onSurfaceVariant}
										/>
										<Text
											style={[
												styles.secondaryActionText,
												{ color: colors.onSurfaceVariant },
											]}
										>
											Watch on different date
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										onPress={() => setShowAddToListModal(true)}
										activeOpacity={0.8}
										style={[
											styles.secondaryAction,
											{
												backgroundColor: isInAnyList
													? `${colors.primary}20`
													: colors.surfaceContainer,
												borderColor: isInAnyList
													? colors.primary
													: colors.outline,
											},
										]}
									>
										<Ionicons
											name={isInAnyList ? "checkmark" : "list-outline"}
											size={18}
											color={
												isInAnyList ? colors.primary : colors.onSurfaceVariant
											}
										/>
										<Text
											style={[
												styles.secondaryActionText,
												{
													color: isInAnyList
														? colors.primary
														: colors.onSurfaceVariant,
												},
											]}
										>
											{isInAnyList
												? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
												: "Add to List"}
										</Text>
									</TouchableOpacity>
								</>
							) : (
								<Button onPress={() => router.push("/login")}>
									<Text style={{ color: colors.onPrimary }}>
										Sign in to Track
									</Text>
								</Button>
							)}

							<TouchableOpacity
								onPress={handleShare}
								activeOpacity={0.8}
								style={[
									styles.secondaryAction,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outline,
									},
								]}
							>
								<Ionicons
									name="share-outline"
									size={18}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.secondaryActionText,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Share
								</Text>
							</TouchableOpacity>
						</View>

						{isWatchedEpisode && (
							<View
								style={[
									styles.watchedCard,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outline,
									},
								]}
							>
								<View style={styles.watchedHeader}>
									<Ionicons
										name="checkmark-circle"
										size={20}
										color={colors.primary}
									/>
									<Text
										style={[styles.watchedTitle, { color: colors.primary }]}
									>
										On Your Shelf
									</Text>
								</View>
								{latestEpisodeWatch && (
									<Text
										style={[
											styles.watchedDate,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Watched on{" "}
										{formatWatchDate(
											latestEpisodeWatch.watchedDate,
											userTimezone,
											is24Hour,
										)}
									</Text>
								)}
								{watchedCount > 1 ? (
									<TouchableOpacity
										onPress={() => setShowHistoryModal(true)}
										activeOpacity={0.7}
										style={styles.linkRow}
									>
										<Ionicons
											name="eye-outline"
											size={16}
											color={colors.onSurfaceVariant}
										/>
										<Text
											style={[
												styles.linkText,
												{ color: colors.onSurfaceVariant },
											]}
										>
											View all watches ({watchedCount})
										</Text>
									</TouchableOpacity>
								) : (
									<TouchableOpacity
										onPress={handleUnmarkWatched}
										disabled={unmarkMutation.isPending}
										activeOpacity={0.7}
										style={styles.linkRow}
									>
										{unmarkMutation.isPending ? (
											<ActivityIndicator size="small" color={colors.error} />
										) : (
											<Ionicons
												name="trash-outline"
												size={16}
												color={colors.error}
											/>
										)}
										<Text style={[styles.linkText, { color: colors.error }]}>
											Remove from shelf
										</Text>
									</TouchableOpacity>
								)}
							</View>
						)}

						{seasonEpisodeContext.current ? (
							<View style={styles.contextSection}>
								<Text
									style={[styles.sectionTitle, { color: colors.onSurface }]}
								>
									More In This Season
								</Text>
								<View style={styles.contextList}>
									{contextCards.map((slot) => {
										if (!slot.episode) return null;
										return (
											<TouchableOpacity
												key={slot.key}
												onPress={() =>
													navigateToEpisode(slot.episode as TmdbEpisodeDto)
												}
												activeOpacity={0.8}
												style={[
													styles.contextCard,
													{
														backgroundColor: slot.highlighted
															? `${colors.primary}20`
															: colors.surfaceContainer,
														borderColor: slot.highlighted
															? colors.primary
															: colors.outline,
													},
												]}
											>
												<View style={styles.contextLabelRow}>
													<Ionicons
														name={slot.iconName}
														size={14}
														color={colors.onSurfaceVariant}
													/>
													<Text
														style={[
															styles.contextLabel,
															{ color: colors.onSurfaceVariant },
														]}
													>
														{slot.label}
													</Text>
												</View>
												<Text
													style={[
														styles.contextTitle,
														{ color: colors.onSurface },
													]}
													numberOfLines={1}
												>
													E{slot.episode.episode_number}: {slot.episode.name}
												</Text>
												<Text
													style={[
														styles.contextDate,
														{ color: colors.onSurfaceVariant },
													]}
												>
													{formatDateOnly(slot.episode.air_date)}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
						) : null}

						{showData?.credits?.cast && showData.credits.cast.length > 0 ? (
							<View style={styles.section}>
								<Text
									style={[
										styles.sectionTitle,
										{ color: showColors.primary || colors.primary },
									]}
								>
									Cast
								</Text>
								<View style={styles.castContainer}>
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerStyle={styles.castScrollContent}
									>
										{showData.credits.cast.map((person) => {
											const profileUrl = getTmdbProfileUrl(person.profile_path);
											return (
												<TouchableOpacity
													key={person.id}
													style={styles.castCard}
													activeOpacity={0.8}
												>
													<View style={styles.castImageContainer}>
														{profileUrl ? (
															<Image
																source={{ uri: profileUrl }}
																style={styles.castImage}
																contentFit="cover"
															/>
														) : (
															<View style={styles.castImagePlaceholder}>
																<Text style={styles.castImagePlaceholderText}>
																	No photo
																</Text>
															</View>
														)}
													</View>
													<Text style={styles.castName} numberOfLines={2}>
														{person.name}
													</Text>
													{person.character ? (
														<Text
															style={styles.castCharacter}
															numberOfLines={2}
														>
															as {person.character}
														</Text>
													) : null}
												</TouchableOpacity>
											);
										})}
									</ScrollView>
									<LinearGradient
										colors={["rgba(3, 7, 18, 0)", "rgba(3, 7, 18, 1)"]}
										start={{ x: 0, y: 0.5 }}
										end={{ x: 1, y: 0.5 }}
										style={styles.castGradient}
									/>
								</View>
							</View>
						) : null}

						{showData?.credits?.crew && showData.credits.crew.length > 0 ? (
							<View style={styles.section}>
								<Text
									style={[
										styles.sectionTitle,
										{ color: showColors.primary || colors.primary },
									]}
								>
									Crew
								</Text>
								<View style={styles.crewGrid}>
									{showData.credits.crew.map((person) => (
										<TouchableOpacity
											key={`${person.id}-${person.job || "crew"}`}
											style={styles.crewCard}
											activeOpacity={0.8}
										>
											<Text style={styles.crewName} numberOfLines={1}>
												{person.name}
											</Text>
											<Text style={styles.crewJob} numberOfLines={1}>
												{person.job || person.department || "Crew"}
											</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
						) : null}
					</View>
				</ScrollView>
			</SafeAreaView>

			<Modal
				visible={showDateModal}
				animationType="fade"
				transparent={true}
				onRequestClose={() => setShowDateModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalContent,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<View style={styles.modalHeader}>
							<Text style={[styles.modalTitle, { color: colors.onSurface }]}>
								Watch Again
							</Text>
							<Pressable onPress={() => setShowDateModal(false)}>
								<Ionicons name="close" size={24} color={colors.onSurface} />
							</Pressable>
						</View>
						<Text
							style={[
								styles.modalDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							When did you watch this?
						</Text>

						<View style={styles.dateTimeContainer}>
							<TouchableOpacity
								onPress={() => setShowDatePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="calendar-outline"
									size={20}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.dateTimeText, { color: colors.onSurface }]}
								>
									{customDate.toLocaleDateString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
									})}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => setShowTimePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="time-outline"
									size={20}
									color={colors.onSurfaceVariant}
								/>
								<Text
									style={[styles.dateTimeText, { color: colors.onSurface }]}
								>
									{customDate.toLocaleTimeString("en-US", {
										hour: "2-digit",
										minute: "2-digit",
										hour12: !is24Hour,
									})}
								</Text>
							</TouchableOpacity>
						</View>

						<DatePickerModal
							visible={showDatePicker}
							mode="single"
							date={customDate}
							locale="en"
							onDismiss={() => setShowDatePicker(false)}
							onConfirm={(params) => {
								setShowDatePicker(false);
								if (params.date) {
									const newDate = new Date(customDate);
									newDate.setFullYear(params.date.getFullYear());
									newDate.setMonth(params.date.getMonth());
									newDate.setDate(params.date.getDate());
									setCustomDate(newDate);
									setShowTimePicker(true);
								}
							}}
						/>

						<TimePickerModal
							visible={showTimePicker}
							hours={customDate.getHours()}
							minutes={customDate.getMinutes()}
							locale="en"
							use24HourClock={is24Hour}
							onDismiss={() => setShowTimePicker(false)}
							onConfirm={(params) => {
								const newDate = new Date(customDate);
								newDate.setHours(params.hours);
								newDate.setMinutes(params.minutes);
								setCustomDate(newDate);
								setShowTimePicker(false);
							}}
						/>

						<View style={styles.modalActionsSplit}>
							<Button
								variant="outlined"
								onPress={() => setShowDateModal(false)}
							>
								<Text
									style={[
										styles.modalCancelText,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Cancel
								</Text>
							</Button>
							<Button
								onPress={handleMarkWatchedWithDate}
								isLoading={markMutation.isPending}
								style={{ backgroundColor: colors.primary }}
							>
								<Text
									style={[styles.modalConfirmText, { color: colors.onPrimary }]}
								>
									Add Watch
								</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>

			<Modal
				visible={showHistoryModal}
				animationType="fade"
				transparent={true}
				onRequestClose={() => setShowHistoryModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalContent,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<View style={styles.modalHeader}>
							<Text style={[styles.modalTitle, { color: colors.onSurface }]}>
								Watch History
							</Text>
							<Pressable onPress={() => setShowHistoryModal(false)}>
								<Ionicons name="close" size={24} color={colors.onSurface} />
							</Pressable>
						</View>
						<Text
							style={[
								styles.modalDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							All watches for this episode
						</Text>

						<ScrollView style={styles.historyList}>
							{episodeWatchHistory.length ? (
								episodeWatchHistory.map((watch: EpisodeHistoryItemDto) => (
									<View
										key={watch.id}
										style={[
											styles.historyItem,
											{
												backgroundColor: colors.surfaceContainer,
												borderColor: colors.outline,
											},
										]}
									>
										<Text
											style={[styles.historyDate, { color: colors.onSurface }]}
										>
											{formatWatchDate(
												watch.watchedDate,
												userTimezone,
												is24Hour,
											)}
										</Text>
										<TouchableOpacity
											onPress={() =>
												deleteWatchEntryMutation.mutate({
													path: { trackedEpisodeId: watch.id },
												})
											}
											disabled={deleteWatchEntryMutation.isPending}
											activeOpacity={0.7}
										>
											{deleteWatchEntryMutation.isPending &&
											deleteWatchEntryMutation.variables?.path
												?.trackedEpisodeId === watch.id ? (
												<ActivityIndicator
													size="small"
													color={colors.onSurfaceVariant}
												/>
											) : (
												<Ionicons
													name="trash-outline"
													size={18}
													color={colors.error}
												/>
											)}
										</TouchableOpacity>
									</View>
								))
							) : (
								<Text
									style={[
										styles.emptyHistory,
										{ color: colors.onSurfaceVariant },
									]}
								>
									No watch history found
								</Text>
							)}
						</ScrollView>

						<Button
							variant="outlined"
							onPress={() => setShowHistoryModal(false)}
						>
							<Text
								style={[
									styles.modalCancelText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Close
							</Text>
						</Button>
					</View>
				</View>
			</Modal>

			<AddToListModal
				visible={showAddToListModal}
				onClose={() => setShowAddToListModal(false)}
				mediaType="show"
				mediaId={id}
				mediaTitle={showData?.name || title || "Show"}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollContent: {
		paddingBottom: spacing.xxl,
	},
	heroWrapper: {
		height: 280,
		position: "relative",
	},
	backdrop: {
		width: "100%",
		height: "100%",
	},
	backdropOverlay: {
		...StyleSheet.absoluteFillObject,
	},
	backButton: {
		position: "absolute",
		top: 8,
		left: 16,
		zIndex: 10,
		padding: 8,
		borderRadius: borderRadius.full,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	heroOverlay: {
		position: "absolute",
		bottom: -52,
		left: 16,
		right: 16,
		flexDirection: "row",
		alignItems: "flex-end",
	},
	posterWrapper: {
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.35,
		shadowRadius: 8,
		elevation: 8,
	},
	poster: {
		width: 96,
		height: 144,
	},
	noPoster: {
		alignItems: "center",
		justifyContent: "center",
	},
	noPosterText: {
		fontSize: 11,
	},
	titleWrapper: {
		marginLeft: spacing.md,
		marginBottom: spacing.sm,
		flex: 1,
	},
	content: {
		marginTop: 80,
		paddingHorizontal: 16,
		gap: spacing.md,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: "#f9fafb",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 10,
	},
	subtitle: { fontSize: 17, fontWeight: "700" },
	heroEpisodeName: { fontSize: 14, marginTop: 2 },
	metaRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	metaPill: {
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.sm,
		paddingVertical: 6,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	metaText: { fontSize: 13 },
	overview: { fontSize: 15, lineHeight: 22 },
	actions: {
		gap: spacing.sm,
	},
	primaryAction: {
		borderRadius: borderRadius.md,
		paddingVertical: 14,
		paddingHorizontal: spacing.md,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: spacing.xs,
	},
	primaryActionText: {
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryAction: {
		borderRadius: borderRadius.md,
		borderWidth: 1,
		paddingVertical: 12,
		paddingHorizontal: spacing.md,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: spacing.xs,
	},
	secondaryActionText: {
		fontSize: 15,
		fontWeight: "500",
	},
	watchedCard: {
		marginTop: spacing.sm,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		padding: spacing.md,
		gap: spacing.xs,
	},
	watchedHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	watchedTitle: { fontSize: 16, fontWeight: "600" },
	watchedDate: { fontSize: 14 },
	linkRow: {
		marginTop: spacing.xs,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	linkText: { fontSize: 14, fontWeight: "500" },
	contextSection: { marginTop: spacing.sm, gap: spacing.sm },
	sectionTitle: { fontSize: 18, fontWeight: "600" },
	contextList: { gap: spacing.sm },
	contextCard: {
		borderRadius: borderRadius.md,
		borderWidth: 1,
		padding: spacing.md,
		gap: 6,
	},
	contextLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	contextLabel: {
		fontSize: 11,
		textTransform: "uppercase",
		letterSpacing: 0.3,
	},
	contextTitle: {
		fontSize: 15,
		fontWeight: "600",
	},
	contextDate: { fontSize: 13 },
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalContent: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		maxHeight: "80%",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	modalDescription: {
		fontSize: 14,
		marginBottom: spacing.md,
	},
	dateTimeContainer: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	dateTimeButton: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	dateTimeText: {
		fontSize: 15,
		fontWeight: "500",
	},
	modalActionsSplit: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
	},
	modalCancelText: {
		fontSize: 14,
		fontWeight: "600",
	},
	modalConfirmText: {
		fontSize: 14,
		fontWeight: "600",
	},
	historyList: {
		maxHeight: 320,
		marginBottom: spacing.md,
	},
	historyItem: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		marginBottom: spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	historyDate: {
		fontSize: 14,
		flex: 1,
	},
	emptyHistory: {
		fontSize: 14,
		textAlign: "center",
		paddingVertical: spacing.xl,
	},
	section: {
		marginBottom: 24,
	},
	castContainer: {
		position: "relative",
	},
	castScrollContent: {
		paddingRight: 16,
		gap: 12,
	},
	castGradient: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 16,
		width: 48,
		pointerEvents: "none",
	},
	castCard: {
		width: 100,
	},
	castImageContainer: {
		borderRadius: borderRadius.md,
		overflow: "hidden",
		marginBottom: 8,
		backgroundColor: "#1f2937",
	},
	castImage: {
		width: 100,
		height: 140,
	},
	castImagePlaceholder: {
		width: 100,
		height: 140,
		backgroundColor: "#1f2937",
		justifyContent: "center",
		alignItems: "center",
	},
	castImagePlaceholderText: {
		fontSize: 12,
		color: "#6b7280",
		textAlign: "center",
		paddingHorizontal: 8,
	},
	castName: {
		fontSize: 13,
		fontWeight: "500",
		color: "#e5e7eb",
		marginBottom: 2,
	},
	castCharacter: {
		fontSize: 11,
		color: "#6b7280",
	},
	crewGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	crewCard: {
		backgroundColor: "#111827",
		borderRadius: borderRadius.md,
		padding: 12,
		flex: 1,
		minWidth: "45%",
	},
	crewName: {
		fontSize: 14,
		fontWeight: "500",
		color: "#e5e7eb",
		marginBottom: 2,
	},
	crewJob: {
		fontSize: 12,
		color: "#6b7280",
	},
});
