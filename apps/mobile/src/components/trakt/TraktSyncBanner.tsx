import {
	formatRetryCountdown,
	getRetryReason,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status && isActiveTraktImportStatus(status) ? 5000 : false;
		},
	});

	if (!job || !isActiveTraktImportStatus(job.status)) {
		return <>{children}</>;
	}

	const progress = getTraktImportStatusProgress(job);
	const waiting = job.status === "waiting_retry";
	const reason = waiting ? getRetryReason(job.lastError) : undefined;

	return (
		<View className="flex-1 bg-background">
			<View
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
			</View>
			{/* Drop the top inset for the wrapped screens — the banner already
			    consumed it — so their own paddingTop sits them flush, not gapped. */}
			<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
				{children}
			</SafeAreaInsetsContext.Provider>
		</View>
	);
}
