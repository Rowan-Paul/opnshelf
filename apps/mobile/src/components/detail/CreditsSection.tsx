import type { TmdbCastDto, TmdbCreditsDto, TmdbCrewDto } from "@opnshelf/api";
import {
	moviesControllerGetFullMovieCreditsOptions,
	showsControllerGetFullShowCreditsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { User } from "lucide-react-native";
import { FlatList, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { PosterRowSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { personHref } from "@/lib/media-href";
import { profileUrl } from "@/lib/tmdb";

type CreditPerson = {
	id: number;
	name: string;
	role?: string;
	profile_path?: string;
};

function CreditCard({ person }: { person: CreditPerson }) {
	const url = profileUrl(person.profile_path);
	return (
		<Link href={personHref(person.id, person.name)} asChild>
			<Pressable className="w-20">
				<View className="aspect-2/3 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-subtle">
					{url ? (
						<PosterImage url={url} className="aspect-2/3 w-20" />
					) : (
						<User color="#94a3b8" size={24} />
					)}
				</View>
				<Text
					className="mt-1 font-medium text-foreground text-xs"
					numberOfLines={2}
				>
					{person.name}
				</Text>
				{person.role ? (
					<Text className="text-muted-foreground text-xs" numberOfLines={2}>
						{person.role}
					</Text>
				) : null}
			</Pressable>
		</Link>
	);
}

/**
 * Horizontally-scrolling credits rail. Accepts either a cast or crew array
 * (mapped to a common shape via `role`). Used by movie/show/episode details.
 */
export function CreditsSection({
	title,
	people,
}: {
	title: string;
	people: CreditPerson[];
}) {
	if (people.length === 0) return null;
	return (
		<View>
			<Text className="mb-3 px-4 font-display font-semibold text-base text-foreground">
				{title}
			</Text>
			<FlatList
				horizontal
				data={people}
				keyExtractor={(p, i) => `${p.id}-${i}`}
				renderItem={({ item }) => <CreditCard person={item} />}
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="gap-3 px-4"
			/>
		</View>
	);
}

/** Maps TMDB cast into the credits rail, ordered by billing. */
export function CastSection({ cast }: { cast?: TmdbCastDto[] }) {
	const people = (cast ?? [])
		.slice()
		.sort((a, b) => a.order - b.order)
		.map((c) => ({
			id: c.id,
			name: c.name,
			role: c.character,
			profile_path: c.profile_path,
		}));
	return <CreditsSection title="Cast" people={people} />;
}

/** Dedupes a person across jobs: one card, roles joined. */
function crewToPeople(crew?: TmdbCrewDto[]): CreditPerson[] {
	const seen = new Map<number, CreditPerson>();
	for (const c of crew ?? []) {
		const existing = seen.get(c.id);
		if (existing) {
			existing.role = [existing.role, c.job].filter(Boolean).join(", ");
		} else {
			seen.set(c.id, {
				id: c.id,
				name: c.name,
				role: c.job,
				profile_path: c.profile_path,
			});
		}
	}
	return Array.from(seen.values());
}

/** Maps TMDB crew into the credits rail (dedupes a person across jobs). */
export function CrewSection({
	crew,
	title = "Crew",
}: {
	crew?: TmdbCrewDto[];
	title?: string;
}) {
	// The rail is a horizontal FlatList, so scrolling is the "show more" —
	// no cap, and nobody gets dropped.
	return <CreditsSection title={title} people={crewToPeople(crew)} />;
}

/**
 * The cast and crew a detail screen shows without being asked, with a link to
 * the full credits screen. The totals come from the API, so the link states
 * what is behind it instead of quietly ending the list.
 */
export function CreditsSummary({
	credits,
	creditsHref,
}: {
	credits?: TmdbCreditsDto;
	creditsHref: string;
}) {
	const castTotal = credits?.cast_total ?? credits?.cast?.length ?? 0;
	const crewTotal = credits?.crew_total ?? credits?.crew?.length ?? 0;
	const hasMore =
		castTotal > (credits?.cast?.length ?? 0) ||
		crewTotal > (credits?.crew?.length ?? 0);

	return (
		<View className="gap-6">
			<CastSection cast={credits?.cast} />
			<CrewSection crew={credits?.crew} />
			{hasMore ? (
				<Link href={creditsHref as never} asChild>
					<Pressable className="px-4">
						<Text className="font-medium text-muted-foreground text-sm">
							{`Full cast & crew · ${castTotal} cast, ${crewTotal} crew`}
						</Text>
					</Pressable>
				</Link>
			) : null}
		</View>
	);
}

/**
 * Every credit, one rail per crew department — a movie can credit 700+ people
 * and a single flat rail of those is a credits scroll nobody can navigate.
 * Its own screen rather than an expanding section: the back gesture works and
 * the detail screen stays short.
 */
export function FullCredits({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	// Two queries rather than one with a ternary: the generated options carry
	// different query-key types, which defeats useQuery's inference.
	const movieQuery = useQuery({
		...moviesControllerGetFullMovieCreditsOptions({
			path: { movieId: mediaId },
		}),
		enabled: mediaType === "movie",
	});
	const showQuery = useQuery({
		...showsControllerGetFullShowCreditsOptions({ path: { showId: mediaId } }),
		enabled: mediaType === "show",
	});
	const { data, isPending, isError } =
		mediaType === "movie" ? movieQuery : showQuery;

	if (isError) {
		return <ErrorState message="Couldn't load the credits." />;
	}

	if (isPending || !data) {
		return (
			<View className="gap-6 px-4 py-4">
				<PosterRowSkeleton width={80} />
				<PosterRowSkeleton width={80} />
			</View>
		);
	}

	return (
		<View className="gap-6 py-4">
			<CastSection cast={data.cast} />
			{data.crew.map((department) => (
				<CrewSection
					key={department.department}
					crew={department.members}
					title={department.department}
				/>
			))}
		</View>
	);
}
