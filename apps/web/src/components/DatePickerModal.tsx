import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { LoadingButton } from "@/components/ui/loading-button";
import { M3Button } from "@/components/ui/m3-button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";

interface DatePickerModalProps {
	open: boolean;
	onClose: () => void;
	movieId: string;
	userDid: string | undefined;
}

export function DatePickerModal({
	open,
	onClose,
	movieId,
	userDid,
}: DatePickerModalProps) {
	const queryClient = useQueryClient();
	const [customDate, setCustomDate] = useState("");
	const [timeDate, setTimeDate] = useState<Date | undefined>(undefined);

	useEffect(() => {
		if (open) {
			const now = new Date();
			setCustomDate(now.toISOString().split("T")[0]);
			setTimeDate(now);
		}
	}, [open]);

	const markMutation = useMutation({
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({
					path: { userDid: userDid || "" },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: ["watchHistory", userDid, movieId],
			});
			toast.success("Added to your shelf");
			onClose();
		},
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const handleSubmit = () => {
		if (!customDate) return;

		let dateTime: Date;
		if (timeDate && customDate) {
			const [year, month, day] = customDate.split("-").map(Number);
			dateTime = new Date(timeDate);
			dateTime.setFullYear(year);
			dateTime.setMonth(month - 1);
			dateTime.setDate(day);
		} else if (customDate) {
			dateTime = new Date(customDate);
		} else {
			return;
		}

		markMutation.mutate({
			body: {
				movieId,
				watchedAt: dateTime.toISOString(),
			},
		});
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
			<div className="bg-[var(--md-sys-color-surface-container-high)] rounded-[1.75rem] p-6 max-w-md w-full">
				<div className="flex justify-between items-center mb-6">
					<h3 className="text-xl font-semibold text-[var(--md-sys-color-on-surface)]">
						Watch Again
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-2 hover:bg-[var(--md-sys-color-surface-container-high)] rounded-full transition-colors text-[var(--md-sys-color-on-surface-variant)]"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<p className="text-[var(--md-sys-color-on-surface-variant)] mb-4">
					When did you watch this movie?
				</p>
				<div className="space-y-4">
					<div>
						<label
							htmlFor="date-picker"
							className="block text-sm text-[var(--md-sys-color-on-surface-variant)] mb-2 cursor-pointer"
						>
							Date
						</label>
						<Popover>
							<PopoverTrigger asChild>
								<M3Button
									variant="outlined"
									className="w-full px-4 py-3 h-auto mt-2 bg-[var(--md-sys-color-surface-container-high)] rounded-xl border border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] justify-start text-left font-normal"
								>
									<Calendar className="mr-2 h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
									{customDate ? (
										format(new Date(customDate), "PPP")
									) : (
										<span className="text-[var(--md-sys-color-on-surface-variant)]">
											Pick a date
										</span>
									)}
								</M3Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-auto p-0 bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline)]"
								align="start"
							>
								<CalendarComponent
									mode="single"
									selected={customDate ? new Date(customDate) : undefined}
									onSelect={(date) => {
										if (date) {
											setCustomDate(format(date, "yyyy-MM-dd"));
										}
									}}
									autoFocus
								/>
							</PopoverContent>
						</Popover>
					</div>
					<div>
						<TimePicker date={timeDate} setDate={setTimeDate} />
					</div>
					<div className="flex gap-3 pt-4">
						<M3Button
							type="button"
							variant="outlined"
							onClick={onClose}
							className="flex-1 border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
						>
							Cancel
						</M3Button>
						<LoadingButton
							type="button"
							onClick={handleSubmit}
							disabled={!customDate || markMutation.isPending}
							className="flex-1 bg-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
							isLoading={markMutation.isPending}
						>
							Add Play
						</LoadingButton>
					</div>
				</div>
			</div>
		</div>
	);
}
