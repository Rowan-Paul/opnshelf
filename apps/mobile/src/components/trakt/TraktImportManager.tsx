import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	type TraktImportJobDto,
	type TraktMatchCandidateDto,
	type TraktUnmatchedGroupDto,
	usersControllerConfirmMyTraktMatchMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
	usersControllerGetMyTraktImportIssuesOptions,
	usersControllerGetMyTraktMatchCandidatesOptions,
	usersControllerPauseMyTraktImportMutation,
	usersControllerRejectMyTraktMatchMutation,
	usersControllerResumeMyTraktImportMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
	AlertTriangle,
	ArrowRight,
	Check,
	CheckCircle2,
	CirclePause,
	Film,
	Search,
	Tv,
	X,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { TraktImportPanel } from "@/components/trakt/TraktImportPanel";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

const PRIMARY = "#f3bc00";
const MUTED = "#94a3b8";

export function TraktImportManager() {
	const queryClient = useQueryClient();
	const { data: job, isLoading } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		refetchInterval: (query) =>
			query.state.data && isActiveTraktImportStatus(query.state.data.status)
				? 3000
				: false,
	});
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
		});
	const pause = useMutation({
		mutationKey: ["trakt", "import", "pause"],
		...usersControllerPauseMyTraktImportMutation(),
		onSuccess: refresh,
	});
	const resume = useMutation({
		mutationKey: ["trakt", "import", "resume"],
		...usersControllerResumeMyTraktImportMutation(),
		onSuccess: refresh,
	});

	if (isLoading) {
		return (
			<View className="h-80 animate-pulse rounded-2xl bg-background-subtle" />
		);
	}
	if (!job) return <TraktImportPanel />;
	if (isActiveTraktImportStatus(job.status)) {
		return (
			<ProgressCard
				job={job}
				pending={pause.isPending}
				onPause={() => pause.mutate({})}
			/>
		);
	}
	if (job.status === "paused" || job.status === "failed") {
		return (
			<StoppedCard
				job={job}
				pending={resume.isPending}
				onResume={() => resume.mutate({})}
			/>
		);
	}
	return <Result job={job} />;
}

function ProgressCard({
	job,
	pending,
	onPause,
}: {
	job: TraktImportJobDto;
	pending: boolean;
	onPause: () => void;
}) {
	const progress = getTraktImportStatusProgress(job);
	return (
		<View className="gap-5 rounded-2xl border border-border bg-card p-5">
			<View className="gap-1">
				<Text className="font-medium text-primary text-sm">
					@{job.profileUsername ?? job.traktUsername}
				</Text>
				<Text className="font-display font-semibold text-2xl text-foreground">
					Building your Shelf
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					{getTraktImportStatusMessage(job)}
				</Text>
			</View>
			<View className="h-2.5 overflow-hidden rounded-full bg-background-subtle">
				<View
					className="h-full rounded-full bg-primary"
					style={{ width: `${progress ?? 4}%` }}
				/>
			</View>
			<View className="flex-row gap-2">
				<Metric label="Imported" value={job.importedCount} />
				<Metric label="Already here" value={job.alreadyOnShelfCount} />
				<Metric
					label="Attention"
					value={job.unmatchedCount + job.couldntImportCount}
				/>
			</View>
			<Text className="text-muted-foreground text-sm">
				You can leave this screen. The import continues in the background.
			</Text>
			<ActionButton
				label="Pause import"
				icon={<CirclePause color="#3f2e00" size={18} />}
				pending={pending}
				onPress={onPause}
			/>
		</View>
	);
}

function StoppedCard({
	job,
	pending,
	onResume,
}: {
	job: TraktImportJobDto;
	pending: boolean;
	onResume: () => void;
}) {
	const paused = job.status === "paused";
	return (
		<View className="gap-4 rounded-2xl border border-border bg-card p-5">
			<AlertTriangle color="#d97706" size={28} />
			<View className="gap-2">
				<Text className="font-display font-semibold text-2xl text-foreground">
					{paused ? "Import paused" : "Import stopped"}
				</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					{paused
						? "Resume whenever you’re ready. We’ll continue from the saved position."
						: (job.lastError ??
							"The import stopped before all history was examined.")}
				</Text>
			</View>
			<ActionButton
				label="Resume import"
				icon={<ArrowRight color="#3f2e00" size={18} />}
				pending={pending}
				onPress={onResume}
			/>
		</View>
	);
}

