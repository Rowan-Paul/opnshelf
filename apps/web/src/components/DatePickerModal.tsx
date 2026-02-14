import {
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { LoadingButton } from "@/components/ui/loading-button";
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
			<div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full">
				<div className="flex justify-between items-center mb-6">
					<h3 className="text-xl font-semibold">Watch Again</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-2 hover:bg-gray-800 rounded-full transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<p className="text-gray-400 mb-4">When did you watch this movie?</p>
				<div className="space-y-4">
					<div>
						<label
							htmlFor="date-picker"
							className="block text-sm text-gray-400 mb-2 cursor-pointer"
						>
							Date
						</label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="w-full px-4 py-3 h-auto mt-2 bg-gray-800 rounded-xl border border-gray-700 text-white hover:bg-gray-700 hover:text-white justify-start text-left font-normal"
								>
									<Calendar className="mr-2 h-4 w-4 text-gray-400" />
									{customDate ? (
										format(new Date(customDate), "PPP")
									) : (
										<span className="text-gray-400">Pick a date</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-auto p-0 bg-gray-900 border-gray-700"
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
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							className="flex-1 border-gray-700 text-white hover:bg-gray-800"
						>
							Cancel
						</Button>
						<LoadingButton
							type="button"
							onClick={handleSubmit}
							disabled={!customDate || markMutation.isPending}
							className="flex-1 bg-purple-600 hover:bg-purple-700"
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
