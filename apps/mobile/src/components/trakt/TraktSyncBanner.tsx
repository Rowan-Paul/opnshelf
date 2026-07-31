import {
	formatRetryCountdown,
	getRetryReason,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	usersControllerAcknowledgeMyTraktImportMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { AlertTriangle, CheckCircle2, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
	SafeAreaInsetsContext,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

/** Live "resuming in …" suffix for a budget-paused import. Ticks every 30s so
 *  the wait counts down instead of showing the stale write-time. Only mounted
 *  while waiting, so the interval isn't running the rest of the time. */
function PauseCountdown({ nextRunAt }: { nextRunAt: string }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);
	const remainingMs = new Date(nextRunAt).getTime() - now;
	return (
		<Text className="text-muted-foreground text-sm">
			{remainingMs > 1000
				? ` Resuming in ${formatRetryCountdown(remainingMs)}.`
				: " Resuming shortly…"}
		</Text>
	);
}

/**
 * Wraps the authenticated app surface with a slim, site-wide background-sync
 * banner — the mobile mirror of the web TraktSyncBanner. While a Trakt import
 * job is active it pins a bar below the status bar (consuming the top safe-area
 * inset) and drops that inset for the wrapped subtree, so screen content sits
 * flush under the banner instead of leaving a double gap. When no import is
 * active it renders children untouched with the normal inset.
 *
 * The import paces itself under the shared per-account PDS write budget, so a
 * large history can run for hours or days; this keeps the user informed (and
 * reassured the app stays usable) on every tab, not just the import screen.
 */
export function TraktSyncBanner({ children }: { children: ReactNode }) {
	const insets = useSafeAreaInsets();
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status && isActiveTraktImportStatus(status) ? 5000 : false;
		},
	});
	const acknowledge = useMutation({
		mutationKey: ["trakt", "import", "acknowledge"],
		...usersControllerAcknowledgeMyTraktImportMutation(),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
			}),
	});

	if (!job) {
		return <>{children}</>;
	}
	const active = isActiveTraktImportStatus(job.status);
	const terminal =
		!job.acknowledgedAt &&
		(job.status === "completed" || job.status === "failed");
	if (!active && !terminal) return <>{children}</>;

	if (!active) {
		const hasUnmatched = job.unmatchedGroups.length > 0;
		const hasIssues = hasUnmatched || job.couldntImportCount > 0;
		const stopped = job.status === "failed";
		const label = stopped
			? "Your Trakt import stopped before all history was processed."
			: hasUnmatched
				? `${job.unmatchedGroups.length} ${job.unmatchedGroups.length === 1 ? "title needs" : "titles need"} matching.`
				: hasIssues
					? `${job.couldntImportCount} ${job.couldntImportCount === 1 ? "item couldn’t" : "items couldn’t"} be imported.`
					: "Your Trakt import is complete.";
		return (
			<View className="flex-1 bg-background">
				<View
					className="flex-row items-center gap-2 border-border border-b bg-background-subtle px-4 pb-2"
					style={{ paddingTop: insets.top }}
				>
					{stopped || hasIssues ? (
						<AlertTriangle color="#d97706" size={17} />
					) : (
						<CheckCircle2 color="#16a34a" size={17} />
					)}
					<Text
						className="flex-1 text-muted-foreground text-sm"
						numberOfLines={2}
					>
						{label}
					</Text>
					<Link href="/trakt-import" asChild>
						<Pressable
							onPress={() => acknowledge.mutate({})}
							className="px-1 py-2"
						>
							<Text className="font-semibold text-primary text-sm">
								{hasUnmatched ? "Match" : "View"}
							</Text>
						</Pressable>
					</Link>
					<Pressable
						onPress={() => acknowledge.mutate({})}
						accessibilityLabel="Dismiss Trakt import result"
						className="p-2"
					>
						<X color="#94a3b8" size={17} />
					</Pressable>
				</View>
				<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
					{children}
				</SafeAreaInsetsContext.Provider>
			</View>
		);
	}

	const progress = getTraktImportStatusProgress(job);
	const waiting = job.status === "waiting_retry";
	const reason = waiting ? getRetryReason(job.lastError) : undefined;

	return (
		<View className="flex-1 bg-background">
			<Link href="/trakt-import" asChild>
				<Pressable
					className="border-border border-b bg-background-subtle px-4 pb-2"
					style={{ paddingTop: insets.top }}
				>
					<View className="flex-row items-center gap-2">
						<ActivityIndicator size="small" color="#f3bc00" />
						<Text className="flex-1 text-muted-foreground text-sm leading-5">
							Importing your Trakt history in the background
							{progress !== null ? ` — ${progress}%` : ""}
							{waiting
								? `. ${reason ?? "Paused to keep your account under its write limit."}`
								: ". You can keep using the app as usual."}
							{waiting && job.nextRunAt ? (
								<PauseCountdown nextRunAt={job.nextRunAt} />
							) : null}
						</Text>
					</View>
				</Pressable>
			</Link>
			{/* Drop the top inset for the wrapped screens — the banner already
			    consumed it — so their own paddingTop sits them flush, not gapped. */}
			<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
				{children}
			</SafeAreaInsetsContext.Provider>
		</View>
	);
}
