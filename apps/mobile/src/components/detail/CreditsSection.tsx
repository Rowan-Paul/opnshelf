import type { TmdbCastDto, TmdbCrewDto } from "@opnshelf/api";
import { User } from "lucide-react-native";
import { FlatList, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
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
		<View className="w-20">
			<View className="aspect-2/3 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-subtle">
				{url ? (
					<PosterImage url={url} className="aspect-2/3 w-20" />
				) : (
					<User color="#94a3b8" size={24} />
				)}
			</View>
			<Text
				className="mt-1 font-medium text-foreground text-xs"
				numberOfLines={1}
			>
				{person.name}
			</Text>
			{person.role ? (
				<Text className="text-muted-foreground text-xs" numberOfLines={1}>
					{person.role}
				</Text>
			) : null}
		</View>
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
		.slice(0, 20)
		.map((c) => ({
			id: c.id,
			name: c.name,
			role: c.character,
			profile_path: c.profile_path,
		}));
	return <CreditsSection title="Cast" people={people} />;
}

/** Maps TMDB crew into the credits rail (dedupes a person across jobs). */
export function CrewSection({ crew }: { crew?: TmdbCrewDto[] }) {
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
	return (
		<CreditsSection
			title="Crew"
			people={Array.from(seen.values()).slice(0, 20)}
		/>
	);
}
