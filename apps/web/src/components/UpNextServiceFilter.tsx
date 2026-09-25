import { streamingServicesControllerListOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import StreamingServicePicker, {
	toggleService,
} from "#/components/StreamingServicePicker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";

const MOBILE_QUERY = "(max-width: 767px)";
function subscribeToViewport(onChange: () => void) {
	const query = window.matchMedia?.(MOBILE_QUERY);
	query?.addEventListener("change", onChange);

	return () => query?.removeEventListener("change", onChange);
}
const isMobileViewport = () =>
	window.matchMedia?.(MOBILE_QUERY).matches ?? false;
const serverViewport = () => false;

export function UpNextServiceFilter({
	country,
	savedIds,
	value,
	onChange,
}: {
	country: string;
	savedIds: number[];
	value?: string;
	onChange: (value: string | undefined) => void;
}) {
	const isMobile = useSyncExternalStore(
		subscribeToViewport,
		isMobileViewport,
		serverViewport,
	);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<number[]>([]);
	const { data } = useQuery({
		...streamingServicesControllerListOptions({ query: { country } }),
	});
	const myIds = savedIds.filter((id) =>
		data?.services.some((service) => service.id === id),
	);
	const ids = value === "mine" ? myIds : (value?.split(",").map(Number) ?? []);

	const picker = (
		<StreamingServicePicker
			country={country}
			value={draft}
			onToggle={(id) => setDraft((ids) => toggleService(ids, id))}
		/>
	);
	const actions = (
		<div className="flex shrink-0 justify-end gap-2">
			<button
				type="button"
				className="btn btn-secondary"
				onClick={() => setOpen(false)}
			>
				Cancel
			</button>
			<button
				type="button"
				className="btn btn-primary"
				disabled={draft.length > 50}
				onClick={() => {
					onChange(
						draft.length
							? [...draft].sort((a, b) => a - b).join(",")
							: undefined,
					);
					setOpen(false);
				}}
			>
				Apply filter
			</button>
		</div>
	);
	const Root = isMobile ? Dialog : Popover;
	const Trigger = isMobile ? DialogTrigger : PopoverTrigger;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Root
				open={open}
				onOpenChange={(next) => {
					if (next) setDraft(ids);
					setOpen(next);
				}}
			>
				<Trigger asChild>
					<button
						type="button"
						className="btn btn-secondary gap-2"
						aria-label="Streaming services"
					>
						<SlidersHorizontal className="size-4" />
						Streaming services
						{value && (
							<span className="text-(--foreground-muted)">({ids.length})</span>
						)}
						<ChevronDown className="size-4" />
					</button>
				</Trigger>
				{isMobile ? (
					<DialogContent
						className="flex h-128 max-h-[85dvh] flex-col p-4"
						onOpenAutoFocus={(event) => {
							event.preventDefault();
							if (event.currentTarget instanceof HTMLElement) {
								event.currentTarget.focus();
							}
						}}
					>
						<div className="space-y-2 pr-6">
							<DialogTitle>Streaming services</DialogTitle>
							<DialogDescription>
								Show episodes on any selected service in {country}.
							</DialogDescription>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							{picker}
						</div>
						{actions}
					</DialogContent>
				) : (
					<PopoverContent
						align="start"
						aria-label="Streaming services"
						className="max-h-[70dvh] w-[min(36rem,calc(100vw-2rem))] space-y-4 overflow-y-auto"
					>
						<div>
							<h2 className="font-semibold">Streaming services</h2>
							<p className="text-(--foreground-muted) text-sm">
								Show episodes on any selected service in {country}.
							</p>
						</div>
						{picker}
						{actions}
					</PopoverContent>
				)}
			</Root>
			{value && (
				<button
					type="button"
					className="btn btn-secondary"
					onClick={() => {
						setDraft([]);
						setOpen(false);
						onChange(undefined);
					}}
				>
					Clear filters
				</button>
			)}
		</div>
	);
}
