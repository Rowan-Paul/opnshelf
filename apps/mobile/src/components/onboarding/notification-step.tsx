import {
	getErrorMessage,
	type NotificationSettingsDto,
	notificationsControllerConfirmEmailMutation,
	notificationsControllerRequestEmailMutation,
	notificationsControllerSettingsOptions,
	notificationsControllerUpdateSettingsMutation,
	type UpdateNotificationSettingsDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Device from "expo-device";
import { Bell, Check, type LucideIcon, Mail } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { requestAndRegisterPush } from "@/lib/push-notifications";
import { useThemeColors } from "@/theme/colors";

const TOPICS = [
	{
		label: "Watchlist releases",
		detail: "When a saved title releases",
		push: "pushWatchlistReleases",
		email: "emailWatchlistReleases",
	},
	{
		label: "New seasons",
		detail: "When a show you watch or save returns",
		push: "pushNewSeasons",
		email: "emailNewSeasons",
	},
	{
		label: "Weekly new releases",
		detail: "A digest of new movies and shows",
		push: "pushNewReleases",
		email: "emailNewReleases",
	},
	{
		label: "Your Watch Recap",
		detail: "Your week, month and year in Watches",
		push: "pushStats",
		email: "emailStats",
	},
] as const;

export type NotificationStage = "topics" | "delivery" | "confirmation";
type Props = {
	stage: NotificationStage;
	onStageChange: (stage: NotificationStage) => void;
	onBusyChange: (busy: boolean) => void;
	onNext: () => void;
};

/** Onboarding drafts are separate from Settings' immediate-save controls. */
export function NotificationStep(props: Props) {
	const insets = useSafeAreaInsets();
	const query = useQuery(notificationsControllerSettingsOptions());
	if (!query.data) {
		return (
			<View className="flex-1">
				<View className="flex-1 gap-6 pt-1">
					{query.isError ? (
						<ErrorState
							message="Could not load notification settings."
							onRetry={() => void query.refetch()}
						/>
					) : (
						<>
							<View className="h-20 rounded-lg bg-background-subtle" />
							{TOPICS.map((topic) => (
								<View
									key={topic.push}
									className="h-20 rounded-lg bg-background-subtle"
								/>
							))}
						</>
					)}
				</View>
				<View style={{ paddingBottom: insets.bottom + 8 }}>
					<SkipButton onPress={props.onNext} />
				</View>
			</View>
		);
	}
	return <NotificationDraft {...props} settings={query.data} />;
}

function SkipButton({
	onPress,
	disabled = false,
}: {
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Not now"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			className="min-h-11 items-center justify-center"
		>
			<Text className="text-muted-foreground text-sm">Not now</Text>
		</Pressable>
	);
}

function Choice({
	label,
	detail,
	selected,
	disabled,
	onPress,
	icon: Icon,
}: {
	label: string;
	detail: string;
	selected: boolean;
	disabled: boolean;
	onPress: () => void;
	icon?: LucideIcon;
}) {
	const colors = useThemeColors();
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={label}
			accessibilityHint={detail}
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			className="min-h-20 flex-row items-center gap-4 border-border border-b py-5"
		>
			{Icon ? (
				<View className="h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
					<Icon color={colors.accent} size={21} />
				</View>
			) : null}
			{!Icon ? <SelectionMark selected={selected} /> : null}
			<View className="flex-1 gap-1">
				<Text className="font-semibold text-base text-foreground">{label}</Text>
				<Text className="text-muted-foreground text-sm leading-5">
					{detail}
				</Text>
			</View>
			{Icon ? <SelectionMark selected={selected} /> : null}
		</Pressable>
	);
}

function SelectionMark({ selected }: { selected: boolean }) {
	return (
		<View
			className={cn(
				"h-6 w-6 items-center justify-center rounded-md border",
				selected ? "border-primary bg-primary" : "border-border-strong",
			)}
		>
			{selected ? <Check color="#3f2e00" size={16} strokeWidth={3} /> : null}
		</View>
	);
}

