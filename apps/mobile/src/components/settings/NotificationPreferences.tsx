import {
	notificationsControllerConfirmEmailMutation,
	notificationsControllerRequestEmailMutation,
	notificationsControllerSettingsOptions,
	notificationsControllerUpdateSettingsMutation,
	type UpdateNotificationSettingsDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { requestAndRegisterPush } from "@/lib/push-notifications";

const CATEGORIES = [
	{
		label: "New releases",
		detail: "A weekly digest of new movies and shows",
		push: "pushNewReleases",
		email: "emailNewReleases",
	},
	{
		label: "Watchlist releases",
		detail: "When a title on your Watchlist releases",
		push: "pushWatchlistReleases",
		email: "emailWatchlistReleases",
	},
	{
		label: "New seasons",
		detail: "When a show you watch or save starts a new season",
		push: "pushNewSeasons",
		email: "emailNewSeasons",
	},
	{
		label: "Watch stats",
		detail: "Weekly, monthly and yearly summaries",
		push: "pushStats",
		email: "emailStats",
	},
] as const;
type SettingKey = keyof UpdateNotificationSettingsDto;

export function NotificationPreferences() {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [emailInput, setEmailInput] = useState("");
	const [code, setCode] = useState("");
	const [awaitingCode, setAwaitingCode] = useState(false);
	const [pushGranted, setPushGranted] = useState(false);
	const [pendingKey, setPendingKey] = useState<SettingKey | null>(null);
	const {
		data: settings,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...notificationsControllerSettingsOptions(),
	});
	const update = useMutation({
		...notificationsControllerUpdateSettingsMutation(),
	});
	const requestEmail = useMutation({
		...notificationsControllerRequestEmailMutation(),
	});
	const confirmEmail = useMutation({
		...notificationsControllerConfirmEmailMutation(),
	});

	useEffect(() => {
		if (!Device.isDevice) return;
		void Notifications.getPermissionsAsync().then((permission) => {
			setPushGranted(
				permission.granted ||
					permission.ios?.status ===
						Notifications.IosAuthorizationStatus.PROVISIONAL,
			);
		});
	}, []);

	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: notificationsControllerSettingsOptions().queryKey,
		});

	const change = async (key: SettingKey, checked: boolean) => {
		setPendingKey(key);
		try {
			await update.mutateAsync({ body: { [key]: checked } });
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not update notifications",
			);
		} finally {
			setPendingKey(null);
		}
	};

	const enablePush = async () => {
		try {
			const granted = await requestAndRegisterPush();
			if (!granted) {
				toast.error(
					"Allow notifications in your device settings to enable push alerts.",
				);
				return;
			}
			setPushGranted(true);
			await refresh();
			toast.success("Mobile notifications enabled");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not enable notifications",
			);
		}
	};

	const sendCode = async () => {
		try {
			await requestEmail.mutateAsync({ body: { email: emailInput.trim() } });
			setAwaitingCode(true);
			toast.success("Confirmation code sent");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not send the code",
			);
		}
	};

	const verifyCode = async () => {
		try {
			await confirmEmail.mutateAsync({ body: { code: code.trim() } });
			setAwaitingCode(false);
			setCode("");
			await refresh();
			toast.success("Email confirmed");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not confirm email",
			);
		}
	};

	if (isLoading) {
		return (
			<View className="gap-4">
				<View className="h-10 rounded bg-background-subtle" />
				<View className="h-28 rounded bg-background-subtle" />
			</View>
		);
	}
	if (isError || !settings) {
		return (
			<ErrorState
				message="Could not load notification settings."
				onRetry={() => void refetch()}
			/>
		);
	}

	return (
		<View className="gap-5">
			<View className="gap-2">
				<Text className="font-medium text-foreground text-sm">
					Mobile notifications
				</Text>
				<Text className="text-muted-foreground text-sm">
					{pushGranted
						? "Allowed on this device"
						: "Enable alerts on this device to receive mobile notifications."}
				</Text>
				{!pushGranted && (
					<Button
						label="Enable mobile notifications"
						size="sm"
						onPress={() => void enablePush()}
						disabled={!Device.isDevice}
						className="self-start"
					/>
				)}
				{!Device.isDevice && (
					<Text className="text-muted-foreground text-xs">
						A physical device is required for push notifications.
					</Text>
				)}
			</View>

			<View className="gap-2">
				<Text className="font-medium text-foreground text-sm">
					Email notifications
				</Text>
				{settings.emailVerified && settings.email ? (
					<Text className="text-muted-foreground text-sm">
						Sending to {settings.email}
					</Text>
				) : (
					<Text className="text-muted-foreground text-sm">
						Confirm an email address to receive email notifications.
					</Text>
				)}
				{!awaitingCode ? (
					<View className="gap-2">
						{(!settings.emailVerified || !settings.email) && (
							<TextField
								label="Email address"
								value={emailInput}
								onChangeText={setEmailInput}
								keyboardType="email-address"
								autoCapitalize="none"
								autoComplete="email"
							/>
						)}
						{emailInput.trim() && (
							<Button
								label={
									settings.emailVerified
										? "Change email address"
										: "Send confirmation code"
								}
								size="sm"
								variant="secondary"
								loading={requestEmail.isPending}
								onPress={() => void sendCode()}
								className="self-start"
							/>
						)}
						{settings.emailVerified && !emailInput && (
							<Button
								label="Use a different email"
								size="sm"
								variant="secondary"
								onPress={() => setEmailInput(settings.email ?? "")}
								className="self-start"
							/>
						)}
					</View>
				) : (
					<View className="gap-2">
						<TextField
							label="Six-digit code"
							value={code}
							onChangeText={setCode}
							keyboardType="number-pad"
							maxLength={6}
						/>
						<Button
							label="Confirm email"
							size="sm"
							loading={confirmEmail.isPending}
							disabled={code.length !== 6}
							onPress={() => void verifyCode()}
							className="self-start"
						/>
					</View>
				)}
			</View>

			<View className="gap-3">
				<View className="flex-row justify-end gap-5">
					<Text className="w-12 text-center text-muted-foreground text-xs">
						Mobile
					</Text>
					<Text className="w-12 text-center text-muted-foreground text-xs">
						Email
					</Text>
				</View>
				{CATEGORIES.map((category) => (
					<View
						key={category.label}
						className="flex-row items-center justify-between gap-3 border-border border-t pt-3"
					>
						<View className="flex-1 gap-0.5">
							<Text className="font-medium text-foreground text-sm">
								{category.label}
							</Text>
							<Text className="text-muted-foreground text-xs">
								{category.detail}
							</Text>
						</View>
						<Switch
							value={settings[category.push]}
							onValueChange={(checked) => void change(category.push, checked)}
							disabled={!pushGranted || pendingKey === category.push}
						/>
						<Switch
							value={settings[category.email]}
							onValueChange={(checked) => void change(category.email, checked)}
							disabled={
								!settings.emailVerified || pendingKey === category.email
							}
						/>
					</View>
				))}
			</View>
		</View>
	);
}
