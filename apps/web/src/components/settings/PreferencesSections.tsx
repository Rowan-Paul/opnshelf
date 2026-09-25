import { useEffect, useMemo, useRef, useState } from "react";
import CountrySelector from "#/components/CountrySelector";
import StreamingServicePicker, {
	toggleService,
} from "#/components/StreamingServicePicker";
import TimezoneSelector from "#/components/TimezoneSelector";
import { Switch } from "#/components/ui/switch";
import { useAuth } from "#/lib/auth-context";
import { createCoalescedSaver, sameIdSet } from "#/lib/coalesced-save";
import { type ThemeMode, useThemeMode } from "#/lib/theme";
import { NotificationEmailSection } from "./NotificationEmailSection";
import { useUpdateSettings } from "./use-settings-mutations";

const APPEARANCE_OPTIONS: { value: ThemeMode; label: string }[] = [
	{ value: "auto", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

/** Segmented row to pick the appearance preference, matching Mobile. */
function AppearanceSetting() {
	const { mode, hydrated, setMode } = useThemeMode();

	return (
		<div className="flex max-w-lg gap-2">
			{APPEARANCE_OPTIONS.map((option) => {
				const selected = hydrated && mode === option.value;
				return (
					<button
						key={option.value}
						type="button"
						onClick={() => setMode(option.value)}
						aria-pressed={selected}
						className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
							selected
								? "border-(--accent) bg-(--accent-subtle) font-semibold text-(--accent)"
								: "border-(--border) font-medium hover:bg-(--background-subtle)"
						}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

/** The compact, frequently revisited controls in Settings > Preferences. */
export function PreferencesSections() {
	const { userSettings } = useAuth();
	const updateSettingsMutation = useUpdateSettings();

	return (
		<>
			<section
				id="appearance"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<h2 className="mb-1 font-semibold text-lg">Appearance</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Choose how Opnshelf looks. System follows your device
				</p>
				<AppearanceSetting />
			</section>

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
			<NotificationEmailSection />

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
				<div className="mt-6 max-w-lg space-y-2">
					<p className="font-medium text-sm">My services</p>
					<p className="text-(--foreground-muted) text-sm">
						The streaming services you pay for. Used to show what you can watch
						on Up Next and Discover.
					</p>
					<MyServicesField />
				</div>
			</section>

			<section
				id="reviews"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<h2 className="mb-1 font-semibold text-lg">Reviews</h2>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Control how Spoiler Shields behave on reviews
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

/**
 * My Services in Settings saves on every toggle. The chosen set lives in
 * local state and writes go through a coalescing queue: one request at a
 * time, always carrying the full latest set, so quick toggles cannot race
 * each other. The server copy only overwrites local state once nothing is
 * in flight, so a refetch cannot undo a toggle that is still saving.
 */
function MyServicesField() {
	const { userSettings } = useAuth();
	const updateSettingsMutation = useUpdateSettings();
	const [selected, setSelected] = useState<number[]>(
		userSettings?.streamingServiceIds ?? [],
	);
	const mutateAsync = updateSettingsMutation.mutateAsync;
	const saver = useMemo(
		() =>
			createCoalescedSaver(
				(streamingServiceIds: number[]) =>
					mutateAsync({ body: { streamingServiceIds } }),
				sameIdSet,
			),
		[mutateAsync],
	);
	// Latest local set, independent of the render cycle, so toggles that
	// arrive before a re-render still build on each other.
	const latest = useRef(selected);
	const saved = userSettings?.streamingServiceIds;
	useEffect(() => {
		if (saved && !saver.isDirty()) {
			latest.current = saved;
			setSelected(saved);
		}
	}, [saved, saver]);

	return (
		<StreamingServicePicker
			country={userSettings?.watchCountry ?? "US"}
			value={selected}
			onToggle={(id) => {
				latest.current = toggleService(latest.current, id);
				setSelected(latest.current);
				saver.submit(latest.current);
			}}
		/>
	);
}
