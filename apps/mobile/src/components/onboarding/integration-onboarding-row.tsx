import {
	type IntegrationDefinition,
	integrationKey,
	onboardingIntegrationAction,
	type SyncStatusDto,
	traktError,
} from "@opnshelf/api";
import {
	type UseQueryResult,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { Check } from "lucide-react-native";
import { View } from "react-native";
import { IntegrationMark } from "@/components/integrations/IntegrationMark";
import { SyncSettings } from "@/components/integrations/IntegrationSyncManager";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

/**
 * One Integration in the onboarding Integrations step: connect or set it up,
 * then choose what to sync with the same settings as Settings › Integrations.
 */
export function IntegrationOnboardingRow({
	integration,
	status,
	open,
	onOpen,
	onClose,
	divided,
	connectionFailed = false,
}: {
	integration: IntegrationDefinition;
	status: UseQueryResult<SyncStatusDto>;
	open: boolean;
	onOpen: () => void;
	onClose: () => void;
	divided: boolean;
	/** Set when this Integration's sign-in returned as a failed deep link. */
	connectionFailed?: boolean;
}) {
	const colors = useThemeColors();
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: integrationKey(integration) });
	const connect = useMutation({
		mutationKey: [...integrationKey(integration), "connect"],
		mutationFn: integration.api.connect,
		onSuccess: async (result) => {
			if (result.url) {
				const auth = await WebBrowser.openAuthSessionAsync(
					result.url,
					"opnshelf://onboarding",
				);
				if (
					auth.type === "success" &&
					new URL(auth.url).searchParams.get("connection") === "failed"
				)
					throw new Error(
						`${integration.name} could not connect. Try connecting again.`,
					);
				if (auth.type !== "success") return;
			}
			await refresh();
			onOpen();
		},
	});
	const data = status.data;
	const action = data && onboardingIntegrationAction(integration, data);
	const handle =
		data?.username && action?.kind !== "connect" ? `@${data.username}` : null;
	const error = status.error ?? connect.error;
	return (
		<View className={`gap-3 p-4 ${divided ? "border-border border-t" : ""}`}>
			<View className="flex-row items-center gap-3">
				<View className="size-10 items-center justify-center rounded-lg bg-background-subtle">
					<IntegrationMark id={integration.id} size={24} />
				</View>
				<View className="flex-1 gap-0.5">
					<View className="flex-row flex-wrap items-baseline gap-x-2">
						<Text className="font-semibold text-base text-foreground">
							{integration.name}
						</Text>
						{handle ? (
							<Text
								numberOfLines={1}
								className="shrink text-muted-foreground text-sm"
							>
								{handle}
							</Text>
						) : null}
					</View>
					<Text className="text-muted-foreground text-sm leading-5">
						{integration.summary}
					</Text>
				</View>
				{!action ? (
					!status.isError && (
						<View
							accessibilityLabel={`Loading ${integration.name}`}
							className="h-10 w-20 animate-pulse rounded-xl bg-background-subtle"
						/>
					)
				) : action.kind === "on" ? (
					<View className="flex-row items-center gap-1">
						<Check color={colors.success} size={16} />
						<Text className="font-medium text-sm text-success">On</Text>
					</View>
				) : action.kind === "unavailable" ? (
					<Text className="text-muted-foreground text-sm">Unavailable</Text>
				) : action.kind === "connect" ? (
					<Button
						variant="secondary"
						size="sm"
						label={action.label}
						accessibilityLabel={action.accessibilityLabel}
						loadingLabel={action.pending}
						loading={connect.isPending}
						onPress={() =>
							connect.mutate({ platform: "mobile", returnTo: "onboarding" })
						}
					/>
				) : !open ? (
					<Button
						variant="secondary"
						size="sm"
						label={action.label}
						accessibilityLabel={action.accessibilityLabel}
						onPress={onOpen}
					/>
				) : null}
			</View>
			{error || connectionFailed ? (
				<Text accessibilityRole="alert" className="text-destructive text-sm">
					{error
						? traktError(error)
						: `${integration.name} could not connect. Try connecting again.`}
				</Text>
			) : null}
			{open && data && action?.kind === "choose" ? (
				<SyncSettings
					key={data.username}
					integration={integration}
					status={data}
					onSaved={() => {
						void refresh();
						onClose();
					}}
					onCancel={onClose}
					className=""
					showHeading={false}
				/>
			) : null}
		</View>
	);
}