function Result({ job }: { job: TraktImportJobDto }) {
	const { user } = useAuth();
	const [matching, setMatching] = useState(false);
	const hasIssues = job.unmatchedCount > 0 || job.couldntImportCount > 0;
	if (matching && job.unmatchedGroups.length > 0) {
		return <MatchReel job={job} onFinish={() => setMatching(false)} />;
	}
	return (
		<View className="gap-5">
			<View className="gap-5 rounded-2xl border border-border bg-card p-5">
				{hasIssues ? (
					<AlertTriangle color="#d97706" size={30} />
				) : (
					<CheckCircle2 color="#16a34a" size={30} />
				)}
				<View className="gap-1">
					<Text className="font-display font-semibold text-2xl text-foreground">
						{hasIssues ? "Completed with issues" : "Import complete"}
					</Text>
					<Text className="text-muted-foreground text-sm leading-5">
						{hasIssues
							? "Your full Trakt snapshot was examined. Some titles still need attention."
							: "Your full Trakt snapshot is now on your Shelf."}
					</Text>
				</View>
				<View className="flex-row flex-wrap gap-2">
					<Metric label="Imported" value={job.importedCount} half />
					<Metric
						label="Already on Shelf"
						value={job.alreadyOnShelfCount}
						half
					/>
					<Metric label="Unmatched" value={job.unmatchedCount} half />
					<Metric label="Couldn’t import" value={job.couldntImportCount} half />
				</View>
				{job.unmatchedGroups.length > 0 ? (
					<ActionButton
						label={`Match ${job.unmatchedGroups.length} ${job.unmatchedGroups.length === 1 ? "title" : "titles"}`}
						icon={<ArrowRight color="#3f2e00" size={18} />}
						onPress={() => setMatching(true)}
					/>
				) : null}
				<Pressable
					onPress={() =>
						user?.handle && router.push(`/profile/${user.handle}/shelf`)
					}
					className="items-center rounded-xl border border-border py-3"
				>
					<Text className="font-semibold text-foreground">View your Shelf</Text>
				</Pressable>
			</View>
			{job.couldntImportCount > 0 ? <CouldntImportList /> : null}
		</View>
	);
}

function MatchReel({
	job,
	onFinish,
}: {
	job: TraktImportJobDto;
	onFinish: () => void;
}) {
	const group = job.unmatchedGroups[0];
	return (
		<View className="gap-4">
			<View className="flex-row items-start justify-between gap-4">
				<View className="flex-1">
					<Text className="font-medium text-primary text-sm">Match reel</Text>
					<Text className="font-display font-semibold text-2xl text-foreground">
						{job.unmatchedGroups.length}{" "}
						{job.unmatchedGroups.length === 1 ? "title needs" : "titles need"}{" "}
						your eye
					</Text>
				</View>
				<Pressable onPress={onFinish} className="py-2">
					<Text className="font-medium text-muted-foreground text-sm">
						Finish for now
					</Text>
				</Pressable>
			</View>
			<MatchCard key={group.matchKey} group={group} />
		</View>
	);
}

