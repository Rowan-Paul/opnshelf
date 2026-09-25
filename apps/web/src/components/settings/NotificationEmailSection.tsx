import {
	notificationsControllerConfirmEmailMutation,
	notificationsControllerRequestEmailMutation,
	notificationsControllerSettingsOptions,
	notificationsControllerUpdateSettingsMutation,
	type UpdateNotificationSettingsDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "#/components/ui/switch";

const CATEGORIES = [
	{
		label: "New releases",
		detail: "A weekly digest of new movies and shows",
		key: "emailNewReleases",
	},
	{
		label: "Watchlist releases",
		detail: "When a title on your Watchlist releases",
		key: "emailWatchlistReleases",
	},
	{
		label: "New seasons",
		detail: "When a show you watch or save starts a new season",
		key: "emailNewSeasons",
	},
	{
		label: "Watch stats",
		detail: "Weekly, monthly and yearly summaries",
		key: "emailStats",
	},
] as const;

export function NotificationEmailSection() {
	const queryClient = useQueryClient();
	const [emailInput, setEmailInput] = useState("");
	const [code, setCode] = useState("");
	const [awaitingCode, setAwaitingCode] = useState(false);
	const [pendingKey, setPendingKey] = useState<
		keyof UpdateNotificationSettingsDto | null
	>(null);
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
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: notificationsControllerSettingsOptions().queryKey,
		});

	const change = async (
		key: keyof UpdateNotificationSettingsDto,
		checked: boolean,
	) => {
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

	return (
		<section className="p-5 sm:p-7">
			<h2 className="mb-1 font-semibold text-lg">Email delivery</h2>
			<p className="mb-6 text-(--foreground-muted) text-sm">
				Choose which updates Opnshelf emails you.
			</p>
			{isLoading ? (
				<div className="max-w-lg space-y-3" aria-hidden="true">
					<div className="h-10 animate-pulse rounded bg-(--background-subtle)" />
					<div className="h-28 animate-pulse rounded bg-(--background-subtle)" />
				</div>
			) : isError || !settings ? (
				<button
					type="button"
					className="btn btn-secondary"
					onClick={() => void refetch()}
				>
					Could not load settings. Retry
				</button>
			) : (
				<div className="max-w-lg space-y-6">
					<div className="space-y-3">
						{settings.emailVerified && settings.email ? (
							<p className="text-(--foreground-muted) text-sm">
								Sending to {settings.email}
							</p>
						) : (
							<p className="text-(--foreground-muted) text-sm">
								Confirm an email address to receive notifications.
							</p>
						)}
						{!awaitingCode ? (
							<div className="space-y-2">
								{(!settings.emailVerified || !settings.email || emailInput) && (
									<input
										type="email"
										aria-label="Notification email address"
										value={emailInput}
										onChange={(event) => setEmailInput(event.target.value)}
										className="w-full rounded-lg border border-(--border) bg-(--background) px-3 py-2"
										placeholder="you@example.com"
									/>
								)}
								{emailInput ? (
									<button
										type="button"
										className="btn btn-secondary"
										disabled={requestEmail.isPending}
										onClick={() => void sendCode()}
									>
										Send confirmation code
									</button>
								) : settings.emailVerified ? (
									<button
										type="button"
										className="btn btn-secondary"
										onClick={() => setEmailInput(settings.email ?? "")}
									>
										Use a different email
									</button>
								) : null}
							</div>
						) : (
							<div className="space-y-2">
								<input
									type="text"
									inputMode="numeric"
									aria-label="Six-digit confirmation code"
									maxLength={6}
									value={code}
									onChange={(event) => setCode(event.target.value)}
									className="w-full rounded-lg border border-(--border) bg-(--background) px-3 py-2"
									placeholder="Six-digit code"
								/>
								<button
									type="button"
									className="btn btn-secondary"
									disabled={code.length !== 6 || confirmEmail.isPending}
									onClick={() => void verifyCode()}
								>
									Confirm email
								</button>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className="btn btn-secondary"
										disabled={requestEmail.isPending}
										onClick={() => void sendCode()}
									>
										Resend code
									</button>
									<button
										type="button"
										className="btn btn-secondary"
										onClick={() => {
											setCode("");
											setAwaitingCode(false);
										}}
									>
										Change email address
									</button>
								</div>
							</div>
						)}
					</div>
					<div className="space-y-4">
						{CATEGORIES.map((category) => (
							<div
								key={category.key}
								className="flex items-center justify-between gap-4 border-(--border) border-t pt-4"
							>
								<div>
									<label htmlFor={category.key} className="font-medium text-sm">
										{category.label}
									</label>
									<p className="text-(--foreground-muted) text-sm">
										{category.detail}
									</p>
								</div>
								<Switch
									id={category.key}
									checked={settings[category.key]}
									onCheckedChange={(checked) =>
										void change(category.key, checked)
									}
									disabled={
										!settings.emailVerified || pendingKey === category.key
									}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
}
