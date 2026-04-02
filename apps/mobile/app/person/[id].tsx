import { Ionicons } from "@expo/vector-icons";
import type {
	PersonFilmographyItemDto,
	TmdbPersonDetailDto,
} from "@opnshelf/api";
import { peopleControllerGetPersonDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import {
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailHero } from "@/components/detail";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useScrollRevealHeader } from "@/hooks/useScrollRevealHeader";
import { getTmdbPosterUrl } from "@/lib/utils";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w92";

function formatDate(dateString?: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function formatLifespan(birthday?: string, deathday?: string): string | null {
	if (!birthday) return null;
	const birthYear = new Date(birthday).getFullYear();
	if (deathday) {
		const deathYear = new Date(deathday).getFullYear();
		return `${birthYear} - ${deathYear}`;
	}
	return `${birthYear} - Present`;
}

export default function PersonDetailScreen() {
	const { id: personId } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { colors } = useTheme();
	const { showCompactHeader, onScroll } = useScrollRevealHeader();

	const {
		data: personData,
		isLoading,
		isRefetching,
		refetch,
	} = useQuery({
		...peopleControllerGetPersonDetailsOptions({
			path: { personId },
		}),
	});

	const person = personData as TmdbPersonDetailDto | undefined;

	const profileUrl = person?.profile_path
		? `${POSTER_BASE_URL}${person.profile_path}`
		: null;

	const subtitle = useMemo(() => {
		const lifespan = formatLifespan(person?.birthday, person?.deathday);
		if (person?.known_for_department && lifespan) {
			return `${person.known_for_department} • ${lifespan}`;
		}
		if (person?.known_for_department) {
			return person.known_for_department;
		}
		if (lifespan) {
			return lifespan;
		}
		return undefined;
	}, [person?.birthday, person?.deathday, person?.known_for_department]);

	const handleRefresh = async () => {
		await refetch();
	};

	const handleNavigateToMedia = (item: PersonFilmographyItemDto) => {
		if (item.media_type === "movie") {
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: String(item.id),
					title: item.title,
				},
			});
		} else {
			router.push({
				pathname: "/show/[id]",
				params: {
					id: String(item.id),
					title: item.title,
				},
			});
		}
	};

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				onScroll={onScroll}
				scrollEventThrottle={16}
				refreshControl={
					<RefreshControl
						refreshing={isRefetching}
						onRefresh={handleRefresh}
						tintColor={colors.primary}
						colors={[colors.primary]}
						progressBackgroundColor={colors.surfaceContainerHigh}
					/>
				}
			>
				<DetailHero
					title={person?.name || "Person"}
					subtitle={subtitle}
					backdropUrl={null}
					posterUrl={profileUrl}
					colors={{
						primary: colors.primary,
						secondary: colors.secondary,
						accent: colors.tertiary,
						muted: colors.surfaceContainerHighest,
					}}
					onBack={() => router.back()}
					isLoading={isLoading}
				/>

				<View style={styles.content}>
					{/* Personal Info Section */}
					<View
						style={[
							styles.infoCard,
							{ backgroundColor: colors.surfaceContainer },
						]}
					>
						<Text style={[styles.infoTitle, { color: colors.primary }]}>
							Personal Info
						</Text>
						<View style={styles.infoItems}>
							{person?.birthday && (
								<View style={styles.infoItem}>
									<Ionicons
										name="calendar-outline"
										size={16}
										color={colors.onSurfaceVariant}
									/>
									<Text
										style={[
											styles.infoText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{person.deathday
											? `Born: ${formatDate(person.birthday)}`
											: `Birthday: ${formatDate(person.birthday)}`}
									</Text>
								</View>
							)}
							{person?.deathday && (
								<View style={styles.infoItem}>
									<Ionicons
										name="calendar-outline"
										size={16}
										color={colors.onSurfaceVariant}
									/>
									<Text
										style={[
											styles.infoText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Died: {formatDate(person.deathday)}
									</Text>
								</View>
							)}
							{person?.place_of_birth && (
								<View style={styles.infoItem}>
									<Ionicons
										name="location-outline"
										size={16}
										color={colors.onSurfaceVariant}
									/>
									<Text
										style={[
											styles.infoText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{person.place_of_birth}
									</Text>
								</View>
							)}
							{person?.popularity !== undefined && (
								<View style={styles.infoItem}>
									<Ionicons
										name="star-outline"
										size={16}
										color={colors.onSurfaceVariant}
									/>
									<Text
										style={[
											styles.infoText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Popularity: {person.popularity.toFixed(1)}
									</Text>
								</View>
							)}
						</View>
					</View>

					{/* Biography Section */}
					{person?.biography && (
						<View style={styles.section}>
							<Text style={[styles.sectionTitle, { color: colors.primary }]}>
								Biography
							</Text>
							<Text
								style={[styles.biography, { color: colors.onSurfaceVariant }]}
							>
								{person.biography}
							</Text>
						</View>
					)}

					{/* Filmography Section */}
					<View style={styles.section}>
						<Text style={[styles.sectionTitle, { color: colors.primary }]}>
							Filmography
							<Text style={[styles.count, { color: colors.onSurfaceVariant }]}>
								{" "}
								({person?.filmography?.length || 0} titles)
							</Text>
						</Text>
						<View style={styles.filmographyList}>
							{person?.filmography?.map((item) => (
								<FilmographyItem
									key={`${item.media_type}-${item.id}-${item.character || item.job || ""}`}
									item={item}
									onPress={() => handleNavigateToMedia(item)}
									colors={colors}
								/>
							))}
						</View>
					</View>
				</View>
			</ScrollView>

			<ScrollRevealHeader
				visible={showCompactHeader}
				onBack={() => router.back()}
				title={person?.name || "Person"}
			/>
		</SafeAreaView>
	);
}

interface FilmographyItemProps {
	item: PersonFilmographyItemDto;
	onPress: () => void;
	colors: {
		surfaceContainer: string;
		onSurface: string;
		onSurfaceVariant: string;
		outline: string;
		primary: string;
	};
}

function FilmographyItem({ item, onPress, colors }: FilmographyItemProps) {
	const year = item.release_date
		? new Date(item.release_date).getFullYear()
		: item.first_air_date
			? new Date(item.first_air_date).getFullYear()
			: null;

	const posterUrl = getTmdbPosterUrl(item.poster_path, "w92");

	return (
		<TouchableOpacity
			onPress={onPress}
			style={[
				styles.filmographyItem,
				{ backgroundColor: colors.surfaceContainer },
			]}
			activeOpacity={0.8}
		>
			{/* Poster */}
			<View style={styles.posterContainer}>
				{posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
					/>
				) : (
					<View
						style={[
							styles.posterPlaceholder,
							{ backgroundColor: colors.surfaceContainer },
						]}
					>
						<Ionicons
							name={item.media_type === "movie" ? "film-outline" : "tv-outline"}
							size={24}
							color={colors.onSurfaceVariant}
						/>
					</View>
				)}
			</View>

			{/* Info */}
			<View style={styles.filmographyInfo}>
				<Text
					style={[styles.filmographyTitle, { color: colors.onSurface }]}
					numberOfLines={1}
				>
					{item.title}
				</Text>
				<Text
					style={[styles.filmographyRole, { color: colors.onSurfaceVariant }]}
					numberOfLines={1}
				>
					{item.character || item.job || ""}
					{(item.character || item.job) && item.department && (
						<Text style={{ color: colors.outline }}> • </Text>
					)}
					{item.department}
				</Text>
			</View>

			{/* Type Badge & Year */}
			<View style={styles.filmographyMeta}>
				<View
					style={[
						styles.typeBadge,
						{ backgroundColor: colors.surfaceContainer },
					]}
				>
					<Text
						style={[styles.typeBadgeText, { color: colors.onSurfaceVariant }]}
					>
						{item.media_type === "movie" ? "Movie" : "TV"}
					</Text>
				</View>
				{year && (
					<Text style={[styles.yearText, { color: colors.primary }]}>
						{year}
					</Text>
				)}
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: spacing.xxl,
	},
	content: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.lg,
		gap: spacing.lg,
	},
	infoCard: {
		padding: spacing.md,
		borderRadius: borderRadius.lg,
	},
	infoTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: spacing.sm,
	},
	infoItems: {
		gap: spacing.xs,
	},
	infoItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	infoText: {
		fontSize: 14,
	},
	section: {
		gap: spacing.sm,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	count: {
		fontSize: 14,
		fontWeight: "normal",
	},
	biography: {
		fontSize: 15,
		lineHeight: 22,
	},
	filmographyList: {
		gap: spacing.sm,
	},
	filmographyItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: spacing.sm,
		borderRadius: borderRadius.md,
	},
	posterContainer: {
		width: 48,
		height: 72,
		borderRadius: borderRadius.sm,
		overflow: "hidden",
		marginRight: spacing.md,
	},
	poster: {
		width: 48,
		height: 72,
	},
	posterPlaceholder: {
		width: 48,
		height: 72,
		justifyContent: "center",
		alignItems: "center",
	},
	filmographyInfo: {
		flex: 1,
		justifyContent: "center",
	},
	filmographyTitle: {
		fontSize: 14,
		fontWeight: "500",
		marginBottom: 2,
	},
	filmographyRole: {
		fontSize: 12,
	},
	filmographyMeta: {
		alignItems: "flex-end",
		gap: spacing.xs,
	},
	typeBadge: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 4,
		borderRadius: borderRadius.full,
	},
	typeBadgeText: {
		fontSize: 11,
		fontWeight: "500",
	},
	yearText: {
		fontSize: 13,
		fontWeight: "600",
	},
});