function MatchCard({ group }: { group: TraktUnmatchedGroupDto }) {
	const queryClient = useQueryClient();
	const [candidateIndex, setCandidateIndex] = useState(0);
	const [searchMode, setSearchMode] = useState(false);
	const [searchText, setSearchText] = useState("");
	const [submittedSearch, setSubmittedSearch] = useState("");
	const { data: candidates = [], isLoading } = useQuery({
		...usersControllerGetMyTraktMatchCandidatesOptions({
			path: { matchKey: group.matchKey },
			query: submittedSearch ? { query: submittedSearch } : undefined,
		}),
	});
	const candidate = candidates[candidateIndex];
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
		});
	const confirm = useMutation({
		mutationKey: ["trakt", "matches", group.matchKey, "confirm"],
		...usersControllerConfirmMyTraktMatchMutation(),
		onSuccess: refresh,
	});
	const reject = useMutation({
		mutationKey: ["trakt", "matches", group.matchKey, "noMatch"],
		...usersControllerRejectMyTraktMatchMutation(),
		onSuccess: refresh,
	});
	return (
		<View className="gap-5 rounded-2xl border border-border bg-card p-5">
			<View className="gap-2 rounded-xl bg-background-subtle p-4">
				<View className="flex-row items-center gap-2">
					{group.mediaType === "movie" ? (
						<Film color={PRIMARY} size={18} />
					) : (
						<Tv color={PRIMARY} size={18} />
					)}
					<Text className="font-medium text-primary text-sm">From Trakt</Text>
				</View>
				<Text className="font-display font-semibold text-2xl text-foreground">
					{group.title}
				</Text>
				<Text className="text-muted-foreground text-sm">
					{group.year ? `${group.year} · ` : ""}
					{group.watchCount} {group.watchCount === 1 ? "watch" : "watches"}
				</Text>
			</View>
			{searchMode ? (
				<View className="gap-2">
					<TextInput
						value={searchText}
						onChangeText={setSearchText}
						onSubmitEditing={() => {
							setCandidateIndex(0);
							setSubmittedSearch(searchText.trim());
						}}
						placeholder="Search TMDB"
						placeholderTextColor={MUTED}
						className="rounded-xl border border-border px-4 py-3 text-foreground"
					/>
					<ActionButton
						label="Search"
						icon={<Search color="#3f2e00" size={18} />}
						disabled={!searchText.trim()}
						onPress={() => {
							setCandidateIndex(0);
							setSubmittedSearch(searchText.trim());
						}}
					/>
				</View>
			) : null}
			<View className="min-h-64 items-center justify-center">
				{isLoading ? (
					<ActivityIndicator color={PRIMARY} />
				) : candidate ? (
					<Candidate candidate={candidate} />
				) : (
					<View className="items-center gap-2 py-8">
						<Search color={MUTED} size={28} />
						<Text className="font-semibold text-foreground">
							No suggestion found
						</Text>
					</View>
				)}
			</View>
			{candidate ? (
				<View className="flex-row gap-2">
					<Pressable
						onPress={() =>
							confirm.mutate({
								path: { matchKey: group.matchKey },
								body: { tmdbId: candidate.tmdbId },
							})
						}
						disabled={confirm.isPending}
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
					>
						<Check color="#3f2e00" size={18} />
						<Text className="font-semibold text-primary-foreground">Yes</Text>
					</Pressable>
					<Pressable
						onPress={() => {
							if (candidateIndex + 1 < candidates.length) {
								setCandidateIndex((value) => value + 1);
							} else {
								setSearchMode(true);
							}
						}}
						className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border py-3"
					>
						<X color={MUTED} size={18} />
						<Text className="font-semibold text-foreground">No</Text>
					</Pressable>
				</View>
			) : null}
			<Pressable
				onPress={() => setSearchMode(true)}
				className="items-center py-2"
			>
				<Text className="font-medium text-muted-foreground text-sm">
					Search TMDB
				</Text>
			</Pressable>
			{searchMode ? (
				<Pressable
					onPress={() => reject.mutate({ path: { matchKey: group.matchKey } })}
					disabled={reject.isPending}
					className="items-center py-2"
				>
					<Text className="text-muted-foreground text-sm">
						No TMDB match exists
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function Candidate({ candidate }: { candidate: TraktMatchCandidateDto }) {
	return (
		<View className="w-full flex-row gap-4 rounded-xl bg-background-subtle p-3">
			<View className="aspect-2/3 w-24 overflow-hidden rounded-lg bg-background">
				{candidate.posterPath ? (
					<Image
						source={`https://image.tmdb.org/t/p/w300${candidate.posterPath}`}
						contentFit="cover"
						style={{ width: "100%", height: "100%" }}
					/>
				) : null}
			</View>
			<View className="flex-1 py-1">
				<Text className="font-display font-semibold text-foreground text-lg">
					{candidate.title}
				</Text>
				{candidate.year ? (
					<Text className="text-muted-foreground text-sm">
						{candidate.year}
					</Text>
				) : null}
				{candidate.overview ? (
					<Text
						className="mt-3 text-muted-foreground text-sm"
						numberOfLines={4}
					>
						{candidate.overview}
					</Text>
				) : null}
			</View>
		</View>
	);
}

function CouldntImportList() {
	const [page, setPage] = useState(1);
	const { data } = useQuery({
		...usersControllerGetMyTraktImportIssuesOptions({
			query: { page, pageSize: 25, outcome: "couldnt_import" },
		}),
	});
	if (!data?.items.length) return null;
	const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
	return (
		<View className="gap-3 rounded-2xl border border-border bg-card p-5">
			<Text className="font-display font-semibold text-foreground text-xl">
				Items that couldn’t be imported
			</Text>
			<Text className="text-muted-foreground text-sm">
				Showing {(page - 1) * data.pageSize + 1}–
				{Math.min(page * data.pageSize, data.total)} of {data.total}
			</Text>
			{data.items.map((item) => (
				<View key={item.id} className="gap-1 border-border border-t py-3">
					<Text className="font-medium text-foreground">
						{item.title ?? "Unknown title"}
						{item.year ? ` (${item.year})` : ""}
					</Text>
					<Text className="text-muted-foreground text-sm">
						{item.message ?? "No compatible TMDB item was available."}
					</Text>
				</View>
			))}
			{lastPage > 1 ? (
				<View className="flex-row justify-end gap-2">
					<Pressable
						disabled={page === 1}
						onPress={() => setPage((value) => value - 1)}
						className="rounded-lg border border-border px-3 py-2"
					>
						<Text className="text-foreground">Previous</Text>
					</Pressable>
					<Pressable
						disabled={page === lastPage}
						onPress={() => setPage((value) => value + 1)}
						className="rounded-lg border border-border px-3 py-2"
					>
						<Text className="text-foreground">Next</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}

function Metric({
	value,
	label,
	half = false,
}: {
	value: number;
	label: string;
	half?: boolean;
}) {
	return (
		<View
			className={`${half ? "w-[48%]" : "flex-1"} items-center rounded-xl bg-background-subtle p-3`}
		>
			<Text className="font-display font-semibold text-foreground text-xl">
				{value}
			</Text>
			<Text className="text-center text-muted-foreground text-xs">{label}</Text>
		</View>
	);
}

function ActionButton({
	label,
	icon,
	pending = false,
	disabled = false,
	onPress,
}: {
	label: string;
	icon: React.ReactNode;
	pending?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={pending || disabled}
			className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
			style={{ opacity: pending || disabled ? 0.5 : 1 }}
		>
			{pending ? <ActivityIndicator color="#3f2e00" /> : icon}
			<Text className="font-semibold text-primary-foreground">{label}</Text>
		</Pressable>
	);
}
