import {
	choosePickerItem,
	getWatchProviderLink,
	initialPickerFilters,
	isUnauthorizedError,
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
import {
	createFileRoute,
	Link,
	redirect,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UpNextServiceFilter } from "#/components/UpNextServiceFilter";
import { ssrAuthOptions, ssrCanResolveSession } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { currentUserQueryOptions, fetchCurrentUser } from "#/lib/auth-query";

export const Route = createFileRoute("/pick-for-me")({
	validateSearch: (
		search: Record<string, unknown>,
	): {
		minutes?: number;
		filters?: string;
		type?: "both" | "movie" | "show";
	} => ({
		minutes:
			Number.isInteger(Number(search.minutes)) &&
			Number(search.minutes) >= 1 &&
			Number(search.minutes) <= 1440
				? Number(search.minutes)
				: undefined,
		filters: typeof search.filters === "string" ? search.filters : undefined,
		type:
			search.type === "movie" ||
			search.type === "show" ||
			search.type === "both"
				? search.type
				: undefined,
	}),
	beforeLoad: async ({ context }) => {
		if (!ssrCanResolveSession()) return;
		try {
			const user = await fetchCurrentUser(context.queryClient, {
				...currentUserQueryOptions(ssrAuthOptions()),
				staleTime: 0,
			});
			if (!user) throw redirect({ to: "/login" });
		} catch (error) {
			if (isUnauthorizedError(error)) {
				throw redirect({ to: "/login" });
			}
			throw error;
		}
	},
	component: PickerPage,
	head: () => ({ meta: [{ title: "Pick for me | Opnshelf" }] }),
});
function PickerPage() {
	const { user, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const session = useQuery(currentUserQueryOptions());
	useEffect(() => {
		if (
			!authLoading &&
			!user &&
			session.isFetchedAfterMount &&
			!session.isError
		)
			void navigate({ to: "/login", replace: true });
	}, [
		authLoading,
		user,
		session.isFetchedAfterMount,
		session.isError,
		navigate,
	]);
	const settingsQuery = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});
	const country = settingsQuery.data?.watchCountry ?? "US";
	const servicesQuery = useQuery({
		...streamingServicesControllerListOptions({ query: { country } }),
		enabled: !!user && !!settingsQuery.data,
	});
	if (
		authLoading ||
		(user && (settingsQuery.isLoading || servicesQuery.isLoading))
	)
		return (
			<div className="mx-auto max-w-3xl space-y-5 px-4">
				<div className="h-10 w-48 animate-pulse rounded bg-(--background-subtle)" />
				<div className="card h-80 animate-pulse bg-(--background-subtle)" />
			</div>
		);
	if (!user) return null;
	if (settingsQuery.isError || servicesQuery.isError)
		return (
			<div role="alert" className="space-y-3">
				<p>Couldn't load your picker preferences.</p>
				<button
					type="button"
					className="btn btn-secondary"
					onClick={() => {
						void settingsQuery.refetch();
						void servicesQuery.refetch();
					}}
				>
					Try again
				</button>
			</div>
		);
	if (!settingsQuery.data || !servicesQuery.data) return null;
	const savedIds = settingsQuery.data.streamingServiceIds.filter((id) =>
		servicesQuery.data.services.some((service) => service.id === id),
	);
	return (
		<Picker
			key={`${user.did}:${country}`}
			userDid={user.did}
			country={country}
			savedIds={savedIds}
		/>
	);
}
export function Picker({
	userDid,
	country,
	savedIds,
}: {
	userDid: string;
	country: string;
	savedIds: number[];
}) {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const result = useLocation({
		select: (location) => location.pathname === "/pick-for-me/result",
	});
	const storageKey = `opnshelf.picker.v1.${userDid}.${country}`;
	const savedIdsKey = savedIds.join(",");
	const [filters, setFilters] = useState<PickerFilters>(
		restorePickerFilters(
			search.filters ?? null,
			initialPickerFilters(savedIds),
		),
	);
	const [ready, setReady] = useState(false);
	const [time, setTime] = useState(String(search.minutes ?? 180));
	useEffect(() => {
		if (!result && search.minutes !== undefined)
			setTime(String(search.minutes));
	}, [result, search.minutes]);
	const submitted = result ? search.minutes : undefined;
	const [selection, setSelection] = useState<WatchPickerItemDto>();
	const [skipped, setSkipped] = useState<string[]>([]);
	const resultAction = useRef<HTMLButtonElement>(null);
	const restoreActionFocus = useRef(false);
	useEffect(() => {
		// Only restore focus after an action, never on initial/background loading.
		if (restoreActionFocus.current) {
			resultAction.current?.focus();
			restoreActionFocus.current = false;
		}
	});
	useEffect(() => {
		try {
			setFilters(
				restorePickerFilters(
					search.filters ?? localStorage.getItem(storageKey),
					initialPickerFilters(
						savedIdsKey ? savedIdsKey.split(",").map(Number) : [],
					),
				),
			);
		} catch {
			/* Storage can be disabled. */
		}
		if (search.type)
			setFilters((current) => ({
				...current,
				type: search.type ?? current.type,
			}));
		setReady(true);
	}, [storageKey, savedIdsKey, search.filters, search.type]);
	useEffect(() => {
		if (result && !submitted)
			void navigate({ to: "/pick-for-me", replace: true });
	}, [result, submitted, navigate]);
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
		}
	}, [query.data, query.isFetching]);
	const change = (next: PickerFilters) => {
		if (JSON.stringify(next) === JSON.stringify(filters)) return;
		setFilters(next);
		setSkipped([]);
		try {
			localStorage.setItem(storageKey, JSON.stringify(next));
		} catch {
			/* Keep in-memory preferences. */
		}
	};
	const valid = /^\d+$/.test(time) && Number(time) >= 1 && Number(time) <= 1440;
	const timeError = !valid
		? time.trim()
			? "Enter a whole number between 1 and 1440 minutes."
			: "Enter how many minutes you have."
		: undefined;
	let resultStatus = "";
	if (result && !query.isError) {
		if (selection) {
			resultStatus = `Your pick: ${selection.title}. ${selection.minutes} minutes.`;
		} else if (query.data && !query.isFetching) {
			resultStatus = skipped.length
				? "You’ve tried every match. Reset your skips or change the filters."
				: "No titles fit these filters. Try more time or clear filters.";
		}
	}
	return (
		<div className="mx-auto max-w-3xl space-y-6 px-4 pb-12 sm:px-0">
			<header className="space-y-2">
				<h1 className="text-display-2">
					{result ? "Your pick" : "Pick for me"}
				</h1>
				{!result && (
					<p className="text-(--foreground-muted)">
						Something from your Up Next or watchlist, for the time you have.
					</p>
				)}
			</header>
			{!result && (
				<form
					className="card space-y-5 p-5"
					onSubmit={async (event) => {
						event.preventDefault();
						if (valid) {
							setSkipped([]);
							setSelection(undefined);
							await navigate({
								to: "/pick-for-me",
								search: { minutes: Number(time) },
								replace: true,
							});
							await navigate({
								to: "/pick-for-me/result",
								search: {
									minutes: Number(time),
									filters: JSON.stringify(filters),
								},
							});
						}
					}}
				>
					<label className="block space-y-2" htmlFor="picker-time">
						<span className="font-medium">How much time do you have?</span>
						<div className="flex items-center gap-3">
							<input
								id="picker-time"
								className="input max-w-32"
								type="number"
								min="1"
								max="1440"
								placeholder="180"
								value={time}
								aria-invalid={!valid}
								aria-describedby={timeError ? "picker-time-error" : undefined}
								onChange={(event) => {
									setTime(event.target.value);
									setSkipped([]);
									setSelection(undefined);
								}}
							/>
							<span>minutes</span>
						</div>
						{timeError && (
							<p id="picker-time-error" role="alert" className="text-sm">
								{timeError}
							</p>
						)}
					</label>
					<div className="grid gap-4 sm:grid-cols-3">
						<label className="space-y-2">
							Type
							<select
								className="input w-full"
								value={filters.type}
								onChange={(event) =>
									change({
										...filters,
										type: event.target.value as PickerFilters["type"],
									})
								}
							>
								<option value="both">Movies and shows</option>
								<option value="movie">Movies</option>
								<option value="show">Shows</option>
							</select>
						</label>
						<label className="space-y-2">
							Progress
							<select
								className="input w-full"
								value={filters.progress}
								onChange={(event) =>
									change({
										...filters,
										progress: event.target.value as PickerFilters["progress"],
									})
								}
							>
								<option value="both">Start or continue</option>
								<option value="start">Start something new</option>
								<option value="continue">Continue a show</option>
							</select>
						</label>
						<label className="space-y-2">
							Genre
							<select
								className="input w-full"
								value={filters.genre}
								onChange={(event) =>
									change({ ...filters, genre: event.target.value })
								}
							>
								<option value="">Any genre</option>
								{[
									...new Set([
										...PICKER_GENRES,
										...(query.data?.genres ?? []),
										...(filters.genre ? [filters.genre] : []),
									]),
								].map((genre) => (
									<option key={genre}>{genre}</option>
								))}
							</select>
						</label>
					</div>
					<UpNextServiceFilter
						showClear={false}
						country={country}
						savedIds={savedIds}
						value={filters.services}
						onChange={(services) => change({ ...filters, services })}
					/>
					<div className="flex flex-wrap gap-3">
						<button
							className="btn btn-primary"
							disabled={!valid || query.isFetching || !ready}
							type="submit"
						>
							Pick for me
						</button>
						<button
							className="btn btn-secondary"
							type="button"
							onClick={() => change(initialPickerFilters([]))}
						>
							Clear all filters
						</button>
					</div>
				</form>
			)}
			{result && (
				<>
					<Link
						to="/pick-for-me"
						search={{ minutes: submitted, filters: JSON.stringify(filters) }}
						className="btn btn-secondary"
					>
						Change filters
					</Link>
					{query.isError && (
						<div role="alert" className="card space-y-3 p-5">
							<p>Couldn't find suggestions. Try again.</p>
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => void query.refetch()}
							>
								Try again
							</button>
						</div>
					)}
					{query.isFetching && !selection ? (
						<output
							aria-label="Finding something to watch"
							aria-busy="true"
							className="card flex gap-5 p-5"
						>
							<div className="h-48 w-32 animate-pulse rounded bg-(--background-subtle)" />
							<div className="flex-1 space-y-4">
								<div className="h-7 w-2/3 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-4 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-10 w-32 animate-pulse rounded bg-(--background-subtle)" />
							</div>
						</output>
					) : selection ? (
						<article
							className="card flex flex-col gap-5 p-5 sm:flex-row"
							aria-busy={query.isFetching}
							style={{ opacity: query.isFetching ? 0.5 : 1 }}
						>
							{selection.posterPath && (
								<img
									className="mx-auto w-36 self-start rounded-xl"
									src={`https://image.tmdb.org/t/p/w342${selection.posterPath}`}
									alt={`${selection.title} poster`}
								/>
							)}
							<div className="min-w-0 flex-1 space-y-4">
								<div>
									<h2 className="text-display-3">{selection.title}</h2>
									<p className="mt-2 text-(--foreground-muted)">
										{pickerEpisodeLabel(selection)}
									</p>
									<p>
										{selection.estimated ? "About " : ""}
										{selection.minutes} minutes ·{" "}
										{Math.max(0, (submitted ?? 0) - selection.minutes)} minutes
										left
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									{selection.services.map((service) => {
										const href = getWatchProviderLink(
											service.provider_id,
											selection.watchLink,
										);
										return href ? (
											<a
												key={service.provider_id}
												href={href}
												target="_blank"
												rel="noreferrer"
												className="btn btn-secondary"
											>
												Watch on{" "}
												{pickerServiceLabel(
													selection,
													service.provider_id,
													service.provider_name,
												)}
											</a>
										) : (
											<span key={service.provider_id}>
												{service.provider_name}
											</span>
										);
									})}
								</div>
								{!selection.services.length && (
									<p className="text-(--foreground-muted)">
										Streaming availability is unknown or unavailable in your
										watch country.
									</p>
								)}
								<div className="flex flex-wrap gap-3">
									<Link
										className="btn btn-secondary"
										to={
											selection.mediaType === "movie"
												? "/movies/$movieId/$movieName"
												: "/shows/$showId/$showName"
										}
										params={
											selection.mediaType === "movie"
												? {
														movieId: selection.mediaId,
														movieName: slugifyName(selection.title),
													}
												: {
														showId: selection.mediaId,
														showName: slugifyName(selection.title),
													}
										}
									>
										View details
									</Link>
									<button
										ref={resultAction}
										type="button"
										className="btn btn-primary"
										disabled={query.isFetching}
										onClick={() => {
											restoreActionFocus.current = true;
											const next = [...skipped, selection.id];
											setSkipped(next);
											setSelection(
												choosePickerItem(query.data?.items ?? [], next),
											);
										}}
									>
										Pick again
									</button>
								</div>
							</div>
						</article>
					) : submitted !== undefined &&
						query.data &&
						!query.isFetching &&
						!query.isError ? (
						<div className="card space-y-3 p-6">
							<h2 className="text-display-3">
								{skipped.length
									? "You’ve tried every match"
									: "No titles fit these filters"}
							</h2>
							<p className="text-(--foreground-muted)">
								{skipped.length
									? "Reset your skips or change the filters to try something else."
									: "Try more time or clear filters. Add titles to your watchlist if you need more choices. Titles without a usable runtime cannot fit a time budget."}
							</p>
							{skipped.length > 0 && (
								<button
									ref={resultAction}
									type="button"
									className="btn btn-secondary"
									onClick={() => {
										restoreActionFocus.current = true;
										setSkipped([]);
										setSelection(choosePickerItem(query.data?.items ?? [], []));
									}}
								>
									Reset skips
								</button>
							)}
						</div>
					) : null}
				</>
			)}
			<output aria-live="polite" aria-atomic="true" className="sr-only">
				{resultStatus}
			</output>
		</div>
	);
}
