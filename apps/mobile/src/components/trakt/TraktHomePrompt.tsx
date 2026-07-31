import {
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
	usersControllerSnoozeMyTraktReminderMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Film, TimerReset } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

export function TraktHomePrompt() {
	const queryClient = useQueryClient();
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
	});
	const snooze = useMutation({
		mutationKey: ["trakt", "import", "reminder", "snooze"],
		...usersControllerSnoozeMyTraktReminderMutation(),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
			}),
	});
	if (!job?.acknowledgedAt) return null;
	if (
		job.reminderSnoozedUntil &&
		new Date(job.reminderSnoozedUntil).getTime() > Date.now()
	) {
		return null;
	}
	const needsResume = job.status === "paused" || job.status === "failed";
	const groups = job.unmatchedGroups.length;
	if (!needsResume && groups === 0) return null;
	const watches = job.unmatchedGroups.reduce(
		(total, group) => total + group.watchCount,
		0,
	);
	return (
		<View className="gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5">
			<View className="flex-row items-start gap-3">
				<View className="rounded-full bg-primary/10 p-3">
					{needsResume ? (
						<TimerReset color="#f3bc00" size={20} />
					) : (
						<Film color="#f3bc00" size={20} />
					)}
				</View>
				<View className="flex-1 gap-1">
					<Text className="font-display font-semibold text-foreground text-lg">
						{needsResume
							? "Your Trakt import is waiting"
							: `${groups} ${groups === 1 ? "title needs" : "titles need"} your help`}
					</Text>
					<Text className="text-muted-foreground text-sm leading-5">
						{needsResume
							? "Resume from the saved position to finish examining your history."
							: `Match ${groups === 1 ? "it" : "them"} to add ${watches} ${watches === 1 ? "Watch" : "Watches"} to your Shelf.`}
					</Text>
				</View>
			</View>
			<View className="flex-row items-center justify-end gap-2">
				<Pressable
					onPress={() => snooze.mutate({})}
					disabled={snooze.isPending}
					className="px-3 py-2"
				>
					<Text className="font-medium text-muted-foreground text-sm">
						Remind me later
					</Text>
				</Pressable>
				<Link href="/trakt-import" asChild>
					<Pressable className="rounded-xl bg-primary px-4 py-2.5">
						<Text className="font-semibold text-primary-foreground text-sm">
							{needsResume ? "Resume import" : "Match titles"}
						</Text>
					</Pressable>
				</Link>
			</View>
		</View>
	);
}
