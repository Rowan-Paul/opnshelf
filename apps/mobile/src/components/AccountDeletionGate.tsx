import {
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
} from "@opnshelf/api";
import { AlertTriangle } from "lucide-react-native";
import { ActivityIndicator, Modal, View } from "react-native";
import { Text } from "@/components/ui/text";
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "@/lib/use-account-deletion";

/**
 * App-wide block while a PDS deletion job runs. Mounted at the root so the
 * overlay comes back when the app is reopened mid-deletion — the job lives on
 * the server, not in the screen that started it. The no-op onRequestClose
 * swallows the Android hardware back button.
 */
export function AccountDeletionGate() {
	const job = useAccountDeletionJob();
	if (!isAccountDeletionRunning(job) || !job) return null;

	const progress = getAccountDeletionProgress(job);

	return (
		<Modal visible transparent animationType="fade" onRequestClose={() => {}}>
			<View className="flex-1 items-center justify-center bg-black/70 p-6">
				<View className="w-full max-w-sm gap-4 rounded-2xl border border-destructive/40 bg-card p-6">
					<View className="flex-row items-center gap-2">
						<AlertTriangle color="#ef4444" size={20} />
						<Text className="font-display font-semibold text-destructive text-lg">
							Deleting your account
						</Text>
					</View>
					<Text className="text-muted-foreground text-sm leading-5">
						This keeps running on our side if you close the app. You'll be
						signed out when it's done.
					</Text>
					<View className="flex-row items-center gap-2">
						<ActivityIndicator size="small" color="#ef4444" />
						<Text className="flex-1 font-medium text-destructive text-sm">
							{getAccountDeletionStatusMessage(job)}
						</Text>
					</View>
					{progress !== null ? (
						<View className="h-2 w-full overflow-hidden rounded-full bg-destructive/20">
							<View
								className="h-full rounded-full bg-destructive"
								style={{ width: `${progress}%` }}
							/>
						</View>
					) : null}
				</View>
			</View>
		</Modal>
	);
}
