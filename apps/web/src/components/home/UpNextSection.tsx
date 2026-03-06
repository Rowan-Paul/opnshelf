import {
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	type UpNextShowDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

type UpNextSectionProps = {
	isLoading: boolean;
	upNext: UpNextShowDto[];
	userDid: string;
};

export function UpNextSection({
	isLoading,
	upNext,
	userDid,
}: UpNextSectionProps) {
	const queryClient = useQueryClient();
	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, userDid);
			invalidateUserUpNextQueries(queryClient, userDid);
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="md-headline-small">Up Next</h2>
					<p className="text-sm text-gray-400">
						Pick up exactly where you left off.
					</p>
				</div>
			</div>
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-24 rounded-2xl animate-pulse"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-high)",
							}}
						/>
					))}
				</div>
			) : upNext.length > 0 ? (
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
					{upNext.slice(0, 4).map((item) => {
						const posterUrl = getTmdbPosterUrl(item.show.posterPath, "w500");

						const isPending =
							markMutation.isPending &&
							markMutation.variables?.body?.showId === item.showId &&
							markMutation.variables?.body?.seasonNumber ===
								item.nextEpisode.seasonNumber &&
							markMutation.variables?.body?.episodeNumber ===
								item.nextEpisode.episodeNumber;

						return (
							<Link
								key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
								to="/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId: item.showId,
									title: createTitleSlug(item.show.title),
									seasonNumber: String(item.nextEpisode.seasonNumber),
									episodeNumber: String(item.nextEpisode.episodeNumber),
								}}
							>
								<M3Card
									variant="filled"
									className="h-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
								>
									<div className="flex min-h-[220px] gap-4 p-4 items-stretch">
										<div className="w-24 shrink-0 self-center">
											<div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-gray-900">
												{posterUrl ? (
													<img
														src={posterUrl}
														alt={item.show.title}
														className="h-full w-full object-cover"
														loading="lazy"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
														No poster
													</div>
												)}
											</div>
										</div>
										<div className="flex min-w-0 flex-1 flex-col justify-between">
											<M3CardHeader className="p-0 pb-2">
												<div className="flex flex-wrap items-center gap-1.5 mb-2">
													<Badge variant="default">Up next</Badge>
													<Badge variant="outline">
														S{item.nextEpisode.seasonNumber} E
														{item.nextEpisode.episodeNumber}
													</Badge>
												</div>
												<M3CardTitle className="text-[1.7rem] leading-[1.1] tracking-tight">
													{item.show.title}
												</M3CardTitle>
												<M3CardDescription className="line-clamp-1 text-xl leading-tight mt-1">
													{item.nextEpisode.name}
												</M3CardDescription>
											</M3CardHeader>
											<M3CardContent className="p-0 flex justify-end pt-4">
												<div className="shrink-0 self-end">
													<M3Button
														size="sm"
														variant="filled-tonal"
														disabled={isPending}
														onClick={(event) => {
															event.preventDefault();
															event.stopPropagation();
															markMutation.mutate({
																body: {
																	showId: item.showId,
																	seasonNumber: item.nextEpisode.seasonNumber,
																	episodeNumber: item.nextEpisode.episodeNumber,
																},
															});
														}}
													>
														{isPending ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															<Check className="w-4 h-4" />
														)}
														Watch
													</M3Button>
												</div>
											</M3CardContent>
										</div>
									</div>
								</M3Card>
							</Link>
						);
					})}
				</div>
			) : (
				<M3Card variant="elevated">
					<M3CardHeader>
						<M3CardTitle>Nothing queued up yet</M3CardTitle>
						<M3CardDescription>
							Watch a few episodes and OpnShelf will line up what comes next.
						</M3CardDescription>
					</M3CardHeader>
				</M3Card>
			)}
		</div>
	);
}
