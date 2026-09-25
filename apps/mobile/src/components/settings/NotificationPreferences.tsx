import {
	notificationsControllerConfirmEmailMutation,
	notificationsControllerRequestEmailMutation,
	notificationsControllerSettingsOptions,
	notificationsControllerTestNotificationMutation,
	notificationsControllerUpdateSettingsMutation,
	type UpdateNotificationSettingsDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { AppState, Switch, View } from "react-native";
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
	const [pushPending, setPushPending] = useState(false);
	const [pushError, setPushError] = useState<string | null>(null);
	const pushInFlight = useRef(false);
	const [pendingKey, setPendingKey] = useState<SettingKey | null>(null);
	const {
		data: settings,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...notificationsControllerSettingsOptions(),
	});
	const testNotification = useMutation({
		...notificationsControllerTestNotificationMutation(),
	});
	const sendTest = async (channel: "push" | "email") => {
		try {
			await testNotification.mutateAsync({ body: { channel } });
			toast.success(
				"Test accepted for delivery. Check your " +
					(channel === "push" ? "device." : "inbox."),
			);
		} catch {
			toast.error(
				"Could not send the test. Check notification setup and try again.",
			);
		}
	};

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
		let active = true;
		const refreshPermission = async () => {
			try {
				const permission = await Notifications.getPermissionsAsync();
				if (active)
					setPushGranted(
						permission.granted ||
							permission.ios?.status ===
								Notifications.IosAuthorizationStatus.PROVISIONAL,
					);
			} catch {
				if (active)
					setPushError("Could not read notification permission. Try again.");
			}
		};
		void refreshPermission();
		const listener = AppState.addEventListener("change", (state) => {
			if (state === "active") void refreshPermission();
		});
		return () => {
			active = false;
			listener.remove();
		};
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
		if (pushInFlight.current) return;
		pushInFlight.current = true;
		setPushPending(true);
		setPushError(null);
		try {
			const registered = await requestAndRegisterPush(setPushGranted);
			if (!registered) {
				setPushError(
					"Mobile alerts are not connected. Check notification permission in device settings and try again.",
				);
				return;
			}
			await refresh();
			toast.success("Mobile notifications enabled");
		} catch {
			setPushError(
				"We could not connect this device for mobile alerts. Check your connection and try again.",
			);
		} finally {
			pushInFlight.current = false;
			setPushPending(false);
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
				{
					<Button
						label={
							pushGranted
								? "Reconnect mobile notifications"
								: "Enable mobile notifications"
						}
						loading={pushPending}
						loadingLabel="Connecting mobile alerts…"
						size="sm"
						onPress={() => void enablePush()}
						disabled={!Device.isDevice}
						className="self-start"
					/>
				}
				{pushError && (
					<Text accessibilityRole="alert" className="text-destructive text-sm">
						{pushError}
					</Text>
				)}
				{pushGranted && (
					<Button
						label="Send test mobile notification"
						size="sm"
						variant="secondary"
						disabled={testNotification.isPending || pushPending}
						onPress={() => void sendTest("push")}
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
				{settings.emailVerified && (
					<Button
						label="Send test email"
						size="sm"
						variant="secondary"
						disabled={testNotification.isPending}
						onPress={() => void sendTest("email")}
					/>
				)}
				{!awaitingCode ? (
					<View className="gap-2">
						{(!settings.emailVerified || !settings.email || emailInput) && (
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
								loadingLabel="Sending code…"
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
							loadingLabel="Confirming email…"
							disabled={code.length !== 6}
							onPress={() => void verifyCode()}
							className="self-start"
						/>
						<View className="flex-row flex-wrap gap-2">
							<Button
								label="Resend code"
								size="sm"
								variant="secondary"
								loading={requestEmail.isPending}
								loadingLabel="Resending code…"
								onPress={() => void sendCode()}
							/>
							<Button
								label="Change email address"
								size="sm"
								variant="secondary"
								onPress={() => {
									setCode("");
									setAwaitingCode(false);
								}}
							/>
						</View>
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
