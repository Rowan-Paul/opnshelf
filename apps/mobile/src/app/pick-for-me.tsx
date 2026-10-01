import {
	choosePickerItem,
	getWatchProviderLink,
	initialPickerFilters,
	PICKER_GENRES,
	type PickerFilters,
	pickerEpisodeLabel,
	pickerServiceLabel,
	restorePickerFilters,
	slugifyName,
	streamingServicesControllerListOptions,
	usersControllerGetMySettingsOptions,
	type WatchPickerItemDto,
	watchPickerControllerGetOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { type ReactNode, useEffect, useState } from "react";
import {
	Image,
	Linking,
	Modal,
	Pressable,
	ScrollView,
	TextInput,
	View,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { UpNextServiceFilter } from "@/components/up-next/UpNextServiceFilter";
import { useAuth } from "@/lib/auth-context";

export default function PickerScreen() {
	const { user, isLoading: authLoading } = useAuth();
	const settingsQuery = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});
	const country = settingsQuery.data?.watchCountry ?? "US";
	const servicesQuery = useQuery({
		...streamingServicesControllerListOptions({ query: { country } }),
		enabled: !!user && !!settingsQuery.data,
	});
	let content: ReactNode;
	if (
		authLoading ||
		(user && (settingsQuery.isLoading || servicesQuery.isLoading))
	)
		content = (
			<View className="gap-4 py-5">
				<View className="h-8 w-48 rounded bg-background-subtle" />
				<View className="h-80 rounded-xl bg-background-subtle" />
			</View>
		);
	else if (!user) return <Redirect href="/login" />;
	else if (settingsQuery.isError || servicesQuery.isError)
		content = (
			<View className="gap-3 py-5">
				<Text accessibilityRole="alert">
					Couldn't load your picker preferences.
				</Text>
				<Button
					label="Try again"
					onPress={() => {
						void settingsQuery.refetch();
						void servicesQuery.refetch();
					}}
				/>
			</View>
		);
	else if (settingsQuery.data && servicesQuery.data)
		content = (
			<Picker
				key={`${user.did}:${country}`}
				userDid={user.did}
				country={country}
				savedIds={settingsQuery.data.streamingServiceIds.filter((id) =>
					servicesQuery.data.services.some((service) => service.id === id),
				)}
			/>
		);
	return (
		<Screen topInset={false}>
			<Stack.Screen options={{ title: "Pick for me", headerShown: true }} />
			{content}
		</Screen>
	);
}
function Choices<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	return (
		<View className="gap-2">
			<Text className="font-semibold">{label}</Text>
			<View className="flex-row flex-wrap gap-2">
				{options.map((option) => (
					<Pressable
						key={option.value}
						accessibilityRole="button"
						accessibilityState={{ selected: value === option.value }}
						className={
							value === option.value
								? "rounded-lg border border-primary bg-primary px-3 py-2"
								: "rounded-lg border border-border px-3 py-2"
						}
						onPress={() => onChange(option.value)}
					>
						<Text
							className={
								value === option.value
									? "text-primary-foreground"
									: "text-foreground"
							}
						>
							{option.label}
						</Text>
					</Pressable>
				))}
			</View>
		</View>
	);
}
function Picker({
	userDid,
	country,
	savedIds,
}: {
	userDid: string;
	country: string;
	savedIds: number[];
}) {
	const storageKey = `picker.v1.${Array.from(userDid)
		.map((c) => c.charCodeAt(0).toString(16))
		.join("_")}.${country}`;
	const savedIdsKey = savedIds.join(",");
	const [filters, setFilters] = useState<PickerFilters>(
		initialPickerFilters(savedIds),
	);
	const [ready, setReady] = useState(false);
	const [time, setTime] = useState("");
	const [submitted, setSubmitted] = useState<number>();
	const [selection, setSelection] = useState<WatchPickerItemDto>();
	const [skipped, setSkipped] = useState<string[]>([]);
	const [linkError, setLinkError] = useState(false);
	const [genreOpen, setGenreOpen] = useState(false);
	useEffect(() => {
		let active = true;
		void SecureStore.getItemAsync(storageKey)
			.then((value) => {
				if (active) {
					setFilters(
						restorePickerFilters(
							value,
							initialPickerFilters(
								savedIdsKey ? savedIdsKey.split(",").map(Number) : [],
							),
						),
					);
					setReady(true);
				}
			})
			.catch(() => {
				if (active) setReady(true);
			});
		return () => {
			active = false;
		};
	}, [storageKey, savedIdsKey]);
	const options = watchPickerControllerGetOptions({
		query: {
			minutes: submitted ?? 1,
			...filters,
			genre: filters.genre || undefined,
		},
	});
	const query = useQuery({
		...options,
		queryKey: [{ ...options.queryKey[0], tags: [userDid, country] }],
		enabled: ready && submitted !== undefined,
		staleTime: 0,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});
	useEffect(() => {
		if (query.data && !query.isFetching) {
			setSkipped([]);
			setSelection(choosePickerItem(query.data.items, []));
			setLinkError(false);
		}
	}, [query.data, query.isFetching]);
	const change = (next: PickerFilters) => {
		if (JSON.stringify(next) === JSON.stringify(filters)) return;
		setFilters(next);
		setSkipped([]);
		void SecureStore.setItemAsync(storageKey, JSON.stringify(next)).catch(
			() => {},
		);
	};
	const valid = /^\d+$/.test(time) && Number(time) >= 1 && Number(time) <= 1440;
	return (
		<ScrollView
			keyboardShouldPersistTaps="handled"
			contentContainerClassName="gap-5 py-5 pb-12"
		>
			<Text className="text-muted-foreground">
				Something from your Up Next or watchlist, for the time you have.
			</Text>
			<View className="gap-4 rounded-xl border border-border bg-card p-4">
				<Text className="font-semibold">How much time do you have?</Text>
				<View className="flex-row items-center gap-3">
					<TextInput
						accessibilityLabel="Available minutes"
						keyboardType="number-pad"
						placeholder="180"
						placeholderTextColor="#94a3b8"
						className="h-12 w-28 rounded-lg border border-border px-3 text-foreground"
						value={time}
						onChangeText={(value) => {
							setTime(value);
							setSkipped([]);
							setSubmitted(undefined);
							setSelection(undefined);
						}}
					/>
					<Text>minutes</Text>
				</View>
				<Choices
					label="Type"
					value={filters.type}
					options={[
						{ value: "both", label: "Both" },
						{ value: "movie", label: "Movies" },
						{ value: "show", label: "Shows" },
					]}
					onChange={(type) => change({ ...filters, type })}
				/>
				<Choices
					label="Progress"
					value={filters.progress}
					options={[
						{ value: "both", label: "Both" },
						{ value: "start", label: "Start" },
						{ value: "continue", label: "Continue" },
					]}
					onChange={(progress) => change({ ...filters, progress })}
				/>
				<View className="gap-2">
					<Text className="font-semibold">Genre</Text>
					<Button
						label={filters.genre || "Any genre"}
						variant="secondary"
						onPress={() => setGenreOpen(true)}
					/>
				</View>
				<Modal
					visible={genreOpen}
					animationType="slide"
					presentationStyle="pageSheet"
					onRequestClose={() => setGenreOpen(false)}
				>
					<View className="flex-1 bg-background p-5">
						<View className="mb-4 flex-row items-center justify-between">
							<Text className="font-bold text-xl">Genre</Text>
							<Button
								label="Done"
								variant="secondary"
								onPress={() => setGenreOpen(false)}
							/>
						</View>
						<ScrollView>
							<Choices
								label="Choose a genre"
								value={filters.genre}
								options={[
									{ value: "", label: "Any genre" },
									...[
										...new Set([
											...PICKER_GENRES,
											...(query.data?.genres ?? []),
										]),
									]
										.sort()
										.map((genre) => ({ value: genre, label: genre })),
								]}
								onChange={(genre) => {
									change({ ...filters, genre });
									setGenreOpen(false);
								}}
							/>
						</ScrollView>
					</View>
				</Modal>
				<UpNextServiceFilter
					clearLabel="Clear services"
					country={country}
					savedIds={savedIds}
					value={filters.services}
					onChange={(services) => change({ ...filters, services })}
				/>
				<Button
					label="Pick for me"
					disabled={!valid || query.isFetching || !ready}
					onPress={() => {
						setSkipped([]);
						if (submitted === Number(time)) {
							const next = selection ? [...skipped, selection.id] : skipped;
							setSkipped(next);
							setSelection(choosePickerItem(query.data?.items ?? [], next));
						} else setSubmitted(Number(time));
					}}
				/>
				<Button
					label="Clear all filters"
					variant="secondary"
					onPress={() => change(initialPickerFilters([]))}
				/>
			</View>
			{query.isError && (
				<View accessibilityRole="alert" className="gap-3">
					<Text>Couldn't find suggestions. Try again.</Text>
					<Button
						label="Try again"
						variant="secondary"
						onPress={() => void query.refetch()}
					/>
				</View>
			)}
			{query.isFetching && !selection ? (
				<View
					accessibilityLabel="Finding something to watch"
					className="gap-4 rounded-xl border border-border p-4"
				>
					<View className="h-56 w-36 self-center rounded-xl bg-background-subtle" />
					<View className="h-7 w-2/3 rounded bg-background-subtle" />
					<View className="h-4 rounded bg-background-subtle" />
					<View className="h-12 rounded bg-background-subtle" />
				</View>
			) : selection ? (
				<View
					className="gap-4 rounded-xl border border-border bg-card p-4"
					style={{ opacity: query.isFetching ? 0.5 : 1 }}
				>
					{selection.posterPath && (
						<Image
							accessibilityLabel={`${selection.title} poster`}
							source={{
								uri: `https://image.tmdb.org/t/p/w342${selection.posterPath}`,
							}}
							className="h-56 w-36 self-center rounded-xl"
						/>
					)}
					<Text className="font-bold font-display text-2xl">
						{selection.title}
					</Text>
					<Text className="text-muted-foreground">
						{pickerEpisodeLabel(selection)}
					</Text>
					<Text>
						{selection.estimated ? "About " : ""}
						{selection.minutes} minutes ·{" "}
						{Math.max(0, (submitted ?? 0) - selection.minutes)} minutes left
					</Text>
					{selection.services.map((service) => {
						const href = getWatchProviderLink(
							service.provider_id,
							selection.watchLink,
						);
						return href ? (
							<Button
								key={service.provider_id}
								label={`Watch on ${pickerServiceLabel(selection, service.provider_id, service.provider_name)}`}
								variant="secondary"
								onPress={() => {
									setLinkError(false);
									void Linking.openURL(href).catch(() => setLinkError(true));
								}}
							/>
						) : (
							<Text key={service.provider_id}>{service.provider_name}</Text>
						);
					})}
					{linkError && (
						<Text accessibilityRole="alert">
							Couldn't open the service. Try its website or app.
						</Text>
					)}
					{!selection.services.length && (
						<Text className="text-muted-foreground">
							Streaming availability is unknown or unavailable in your watch
							country.
						</Text>
					)}
					<Link
						href={
							selection.mediaType === "movie"
								? {
										pathname: "/movies/[id]/[name]",
										params: {
											id: selection.mediaId,
											name: slugifyName(selection.title),
										},
									}
								: {
										pathname: "/shows/[id]/[name]",
										params: {
											id: selection.mediaId,
											name: slugifyName(selection.title),
										},
									}
						}
						asChild
					>
						<Button label="View details" variant="secondary" />
					</Link>
					<Button
						label="Pick again"
						disabled={query.isFetching}
						onPress={() => {
							const next = [...skipped, selection.id];
							setSkipped(next);
							setSelection(choosePickerItem(query.data?.items ?? [], next));
							setLinkError(false);
						}}
					/>
				</View>
			) : submitted !== undefined &&
				query.data &&
				!query.isFetching &&
				!query.isError ? (
				<View className="gap-3 rounded-xl border border-border p-4">
					<Text className="font-semibold text-xl">
						{skipped.length
							? "You’ve tried every match"
							: "No titles fit these filters"}
					</Text>
					<Text className="text-muted-foreground">
						{skipped.length
							? "Reset your skips or change the filters to try something else."
							: "Try more time or clear filters. Add titles to your watchlist if you need more choices. Titles without a usable runtime cannot fit a time budget."}
					</Text>
					{skipped.length > 0 && (
						<Button
							label="Reset skips"
							variant="secondary"
							onPress={() => {
								setSkipped([]);
								setSelection(choosePickerItem(query.data?.items ?? [], []));
							}}
						/>
					)}
				</View>
			) : null}
		</ScrollView>
	);
}
