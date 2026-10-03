import {
	type FeaturedDto,
	featuredControllerAccessOptions,
	featuredControllerListOptions,
	featuredControllerPublishMutation,
	featuredControllerRemoveMutation,
	featuredControllerReorderMutation,
	featuredControllerUpdateMutation,
	featuredTitle,
	type PublishFeaturedDto,
	searchControllerSearchAllOptions,
	showsControllerGetShowDetailsOptions,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import {
	hashKey,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pagination } from "#/components/Pagination";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";
import { datetimeLocalToISO, formatDateTime } from "#/lib/date-utils";
import { defaultFeaturedExpiry, featuredExpiryInput } from "./editor-dates";
import { FeaturedCard } from "./FeaturedContent";

function errorMessage(error: unknown): string {
	if (error && typeof error === "object" && "message" in error) {
		const message = error.message;
		if (typeof message === "string") return message;
		if (Array.isArray(message)) return message.join(". ");
	}
	return "Couldn't save this change. Please try again.";
}
export function FeaturedEditor() {
	const { user, isLoading } = useAuth();
	const settings = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});
	const access = useQuery({
		...featuredControllerAccessOptions(),
		queryKeyHashFn: (key) => hashKey([...key, user?.did]),
		enabled: !!user,
		retry: false,
	});
	return (
		<div className="container-app py-8">
			<div className="mx-auto max-w-5xl">
				<Link to="/search" className="text-sm underline">
					← Discover
				</Link>
				<h1 className="mt-4 text-display-2">Featured Content</h1>
				<p className="mt-2 mb-8 text-(--foreground-muted)">
					Choose what’s worth discovering right now.
				</p>
				{isLoading || (user && access.isPending) ? (
					<EditorSkeleton />
				) : !user || !access.data?.canEdit ? (
					<p role="alert">
						{access.isError
							? "Couldn't check editorial access. Reload to try again."
							: "Sign in with the admin account to manage Featured Content."}
					</p>
				) : settings.isPending ? (
					<EditorSkeleton />
				) : !settings.data ? (
					<p role="alert">
						Couldn't load your timezone.{" "}
						<button
							type="button"
							className="underline"
							onClick={() => void settings.refetch()}
						>
							Retry
						</button>
					</p>
				) : (
					<EditorWorkspace key={user.did} timezone={settings.data.timezone} />
				)}
			</div>
		</div>
	);
}
function EditorSkeleton() {
	return (
		<div
			aria-busy="true"
			data-testid="editor-skeleton"
			className="space-y-4 motion-safe:animate-pulse"
		>
			<div className="h-12 rounded-xl bg-(--background-subtle)" />
			<div className="h-52 rounded-xl bg-(--background-subtle)" />
		</div>
	);
}
function EditorWorkspace({ timezone }: { timezone: string }) {
	const client = useQueryClient();
	const [page, setPage] = useState(1);
	const active = useQuery({
		...featuredControllerListOptions({
			query: { status: "active", pageSize: 5 },
		}),
		refetchInterval: 30_000,
	});
	const inactive = useQuery(
		featuredControllerListOptions({
			query: { status: "inactive", page, pageSize: 10 },
		}),
	);
	const [editing, setEditing] = useState<FeaturedDto | "new" | null>(null);
	const refresh = async () => {
		await client.invalidateQueries({
			predicate: (query) => {
				const head = query.queryKey[0];
				return (
					typeof head === "object" &&
					head !== null &&
					"_id" in head &&
					typeof head._id === "string" &&
					head._id.startsWith("featuredController")
				);
			},
		});
	};
	const remove = useMutation({
		...featuredControllerRemoveMutation(),
		onSuccess: async () => {
			await refresh();
			toast.success("Pick removed");
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const reorder = useMutation({
		...featuredControllerReorderMutation(),
		onSuccess: refresh,
		onError: async (error) => {
			toast.error(errorMessage(error));
			await refresh();
		},
	});
	const items = active.data?.items ?? [];
	function move(index: number, delta: number) {
		const ids = items.map((item) => item.id);
		[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
		reorder.mutate({ body: { ids } });
	}
	function row(item: FeaturedDto, index: number, isActive: boolean) {
		const removing = remove.isPending && remove.variables?.path.id === item.id;
		const moving =
			reorder.isPending && reorder.variables?.body.ids[index] !== item.id;
		return (
			<li
				key={item.id}
				className={`flex flex-wrap items-center gap-3 rounded-xl border border-(--border) bg-(--background-elevated) p-4 ${removing || moving ? "opacity-60" : ""}`}
			>
				<div className="min-w-0 flex-1 basis-48">
					<h3 className="font-semibold">{featuredTitle(item)}</h3>
					<p className="mt-1 break-words text-(--foreground-muted) text-sm">
						{item.message}
					</p>
					<p className="mt-2 text-(--foreground-muted) text-xs">
						{isActive ? "Expires" : "Expiry"}:{" "}
						{formatDateTime(item.expiresAt, timezone, "24h")} ({timezone})
					</p>
				</div>
				<div className="flex items-center gap-2">
					{isActive && (
						<>
							<button
								type="button"
								className="btn btn-secondary p-2"
								aria-label={`Move ${featuredTitle(item)} up`}
								disabled={index === 0 || reorder.isPending}
								onClick={() => move(index, -1)}
							>
								<ArrowUp className="size-4" />
							</button>
							<button
								type="button"
								className="btn btn-secondary p-2"
								aria-label={`Move ${featuredTitle(item)} down`}
								disabled={index === items.length - 1 || reorder.isPending}
								onClick={() => move(index, 1)}
							>
								<ArrowDown className="size-4" />
							</button>
						</>
					)}
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => setEditing(item)}
					>
						Edit
					</button>
					{isActive && (
						<button
							type="button"
							className="btn btn-secondary"
							disabled={removing}
							onClick={() => remove.mutate({ path: { id: item.id } })}
						>
							{removing ? "Removing…" : "Remove"}
						</button>
					)}
				</div>
			</li>
		);
	}
	return (
		<div className="space-y-8">
			{editing !== null && (
				<PickForm
					key={editing === "new" ? "new" : editing.id}
					item={editing === "new" ? undefined : editing}
					timezone={timezone}
					onCancel={() => setEditing(null)}
					onSaved={async () => {
						setEditing(null);
						await refresh();
					}}
				/>
			)}
			<section>
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 className="font-display text-xl">
						Active picks · {items.length}/5
					</h2>
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => setEditing("new")}
						disabled={items.length >= 5}
					>
						Add pick
					</button>
				</div>
				{items.length >= 5 && (
					<p className="mb-3 text-(--foreground-muted) text-sm">
						Remove a pick before publishing another.
					</p>
				)}
				{active.isPending ? (
					<EditorSkeleton />
				) : active.isError ? (
					<p role="alert">
						Couldn't refresh active picks.{" "}
						<button
							type="button"
							className="underline"
							onClick={() => void active.refetch()}
						>
							Retry
						</button>
					</p>
				) : null}
				<ul className="space-y-3">
					{items.map((item, index) => row(item, index, true))}
				</ul>
				{!active.isPending && !active.isError && items.length === 0 && (
					<p>No active picks. Add a title to get started.</p>
				)}
			</section>
			<section>
				<h2 className="mb-4 font-display text-xl">Inactive picks</h2>
				{inactive.isPending ? (
					<EditorSkeleton />
				) : inactive.isError ? (
					<p role="alert">
						Couldn't load inactive picks.{" "}
						<button
							type="button"
							className="underline"
							onClick={() => void inactive.refetch()}
						>
							Retry
						</button>
					</p>
				) : null}
				<ul className="mb-4 space-y-3">
					{(inactive.data?.items ?? []).map((item, index) =>
						row(item, index, false),
					)}
				</ul>
				{inactive.data?.total === 0 && (
					<p className="text-(--foreground-muted) text-sm">
						Expired and removed picks appear here for reuse.
					</p>
				)}
				<Pagination
					page={inactive.data?.page ?? page}
					totalPages={inactive.data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</section>
		</div>
	);
}
function PickForm({
	item,
	timezone,
	onCancel,
	onSaved,
}: {
	item?: FeaturedDto;
	timezone: string;
	onCancel: () => void;
	onSaved: () => Promise<void>;
}) {
	const [selected, setSelected] = useState<{
		mediaId: number;
		mediaType: "movie" | "show" | "season";
		seasonNumber: number | null;
		title: string;
		posterPath: string | null;
	} | null>(item ?? null);
	const [query, setQuery] = useState("");
	const term = useDebounce(query.trim(), 300);
	const search = useQuery({
		...searchControllerSearchAllOptions({ query: { query: term } }),
		enabled: term.length > 0 && !selected,
	});
	const show = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: String(selected?.mediaId ?? 0) },
		}),
		enabled: !!selected && selected.mediaType !== "movie",
	});
	const [message, setMessage] = useState(item?.message ?? "");
	const [sourceUrl, setSourceUrl] = useState(item?.sourceUrl ?? "");
	const [sourceLabel, setSourceLabel] = useState<
		"Watch trailer" | "Read announcement"
	>(
		item?.sourceLabel === "Watch trailer"
			? "Watch trailer"
			: "Read announcement",
	);
	const [initialExpiry] = useState(() =>
		item?.active ? item.expiresAt : defaultFeaturedExpiry(),
	);
	const [expiry, setExpiry] = useState(() =>
		featuredExpiryInput(initialExpiry, timezone),
	);
	const [error, setError] = useState<string | null>(null);
	const create = useMutation(featuredControllerPublishMutation());
	const update = useMutation(featuredControllerUpdateMutation());
	const pending = create.isPending || update.isPending;
	async function save(published: boolean) {
		if (!selected) {
			setError("Choose a movie, show, or season first.");
			return;
		}
		try {
			const expiresAt =
				expiry === featuredExpiryInput(initialExpiry, timezone)
					? initialExpiry
					: datetimeLocalToISO(expiry, timezone);
			if (featuredExpiryInput(expiresAt, timezone) !== expiry)
				throw new Error(
					"That time doesn't exist in this timezone. Choose another time.",
				);
			const body: PublishFeaturedDto = {
				mediaType: selected.mediaType,
				mediaId: selected.mediaId,
				seasonNumber: selected.seasonNumber,
				message: message.trim(),
				expiresAt,
				published,
				sourceUrl: sourceUrl.trim() || null,
				...(sourceUrl.trim() ? { sourceLabel } : {}),
			};
			if (!body.message || [...body.message].length > 280)
				throw new Error("Write a message of 1–280 characters.");
			setError(null);
			if (item) await update.mutateAsync({ path: { id: item.id }, body });
			else await create.mutateAsync({ body });
			toast.success(
				published
					? item?.active
						? "Pick updated"
						: "Pick published"
					: "Inactive pick saved",
			);
			await onSaved();
		} catch (cause) {
			setError(errorMessage(cause));
		}
	}
	const preview: FeaturedDto | null = selected
		? {
				...selected,
				id: item?.id ?? "preview",
				message: message || "Your editorial message appears here.",
				sourceUrl: sourceUrl || null,
				sourceLabel,
				expiresAt: initialExpiry,
				active: true,
			}
		: null;
	return (
		<form
			className="rounded-2xl border border-(--border) bg-(--background-elevated) p-5"
			onSubmit={(event) => {
				event.preventDefault();
				void save(true);
			}}
		>
			<h2 className="mb-5 font-display text-xl">
				{item ? "Edit pick" : "New pick"}
			</h2>
			<fieldset
				disabled={pending}
				className="grid min-w-0 gap-6 lg:grid-cols-[1fr_340px]"
			>
				<div className="min-w-0 space-y-4">
					{!selected ? (
						<div>
							<label
								htmlFor="featured-search"
								className="mb-2 block font-medium text-sm"
							>
								Find a movie or show
							</label>
							<input
								id="featured-search"
								className="input w-full"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search the catalog"
							/>
							{search.isFetching && (
								<div
									className="mt-3 h-12 rounded bg-(--background-subtle) motion-safe:animate-pulse"
									aria-busy="true"
									data-testid="catalog-skeleton"
								/>
							)}
							{search.isError && (
								<p role="alert">Couldn't search the catalog. Try again.</p>
							)}
							<ul className="mt-2 max-h-64 overflow-y-auto">
								{(search.data?.items ?? []).map((result) => (
									<li key={`${result.media_type}-${result.id}`}>
										<button
											type="button"
											className="w-full rounded px-3 py-2 text-left hover:bg-(--background-subtle)"
											onClick={() =>
												setSelected({
													mediaId: result.id,
													mediaType:
														result.media_type === "movie" ? "movie" : "show",
													seasonNumber: null,
													title: result.title || result.name || "Untitled",
													posterPath: result.poster_path ?? null,
												})
											}
										>
											{result.title || result.name}{" "}
											<span className="text-(--foreground-muted) text-xs">
												· {result.media_type === "movie" ? "Movie" : "Show"} ·{" "}
												{(result.release_date || result.first_air_date)?.slice(
													0,
													4,
												)}
											</span>
										</button>
									</li>
								))}
							</ul>
							{term && search.data?.items.length === 0 && (
								<p className="text-sm">No matching titles.</p>
							)}
						</div>
					) : (
						<div>
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">{selected.title}</p>
								<button
									type="button"
									className="text-sm underline"
									onClick={() => setSelected(null)}
								>
									Change title
								</button>
							</div>
							{selected.mediaType !== "movie" && (
								<>
									<label
										htmlFor="featured-season"
										className="mt-3 mb-2 block text-sm"
									>
										Show or season
									</label>
									<select
										id="featured-season"
										className="input w-full"
										value={selected.seasonNumber ?? "show"}
										onChange={(event) =>
											setSelected({
												...selected,
												mediaType:
													event.target.value === "show" ? "show" : "season",
												seasonNumber:
													event.target.value === "show"
														? null
														: Number(event.target.value),
												posterPath:
													show.data?.seasons?.find(
														(season) =>
															season.season_number ===
															Number(event.target.value),
													)?.poster_path ?? selected.posterPath,
											})
										}
									>
										<option value="show">Whole show</option>
										{selected.seasonNumber !== null &&
											!show.data?.seasons?.some(
												(season) =>
													season.season_number === selected.seasonNumber,
											) && (
												<option value={selected.seasonNumber}>
													Season {selected.seasonNumber}
												</option>
											)}
										{show.data?.seasons?.map((season) => (
											<option
												key={season.season_number}
												value={season.season_number}
											>
												{season.season_number === 0
													? "Specials"
													: `Season ${season.season_number}`}
											</option>
										))}
									</select>
									{show.isPending && (
										<p className="text-sm">Loading seasons…</p>
									)}
									{show.isError && (
										<p role="alert">
											Couldn't load seasons.{" "}
											<button
												type="button"
												className="underline"
												onClick={() => void show.refetch()}
											>
												Retry
											</button>
										</p>
									)}
								</>
							)}
						</div>
					)}
					<div>
						<label
							htmlFor="featured-message"
							className="mb-2 block font-medium text-sm"
						>
							Why now?
						</label>
						<textarea
							id="featured-message"
							className="input min-h-28 w-full"
							required
							value={message}
							onChange={(event) =>
								setMessage([...event.target.value].slice(0, 280).join(""))
							}
						/>
						<p className="mt-1 text-(--foreground-muted) text-xs">
							{[...message].length}/280 · Keep it spoiler-free. Name the region
							for regional release dates.
						</p>
					</div>
					<div>
						<label
							htmlFor="featured-source"
							className="mb-2 block font-medium text-sm"
						>
							Source link (optional)
						</label>
						<input
							id="featured-source"
							type="url"
							pattern="https://.*"
							className="input w-full"
							value={sourceUrl}
							onChange={(event) => setSourceUrl(event.target.value)}
							placeholder="https://"
						/>
						{sourceUrl && (
							<>
								<label
									htmlFor="featured-source-label"
									className="mt-2 block text-sm"
								>
									Link label
								</label>
								<select
									id="featured-source-label"
									className="input mt-2 w-full"
									value={sourceLabel}
									onChange={(event) =>
										setSourceLabel(
											event.target.value === "Watch trailer"
												? "Watch trailer"
												: "Read announcement",
										)
									}
								>
									<option>Read announcement</option>
									<option>Watch trailer</option>
								</select>
							</>
						)}
					</div>
					<div>
						<label
							htmlFor="featured-expiry"
							className="mb-2 block font-medium text-sm"
						>
							Expires at ({timezone})
						</label>
						<input
							id="featured-expiry"
							type="datetime-local"
							required
							className="input w-full"
							value={expiry}
							onChange={(event) => setExpiry(event.target.value)}
						/>
					</div>
				</div>
				<div className="min-w-0">
					<h3 className="mb-3 text-(--foreground-muted) text-sm">
						Card preview
					</h3>
					{preview ? (
						<FeaturedCard item={preview} />
					) : (
						<div className="h-52 rounded-2xl border border-(--border) p-5 text-(--foreground-muted) text-sm">
							Choose a title to preview its card.
						</div>
					)}
				</div>
			</fieldset>
			{error && (
				<p role="alert" className="mt-4 text-red-500">
					{error}
				</p>
			)}
			<div className="mt-6 flex flex-wrap gap-3">
				<button type="submit" className="btn btn-primary" disabled={pending}>
					{pending
						? "Saving…"
						: item?.active
							? "Save changes"
							: item
								? "Republish"
								: "Publish"}
				</button>
				{item && !item.active && (
					<button
						type="button"
						className="btn btn-secondary"
						disabled={pending}
						onClick={() => void save(false)}
					>
						Save inactive
					</button>
				)}
				<button
					type="button"
					className="btn btn-secondary"
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
