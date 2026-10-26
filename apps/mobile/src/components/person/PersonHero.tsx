import type { TmdbPersonDetailDto } from "@opnshelf/api";
import { Calendar, Clapperboard, MapPin, User } from "lucide-react-native";
import { View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { profileUrl } from "@/lib/tmdb";
import { useThemeColors } from "@/theme/colors";

function yearOf(date?: string): number | null {
	if (!date) return null;
	const year = new Date(date).getFullYear();
	return Number.isNaN(year) ? null : year;
}

function formatDate(iso?: string): string | undefined {
	if (!iso) return undefined;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * Header for the person detail screen: portrait photo beside the name, a
 * department badge, and a compact meta row (born/died, birthplace). Mirrors the
 * mobile-stacked layout of the web person page.
 */
export function PersonHero({ person }: { person: TmdbPersonDetailDto }) {
	const colors = useThemeColors();
	const url = profileUrl(person.profile_path, "h632");

	const birthYear = yearOf(person.birthday);
	const deathYear = yearOf(person.deathday);
	const age = birthYear
		? (deathYear ?? new Date().getFullYear()) - birthYear
		: null;

	return (
		<View className="px-4 pt-2">
			<View className="flex-row gap-4">
				<View className="h-40 w-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-subtle">
					{url ? (
						<PosterImage url={url} className="h-40 w-28" />
					) : (
						<User color={colors.mutedForeground} size={32} />
					)}
				</View>
				<View className="min-w-0 flex-1 justify-end gap-2 pb-1">
					<Text className="text-display-2 text-foreground">{person.name}</Text>
					{person.known_for_department ? (
						<View className="flex-row">
							<View className="flex-row items-center gap-1 rounded-full bg-primary px-2.5 py-1">
								<Clapperboard color={colors.accentForeground} size={12} />
								<Text className="font-medium text-primary-foreground text-xs">
									{person.known_for_department}
								</Text>
							</View>
						</View>
					) : null}
				</View>
			</View>

			<View className="mt-3 gap-1.5">
				{person.birthday ? (
					<View className="flex-row items-center gap-1.5">
						<Calendar color={colors.mutedForeground} size={14} />
						<Text className="text-muted-foreground text-sm">
							Born {formatDate(person.birthday)}
							{age !== null && !person.deathday ? ` (${age})` : ""}
						</Text>
					</View>
				) : null}
				{person.deathday ? (
					<View className="flex-row items-center gap-1.5">
						<Calendar color={colors.mutedForeground} size={14} />
						<Text className="text-muted-foreground text-sm">
							Died {formatDate(person.deathday)}
							{age !== null ? ` (aged ${age})` : ""}
						</Text>
					</View>
				) : null}
				{person.place_of_birth ? (
					<View className="flex-row items-center gap-1.5">
						<MapPin color={colors.mutedForeground} size={14} />
						<Text className="text-muted-foreground text-sm" numberOfLines={2}>
							{person.place_of_birth}
						</Text>
					</View>
				) : null}
			</View>
		</View>
	);
}