function NotificationDraft({
	settings,
	stage,
	onStageChange,
	onBusyChange,
	onNext,
}: Props & { settings: NotificationSettingsDto }) {
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const [topics, setTopics] = useState(() =>
		TOPICS.map((topic, index) =>
			settings.emailVerified || settings.pushDeviceCount > 0
				? (settings.emailVerified && settings[topic.email]) ||
					(settings.pushDeviceCount > 0 && settings[topic.push])
				: index < 2,
		),
	);
	const [mobile, setMobile] = useState(true);
	const [email, setEmail] = useState(false);
	const [address, setAddress] = useState(settings.email ?? "");
	const [confirmedAddress, setConfirmedAddress] = useState(
		settings.emailVerified ? settings.email?.toLowerCase() : undefined,
	);
	const [sentAddress, setSentAddress] = useState("");
	const [code, setCode] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);
	const requestEmail = useMutation(
		notificationsControllerRequestEmailMutation(),
	);
	const confirmEmail = useMutation(
		notificationsControllerConfirmEmailMutation(),
	);
	const update = useMutation(notificationsControllerUpdateSettingsMutation());
	const normalizedAddress = address.trim().toLowerCase();
	const hasTopics = topics.some(Boolean);
	const emailNeedsConfirmation =
		email && normalizedAddress !== confirmedAddress;
	const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAddress);

	const run = async (action: () => Promise<void>) => {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		onBusyChange(true);
		setError(null);
		try {
			await action();
		} catch (reason) {
			setError(
				getErrorMessage(reason, "Could not set up notifications. Try again."),
			);
		} finally {
			inFlight.current = false;
			setPending(false);
			onBusyChange(false);
		}
	};

	const saveDelivery = async () => {
		const mobileDelivery = mobile && hasTopics;
		const emailDelivery = email && hasTopics;
		if (mobileDelivery) {
			const registered = await requestAndRegisterPush();
			if (!registered) {
				setError(
					Device.isDevice
						? "Mobile alerts are not connected. Check permission in device settings, try again, or deselect Mobile to continue."
						: "Mobile alerts need a physical device. Deselect Mobile to continue with email, or choose Not now.",
				);
				onStageChange("delivery");
				return;
			}
		}
		const patch: UpdateNotificationSettingsDto = {};
		for (const [index, topic] of TOPICS.entries()) {
			patch[topic.push] = mobileDelivery && topics[index];
			patch[topic.email] = emailDelivery && topics[index];
		}
		await update.mutateAsync({ body: patch });
		await queryClient.invalidateQueries({
			queryKey: notificationsControllerSettingsOptions().queryKey,
		});
		onNext();
	};

	const sendCode = async () => {
		await requestEmail.mutateAsync({ body: { email: normalizedAddress } });
		setSentAddress(normalizedAddress);
		setCode("");
		onStageChange("confirmation");
	};

	const continueSetup = () => {
		if (stage === "topics") {
			if (hasTopics) onStageChange("delivery");
			else void run(saveDelivery);
			return;
		}
		if (!mobile && !email) {
			void run(saveDelivery);
			return;
		}
		void run(async () => {
			if (stage === "confirmation") {
				await confirmEmail.mutateAsync({ body: { code: code.trim() } });
				setConfirmedAddress(normalizedAddress);
				// Verification succeeded even if the subsequent save needs a retry.
				onStageChange("delivery");
			} else if (emailNeedsConfirmation) {
				if (sentAddress === normalizedAddress) onStageChange("confirmation");
				else await sendCode();
				return;
			}
			await saveDelivery();
		});
	};

	const label =
		stage === "topics"
			? hasTopics
				? "Choose delivery"
				: "Continue without alerts"
			: stage === "confirmation"
				? "Confirm and continue"
				: mobile && email
					? "Continue with both"
					: mobile
						? "Continue with mobile"
						: email
							? "Continue with email"
							: "Continue without alerts";
	const disabled =
		stage === "confirmation"
			? !/^\d{6}$/.test(code.trim())
			: stage === "delivery" && emailNeedsConfirmation && !validEmail;

	return (
		<View className="flex-1">
			<ScrollView
				className="flex-1"
				contentContainerClassName="gap-6 pt-1 pb-4"
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View className="gap-3">
					<Text
						accessibilityRole="header"
						className="font-display-bold text-3xl text-foreground"
					>
						{stage === "topics"
							? "What should we keep you posted on?"
							: stage === "delivery"
								? "Where should your updates arrive?"
								: "Check your inbox"}
					</Text>
					<Text className="text-base text-muted-foreground leading-6">
						{stage === "topics"
							? "Choose your topics. Next, choose mobile alerts or email."
							: stage === "delivery"
								? "Choose one or both. We’ll use the topics you just selected."
								: `Enter the six-digit code sent to ${sentAddress}.`}
					</Text>
				</View>
				{stage === "topics" ? (
					<View>
						{TOPICS.map((topic, index) => (
							<Choice
								key={topic.push}
								label={topic.label}
								detail={topic.detail}
								selected={topics[index]}
								disabled={pending}
								onPress={() =>
									setTopics((current) =>
										current.map((selected, i) =>
											i === index ? !selected : selected,
										),
									)
								}
							/>
						))}
						<Text className="pt-6 text-center text-muted-foreground text-sm">
							Only the topics you choose.
						</Text>
					</View>
				) : stage === "delivery" ? (
					<>
						<View>
							<Choice
								label="On my mobile"
								detail="Alerts on this device"
								icon={Bell}
								selected={mobile}
								disabled={pending}
								onPress={() => {
									setMobile(!mobile);
									setError(null);
								}}
							/>
							<Choice
								label="In my inbox"
								detail="Updates by email"
								icon={Mail}
								selected={email}
								disabled={pending}
								onPress={() => {
									setEmail(!email);
									setError(null);
								}}
							/>
						</View>
						{email ? (
							<TextField
								label="Email address"
								accessibilityLabel="Email address"
								value={address}
								onChangeText={(value) => {
									setAddress(value);
									setError(null);
								}}
								editable={!pending}
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="email"
								helperText={
									emailNeedsConfirmation
										? "We’ll send a code to confirm your address."
										: "This address is already confirmed."
								}
							/>
						) : null}
						<View className="gap-2 pt-2">
							<Text className="text-muted-foreground text-sm">Your topics</Text>
							<View className="flex-row flex-wrap gap-2">
								{TOPICS.filter((_, index) => topics[index]).map((topic) => (
									<View
										key={topic.push}
										className="rounded-md bg-background-subtle px-3 py-2"
									>
										<Text className="text-foreground text-xs">
											{topic.label}
										</Text>
									</View>
								))}
							</View>
						</View>
					</>
				) : (
					<View className="gap-4">
						<TextField
							label="Six-digit code"
							accessibilityLabel="Six-digit code"
							value={code}
							onChangeText={setCode}
							editable={!pending}
							keyboardType="number-pad"
							autoComplete="one-time-code"
							textContentType="oneTimeCode"
							maxLength={6}
						/>
						<Button
							label="Send a new code"
							variant="secondary"
							disabled={pending}
							onPress={() => void run(sendCode)}
						/>
						<Text className="text-muted-foreground text-sm">
							The code expires after 10 minutes. Go back to change the address
							or delivery choices.
						</Text>
					</View>
				)}
				{error ? (
					<Text
						selectable
						accessibilityRole="alert"
						className="text-destructive text-sm leading-5"
					>
						{error}
					</Text>
				) : null}
			</ScrollView>
			<View className="gap-2 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
				<Button
					label={label}
					disabled={disabled}
					loading={pending}
					loadingLabel="Setting up notifications…"
					onPress={continueSetup}
				/>
				<SkipButton disabled={pending} onPress={onNext} />
			</View>
		</View>
	);
}
