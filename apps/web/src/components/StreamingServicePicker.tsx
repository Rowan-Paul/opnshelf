import {
	type StreamingServiceDto,
	streamingServicesControllerListOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "#/lib/utils";

/** How many services show when nothing is typed. Two rows of six on desktop. */
export const TOP_SERVICE_COUNT = 12;

/** Stable keys for the loading skeleton tiles. */
const SKELETON_KEYS = Array.from(
	{ length: TOP_SERVICE_COUNT },
	(_, i) => `skeleton-${i + 1}`,
);

interface StreamingServicePickerProps {
	/** Watch country the list is for; the ids are only meaningful there. */
	country: string;
	/** TMDB watch-provider ids currently chosen (My Services). */
	value: number[];
	onChange: (ids: number[]) => void;
	disabled?: boolean;
}

/**
 * Visible services. With a query: every service whose name matches. Without
 * one: a fixed grid of the top services, with the chosen ones first so a
 * selection is never out of sight and the grid never grows a ragged tail.
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

/**
 * Multi-select grid of Streaming Services for a watch country. Controlled:
 * the caller owns the chosen ids and decides when to save them. The search
 * box is always there; it reaches the whole list, the grid only shows the
 * top of it until you type.
 */
export default function StreamingServicePicker({
	country,
	value,
	onChange,
	disabled,
}: StreamingServicePickerProps) {
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
			<div className="space-y-3" aria-busy="true">
				<div className="h-10 animate-pulse rounded-md bg-(--background-subtle)" />
				<div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
					{SKELETON_KEYS.map((key) => (
						<div
							key={key}
							className="flex animate-pulse flex-col items-center gap-1.5 rounded-xl border border-(--border) p-2"
						>
							<div className="size-10 rounded-xl bg-(--background-subtle)" />
							<div className="h-2.5 w-10 rounded bg-(--background-subtle)" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<p className="text-(--foreground-muted) text-sm">
				Could not load streaming services.{" "}
				<button
					type="button"
					className="underline underline-offset-2"
					onClick={() => refetch()}
				>
					Try again
				</button>
			</p>
		);
	}

	if (services.length === 0) {
		return (
			<p className="text-(--foreground-muted) text-sm">
				No streaming services are listed for this country.
			</p>
		);
	}

	return (
		<div className="space-y-3">
			<label className="input flex h-10 items-center gap-2 rounded-md border bg-background px-3">
				<Search className="size-4 shrink-0 opacity-50" />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={`Search ${services.length} services…`}
					aria-label="Search streaming services"
					className="w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
				/>
				{query ? (
					<button
						type="button"
						aria-label="Clear search"
						onClick={() => setQuery("")}
						className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
					>
						<X className="size-4" />
					</button>
				) : null}
			</label>

			<div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
				{shown.map((service) => {
					const selected = value.includes(service.id);
					return (
						<button
							key={service.id}
							type="button"
							disabled={disabled}
							aria-pressed={selected}
							onClick={() => onChange(toggleService(value, service.id))}
							className={cn(
								"relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
								selected
									? "border-(--accent) bg-(--accent)/10"
									: "border-(--border) hover:bg-accent",
							)}
						>
							<div className="size-10 overflow-hidden rounded-xl border border-(--border) bg-(--border)">
								{service.logoUrl ? (
									<img
										src={service.logoUrl}
										alt=""
										className="size-full object-cover"
										loading="lazy"
									/>
								) : null}
							</div>
							<span className="line-clamp-2 text-[10px] leading-tight">
								{service.name}
							</span>
							{selected ? (
								<span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-(--accent) text-(--accent-foreground)">
									<Check className="size-3" />
								</span>
							) : null}
						</button>
					);
				})}
			</div>

			{shown.length === 0 ? (
				<p className="text-(--foreground-muted) text-sm">No service found.</p>
			) : null}
		</div>
	);
}
