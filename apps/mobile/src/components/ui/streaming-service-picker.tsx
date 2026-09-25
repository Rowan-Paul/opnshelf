import {
	type StreamingServiceDto,
	streamingServicesControllerListOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Check, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTwStyle } from "@/lib/use-tw-style";

/** How many services show when nothing is typed. Three rows of four. */
export const TOP_SERVICE_COUNT = 12;

/** Stable keys for the loading skeleton tiles. */
const SKELETON_KEYS = Array.from(
	{ length: TOP_SERVICE_COUNT },
	(_, i) => `skeleton-${i + 1}`,
);

/**
 * Visible services. With a query: every service whose name matches. Without
 * one: a fixed grid of the top services, with the chosen ones first so a
 * selection is never out of sight and the grid never grows a ragged tail.
 * Mirrors the Web `StreamingServicePicker`.
 */
export function visibleServices(
	services: StreamingServiceDto[],
	selected: number[],
	query: string,
): StreamingServiceDto[] {
	const q = query.trim().toLowerCase();
	if (q) return services.filter((s) => s.name.toLowerCase().includes(q));
	const chosen = new Set(selected);
	const picked = services.filter((s) => chosen.has(s.id));
	const rest = services.filter((s) => !chosen.has(s.id));
	return [...picked, ...rest].slice(
		0,
		Math.max(TOP_SERVICE_COUNT, picked.length),
	);
}

export function toggleService(selected: number[], id: number): number[] {
	return selected.includes(id)
		? selected.filter((x) => x !== id)
		: [...selected, id];
}

function ServiceTile({
	service,
	selected,
	disabled,
	onPress,
}: {
	service: StreamingServiceDto;
	selected: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const logoStyle = useTwStyle("size-10 rounded-xl");
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected, disabled }}
			accessibilityLabel={service.name}
			className={
				selected
					? "w-[23%] items-center gap-1.5 rounded-xl border border-primary bg-primary/10 p-2"
					: "w-[23%] items-center gap-1.5 rounded-xl border border-border p-2"
			}
			style={{ opacity: disabled ? 0.6 : 1 }}
		>
			<View className="size-10 overflow-hidden rounded-xl border border-border bg-background-subtle">
				{service.logoUrl ? (
					<Image
						source={{ uri: service.logoUrl }}
						style={logoStyle}
						contentFit="cover"
					/>
				) : null}
			</View>
			<Text
				numberOfLines={2}
				className="text-center text-[10px] text-foreground leading-tight"
			>
				{service.name}
			</Text>
			{selected ? (
				<View className="absolute top-1 right-1 size-4 items-center justify-center rounded-full bg-primary">
					<Check color="#3f2e00" size={11} />
				</View>
			) : null}
		</Pressable>
	);
}

/**
 * Multi-select grid of Streaming Services for a watch country. Controlled:
 * the caller owns the chosen ids and decides when to save them. The search
 * field is always there and reaches the whole list; the grid shows the top
 * of it until you type.
 */
export function StreamingServicePicker({
	country,
	value,
	onChange,
	disabled,
}: {
	country: string;
	value: number[];
	onChange: (ids: number[]) => void;
	disabled?: boolean;
}) {
	const [query, setQuery] = useState("");
	const { data, isLoading, isError, refetch } = useQuery({
		...streamingServicesControllerListOptions({ query: { country } }),
		staleTime: 1000 * 60 * 60,
	});

	const services = data?.services ?? [];
	const shown = useMemo(
		() => visibleServices(services, value, query),
		[services, value, query],
	);

	if (isLoading) {
		return (
			<View className="gap-3" accessibilityLabel="Loading streaming services">
				<View className="h-12 rounded-lg bg-background-subtle" />
				<View className="flex-row flex-wrap gap-2">
					{SKELETON_KEYS.map((key) => (
						<View
							key={key}
							className="w-[23%] items-center gap-1.5 rounded-xl border border-border p-2"
						>
							<View className="size-10 rounded-xl bg-background-subtle" />
							<View className="h-2.5 w-10 rounded bg-background-subtle" />
						</View>
					))}
				</View>
			</View>
		);
	}

	if (isError) {
		return (
			<ErrorState
				message="Could not load streaming services."
				onRetry={() => refetch()}
			/>
		);
	}

	if (services.length === 0) {
		return (
			<Text className="text-muted-foreground text-sm">
				No streaming services are listed for this country.
			</Text>
		);
	}

	return (
		<View className="gap-3">
			<TextField
				leading={<Search color="#94a3b8" size={18} />}
				trailing={
					query.length > 0 ? (
						<Pressable hitSlop={8} onPress={() => setQuery("")}>
							<X color="#94a3b8" size={18} />
						</Pressable>
					) : null
				}
				value={query}
				onChangeText={setQuery}
				placeholder={`Search ${services.length} services…`}
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
				editable={!disabled}
			/>

			<View className="flex-row flex-wrap gap-2">
				{shown.map((service) => (
					<ServiceTile
						key={service.id}
						service={service}
						selected={value.includes(service.id)}
						disabled={disabled}
						onPress={() => onChange(toggleService(value, service.id))}
					/>
				))}
			</View>

			{shown.length === 0 ? (
				<Text className="text-muted-foreground text-sm">No service found.</Text>
			) : null}
		</View>
	);
}
