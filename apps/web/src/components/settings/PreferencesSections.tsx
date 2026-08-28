import CountrySelector from "#/components/CountrySelector";
import TimezoneSelector from "#/components/TimezoneSelector";
import { Switch } from "#/components/ui/switch";
import { useAuth } from "#/lib/auth-context";
import { useUpdateSettings } from "./use-settings-mutations";

/** The compact, frequently revisited controls in Settings > Preferences. */
export function PreferencesSections() {
	const { userSettings } = useAuth();
	const updateSettingsMutation = useUpdateSettings();

	return (
		<>
			<section
				id="time-region"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<h2 className="mb-1 font-semibold text-lg">Time & Region</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Choose how dates and times are displayed
				</p>

				<div className="max-w-lg space-y-5">
					<div className="space-y-2">
						<label htmlFor="timezone" className="font-medium text-sm">
							Timezone
						</label>
						<TimezoneSelector
							value={userSettings?.timezone}
							onChange={(timezone) =>
								updateSettingsMutation.mutate({
									body: { timezone },
								})
							}
							disabled={updateSettingsMutation.isPending}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<label htmlFor="time-format" className="font-medium text-sm">
								24-hour time
							</label>
							<p className="text-(--foreground-muted) text-sm">
								Display times in 24-hour format
							</p>
						</div>
						<Switch
							id="time-format"
							checked={userSettings?.timeFormat === "24h"}
							onCheckedChange={(checked) =>
								updateSettingsMutation.mutate({
									body: { timeFormat: checked ? "24h" : "12h" },
								})
							}
							disabled={updateSettingsMutation.isPending}
						/>
					</div>
				</div>
			</section>

			<section
				id="streaming"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<h2 className="mb-1 font-semibold text-lg">Streaming</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Choose your country to see where movies and shows are available to
					watch
				</p>
				<div className="max-w-lg space-y-2">
					<label htmlFor="watch-country" className="font-medium text-sm">
						Country
					</label>
					<CountrySelector
						value={userSettings?.watchCountry}
						onChange={(watchCountry) =>
							updateSettingsMutation.mutate({
								body: { watchCountry },
							})
						}
						disabled={updateSettingsMutation.isPending}
					/>
				</div>
			</section>

			<section
				id="reading"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<h2 className="mb-1 font-semibold text-lg">Reading</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Control how spoiler-flagged reviews appear to you
				</p>

				<div className="flex max-w-lg items-center justify-between">
					<div>
						<label
							htmlFor="always-show-spoilers"
							className="font-medium text-sm"
						>
							Always show spoiler content
						</label>
						<p className="text-(--foreground-muted) text-sm">
							Skip the spoiler covers on reviews
						</p>
					</div>
					<Switch
						id="always-show-spoilers"
						checked={userSettings?.alwaysShowSpoilers ?? false}
						onCheckedChange={(checked) =>
							updateSettingsMutation.mutate({
								body: { alwaysShowSpoilers: checked },
							})
						}
						disabled={updateSettingsMutation.isPending}
					/>
				</div>
			</section>
		</>
	);
}
