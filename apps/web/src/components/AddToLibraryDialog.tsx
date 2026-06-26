import { Check, Disc, Plus, X } from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	LIBRARY_FORMATS,
	type LibraryFormat,
	useLibraryActions,
	useLibraryForItem,
} from "#/lib/hooks";

interface AddToLibraryDialogProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function AddToLibraryDialog({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	open,
	onOpenChange,
}: AddToLibraryDialogProps) {
	const opts = { mediaType, mediaId, seasonNumber, episodeNumber };
	const { data: owned, isLoading } = useLibraryForItem({
		...opts,
		enabled: open,
	});
	const { addFormat, removeFormat, isPending } = useLibraryActions(opts);

	const [boxSet, setBoxSet] = useState("");

	const ownedByFormat = new Map(
		(owned ?? []).map((item) => [item.format, item]),
	);

	const toggle = (format: LibraryFormat) => {
		if (ownedByFormat.has(format)) {
			removeFormat(format);
		} else {
			addFormat(format, boxSet);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add to library</DialogTitle>
					<DialogDescription>
						Mark the formats you own this in.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2">
					<label className="block text-sm">
						<span className="mb-1 block text-(--foreground-muted) text-xs">
							Box set (optional)
						</span>
						<input
							type="text"
							value={boxSet}
							onChange={(e) => setBoxSet(e.target.value)}
							placeholder="e.g. The Lord of the Rings Trilogy"
							className="w-full rounded-md border border-(--border) bg-(--background-elevated) px-3 py-2 text-sm outline-none focus:border-(--border-strong)"
						/>
						<span className="mt-1 block text-(--foreground-muted) text-xs">
							Applied to formats you add now.
						</span>
					</label>

					<div className="space-y-1">
						{isLoading ? (
							<div className="py-6 text-center text-(--foreground-muted) text-sm">
								Loading…
							</div>
						) : (
							LIBRARY_FORMATS.map(({ value, label }) => {
								const isOwned = ownedByFormat.has(value);
								return (
									<button
										key={value}
										type="button"
										onClick={() => toggle(value)}
										disabled={isPending}
										className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-(--background-subtle) disabled:opacity-60"
									>
										<span className="flex items-center gap-2">
											<Disc className="size-4 text-(--foreground-muted)" />
											{label}
											{isOwned && ownedByFormat.get(value)?.boxSet ? (
												<span className="text-(--foreground-muted) text-xs">
													· {ownedByFormat.get(value)?.boxSet}
												</span>
											) : null}
										</span>
										{isOwned ? (
											<Check className="size-4 text-green-500" />
										) : (
											<Plus className="size-4 text-(--foreground-muted)" />
										)}
									</button>
								);
							})
						)}
					</div>
				</div>

				<div className="mt-2 flex justify-end border-(--border) border-t pt-2">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="btn btn-secondary btn-sm gap-1.5"
					>
						<X className="size-3.5" />
						Close
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
