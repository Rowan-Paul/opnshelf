import type { WatchProviderDto } from "@opnshelf/api";
import {
	moviesControllerGetWatchProvidersOptions,
	showsControllerGetWatchProvidersOptions,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { CountryPicker } from "@/components/ui/country-picker";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { COUNTRY_NAMES } from "@/lib/countries";
import { useTwStyle } from "@/lib/use-tw-style";

const PROVIDER_LOGO_BASE = "https://image.tmdb.org/t/p/original";

/**
 * The generated `WatchProvidersResultDto` doesn't model the `link` field that
 * the backend actually returns (it forwards TMDB/JustWatch's per-country watch
 * page URL). Widen the type locally so we can open it without `any`.
 */
type ProvidersResult = {
	link?: string;
	flatrate?: WatchProviderDto[];
	rent?: WatchProviderDto[];
	buy?: WatchProviderDto[];
	ads?: WatchProviderDto[];
	free?: WatchProviderDto[];
};

function ProviderChip({
	provider,
	link,
}: {
	provider: WatchProviderDto;
	link?: string;
}) {
	const logoStyle = useTwStyle("size-10 rounded-xl");

	const chip = (
		<View className="w-16 items-center gap-1.5">
			<View className="size-10 overflow-hidden rounded-xl border border-border bg-background-subtle">
				<Image
					source={{ uri: `${PROVIDER_LOGO_BASE}${provider.logo_path}` }}
					style={logoStyle}
					contentFit="cover"
				/>
			</View>
			<Text
				className="text-center text-[10px] text-muted-foreground leading-tight"
				numberOfLines={2}
			>
				{provider.provider_name}
			</Text>
		</View>
	);

	if (link) {
		return <Pressable onPress={() => Linking.openURL(link)}>{chip}</Pressable>;
	}
	return chip;
}

function ProviderGroup({
	label,
	providers,
	link,
}: {
	label: string;
	providers: WatchProviderDto[];
	link?: string;
}) {
	if (!providers.length) return null;
	const sorted = [...providers].sort(
		(a, b) => a.display_priority - b.display_priority,
	);
	return (
		<View className="gap-2">
			<Text className="font-semibold text-[11px] text-foreground-subtle uppercase tracking-widest">
				{label}
			</Text>
			<View className="flex-row flex-wrap gap-3">
				{sorted.map((p) => (
					<ProviderChip key={p.provider_id} provider={p} link={link} />
				))}
			</View>
		</View>
	);
}

/**
 * "Where to Watch" section for movie/show detail screens. Mirrors the web
 * `WatchProviders` component: same `*ControllerGetWatchProviders` endpoint and
 * `WatchProvidersResponseDto` shape, country seeded from the user's
 * `watchCountry` setting and changeable via the existing `CountryPicker`.
 *
 * Renders nothing until we have a response; once loaded it shows the provider
 * groups (or an "not available" message for the selected country).
 */
export function WatchProviders({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	const { user } = useAuth();
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});

	const [country, setCountry] = useState("US");
	const [showRentBuy, setShowRentBuy] = useState(false);
	// Seed the country from the user's setting once, after which the user's
	// in-screen picks win (matches web's one-shot sync).
	const hasSyncedCountry = useRef(false);
	useEffect(() => {
		if (!hasSyncedCountry.current && settings?.watchCountry) {
			hasSyncedCountry.current = true;
			setCountry(settings.watchCountry);
		}
	}, [settings]);

	const movieQuery = useQuery({
		...moviesControllerGetWatchProvidersOptions({
			path: { movieId: mediaId },
			query: { country },
		}),
		enabled: mediaType === "movie" && !!mediaId,
	});
	const showQuery = useQuery({
		...showsControllerGetWatchProvidersOptions({
			path: { showId: mediaId },
			query: { country },
		}),
		enabled: mediaType === "show" && !!mediaId,
	});

	const query = mediaType === "movie" ? movieQuery : showQuery;
	const data = query.data;

	// Nothing fetched yet, or the title genuinely has no streaming data at all:
	// keep the screen clean rather than showing an empty section.
	if (!data) return null;

	const providers = (data.providers ?? null) as ProvidersResult | null;
	const availableCountries = data.availableCountries ?? [];

	const hasAny =
		providers &&
		(providers.flatrate?.length ||
			providers.rent?.length ||
			providers.buy?.length ||
			providers.ads?.length ||
			providers.free?.length);

	const countryName = COUNTRY_NAMES[country] ?? country;

	return (
		<View className="gap-4 px-4">
			<View className="flex-row items-center justify-between">
				<Text className="font-display font-semibold text-base text-foreground">
					Where to Watch
				</Text>
				{availableCountries.length > 1 ? (
					<View className="w-40">
						<CountryPicker value={country} onChange={setCountry} />
					</View>
				) : null}
			</View>

			{!hasAny ? (
				<Text className="text-muted-foreground text-sm">
					Not available for streaming in {countryName}.
				</Text>
			) : (
				<View className="gap-4">
					<ProviderGroup
						label="Stream"
						providers={providers?.flatrate ?? []}
						link={providers?.link}
					/>
					<ProviderGroup
						label="Free"
						providers={[...(providers?.free ?? []), ...(providers?.ads ?? [])]}
						link={providers?.link}
					/>
					{(providers?.rent?.length ?? 0) > 0 ||
					(providers?.buy?.length ?? 0) > 0 ? (
						<View className="gap-3">
							<Pressable
								className="flex-row items-center gap-1"
								onPress={() => setShowRentBuy((v) => !v)}
							>
								{showRentBuy ? (
									<ChevronDown color="#94a3b8" size={14} />
								) : (
									<ChevronRight color="#94a3b8" size={14} />
								)}
								<Text className="font-semibold text-[11px] text-foreground-subtle uppercase tracking-widest">
									Rent & Buy
								</Text>
							</Pressable>
							{showRentBuy ? (
								<View className="gap-4">
									<ProviderGroup
										label="Rent"
										providers={providers?.rent ?? []}
										link={providers?.link}
									/>
									<ProviderGroup
										label="Buy"
										providers={providers?.buy ?? []}
										link={providers?.link}
									/>
								</View>
							) : null}
						</View>
					) : null}
				</View>
			)}

			<Text className="text-[10px] text-foreground-subtle">
				Streaming data provided by JustWatch
			</Text>
		</View>
	);
}
