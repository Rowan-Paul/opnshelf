import {
	Check,
	CloudDownload,
	FileSpreadsheet,
	Sparkles,
	UserCircle2,
	Users,
	WandSparkles,
} from "lucide-react";
import { M3Button } from "@/components/ui/m3-button";
import { TIMEZONE_GROUPS } from "@/lib/timezones";
import type {
	FollowImportResult,
	FollowImportStatus,
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
	TraktImportPreview,
} from "./types";

const ONBOARDING_STEP_DETAILS = [
	{
		title: "Briefing",
		description: "See how your shelf gets calibrated.",
	},
	{
		title: "Identity",
		description: "Tune your profile card and local time.",
	},
	{
		title: "Friends",
		description: "Pull in your Bluesky following on OpnShelf.",
	},
	{
		title: "Import",
		description: "Bring your watch history from Trakt or CSV.",
	},
	{
		title: "Launch",
		description: "Review import status and open your shelf.",
	},
] as const;

const STEP_ICONS = [
	Sparkles,
	UserCircle2,
	Users,
	CloudDownload,
	WandSparkles,
] as const;
const INPUT_CLASS =
	"w-full rounded-(--md-sys-shape-corner-medium) border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface)] px-3 py-2 text-[var(--md-sys-color-on-surface)] outline-none transition placeholder:text-[var(--md-sys-color-on-surface-variant)] focus:border-[var(--md-sys-color-primary)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/30";

export const ONBOARDING_STEPS = ONBOARDING_STEP_DETAILS.length;

type OnboardingContentProps = {
	step: number;
	progress: number;
	activeTab: TabValue;
	traktUsername: string;
	traktPreview: TraktImportPreview | null;
	displayName: string;
	timezone: string;
	timeFormat: "12h" | "24h";
	displayNameId: string;
	timezoneId: string;
	fileInputId: string;
	hasBlueskyProfile: boolean;
	userAvatarUrl: string;
	followImportStatus: FollowImportStatus;
	followImportResult: FollowImportResult | null;
	importProgress: ImportProgressState;
	importPercent: number;
	importResult: OnboardingImportResult;
	isCompleting: boolean;
	isSavingProfile: boolean;
	isImportBusy: boolean;
	onStepChange: (step: number) => void;
	onActiveTabChange: (tab: TabValue) => void;
	onTraktUsernameChange: (value: string) => void;
	onDisplayNameChange: (value: string) => void;
	onTimezoneChange: (value: string) => void;
	onTimeFormatChange: (value: "12h" | "24h") => void;
	onSkipSetup: () => void;
	onImportBlueskyFollows: () => void;
	onSkipFollowImport: () => void;
	onContinueAfterFollowImport: () => void;
	onSaveProfileAndContinue: () => void;
	onTraktImport: () => void;
	onTraktImportConfirm: () => void;
	onCsvUpload: (file: File) => void;
	onSkipHistoryImport: () => void;
	onComplete: () => void;
};

export function OnboardingContent({
	step,
	progress,
	activeTab,
	traktUsername,
	traktPreview,
	displayName,
	timezone,
	timeFormat,
	displayNameId,
	timezoneId,
	fileInputId,
	hasBlueskyProfile,
	userAvatarUrl,
	followImportStatus,
	followImportResult,
	importProgress,
	importPercent,
	importResult,
	isCompleting,
	isSavingProfile,
	isImportBusy,
	onStepChange,
	onActiveTabChange,
	onTraktUsernameChange,
	onDisplayNameChange,
	onTimezoneChange,
	onTimeFormatChange,
	onSkipSetup,
	onImportBlueskyFollows,
	onSkipFollowImport,
	onContinueAfterFollowImport,
	onSaveProfileAndContinue,
	onTraktImport,
	onTraktImportConfirm,
	onCsvUpload,
	onSkipHistoryImport,
	onComplete,
}: OnboardingContentProps) {
	const visibleStepDetails = hasBlueskyProfile
		? ONBOARDING_STEP_DETAILS
		: ONBOARDING_STEP_DETAILS.filter((_, index) => index !== 2);
	const visibleStepIcons = hasBlueskyProfile
		? STEP_ICONS
		: STEP_ICONS.filter((_, index) => index !== 2);
	const visibleStep = hasBlueskyProfile ? step : step >= 4 ? step - 1 : step;
	const totalSteps = visibleStepDetails.length;
	const currentStepDetail =
		visibleStepDetails[visibleStep - 1] ?? visibleStepDetails[0];
	const isTraktImporting =
		activeTab === "trakt" && importProgress.phase === "importing";
	const showImportStatusAboveInput =
		importProgress.phase !== "idle" && !isTraktImporting;
	const followMessage = getFollowImportMessage(
		followImportStatus,
		followImportResult,
	);

	return (
		<div className="flex flex-1 justify-center bg-(--md-sys-color-surface) p-4 md:p-6">
			<div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
				<aside className="flex flex-col gap-5 rounded-(--md-sys-shape-corner-extra-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-low) p-5">
					<p className="md-label-small m-0 uppercase tracking-[0.14em] text-(--md-sys-color-primary)">
						Onboarding
					</p>
					<h1 className="md-headline-medium m-0">Welcome to OpnShelf</h1>
					<p className="md-body-medium m-0 text-(--md-sys-color-on-surface-variant)">
						This setup turns a blank profile into a ready-to-track shelf with
						your preferred timezone and imported watch history.
					</p>

					<ol
						className="m-0 grid list-none gap-2 p-0"
						aria-label="Onboarding steps"
					>
						{visibleStepDetails.map((item, index) => {
							const StepIcon = visibleStepIcons[index];
							const stepNumber = index + 1;
							const isComplete = visibleStep > stepNumber;
							const isActive = visibleStep === stepNumber;

							return (
								<li
									key={item.title}
									className={`flex items-start gap-3 rounded-(--md-sys-shape-corner-large) border p-3 ${
										isActive
											? "border-(--md-sys-color-outline) bg-(--md-sys-color-surface-container)"
											: "border-transparent"
									}`}
								>
									<span
										className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
											isComplete
												? "bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary)"
												: "bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)"
										}`}
									>
										{isComplete ? <Check size={16} /> : <StepIcon size={16} />}
									</span>
									<span className="grid gap-0.5">
										<strong className="md-label-large text-(--md-sys-color-on-surface)">
											{item.title}
										</strong>
										<small className="md-body-small text-(--md-sys-color-on-surface-variant)">
											{item.description}
										</small>
									</span>
								</li>
							);
						})}
					</ol>
				</aside>

				<section className="flex flex-col gap-4 rounded-(--md-sys-shape-corner-extra-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-low) p-4 md:p-6">
					<header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<p className="md-label-small m-0 uppercase text-(--md-sys-color-primary)">
								Step {visibleStep} of {totalSteps}
							</p>
							<h2 className="md-title-large m-0 mt-1">
								{currentStepDetail.title}
							</h2>
							<p className="md-body-medium m-0 text-(--md-sys-color-on-surface-variant)">
								{currentStepDetail.description}
							</p>
						</div>
						<p className="md-title-medium m-0 text-(--md-sys-color-primary)">
							{progress}%
						</p>
					</header>

					<div className="h-2 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-high)">
						<div
							className="h-full rounded-full bg-(--md-sys-color-primary) transition-[width] duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>

					{step === 1 && (
						<div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 duration-300">
							<p className="md-body-medium m-0">
								You can finish in under two minutes. We will save your display
								name, timezone, and optionally import your viewing history.
							</p>
							<ul className="md-body-medium m-0 grid list-disc gap-2 pl-5 text-(--md-sys-color-on-surface-variant)">
								<li>Profile and timezone come first.</li>
								{hasBlueskyProfile ? (
									<li>Import your Bluesky following already on OpnShelf.</li>
								) : null}
								<li>Import from Trakt username or CSV export.</li>
								<li>You can skip import and start tracking instantly.</li>
							</ul>
							<div className="flex flex-wrap gap-2">
								<M3Button variant="filled" onClick={() => onStepChange(2)}>
									Begin setup
								</M3Button>
								<M3Button
									variant="text"
									onClick={onSkipSetup}
									disabled={isCompleting}
								>
									{isCompleting ? "Finishing..." : "Skip to shelf"}
								</M3Button>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 duration-300">
							{hasBlueskyProfile ? (
								<div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-3">
									<div className="h-13 w-13 overflow-hidden rounded-full border border-(--md-sys-color-outline) bg-(--md-sys-color-surface-container-highest)">
										{userAvatarUrl ? (
											<img
												src={userAvatarUrl}
												alt="BlueSky avatar"
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="md-body-small grid h-full w-full place-items-center text-(--md-sys-color-on-surface-variant)">
												No avatar
											</div>
										)}
									</div>
									<div>
										<p className="md-title-small m-0">BlueSky profile linked</p>
										<p className="md-body-small m-0 mt-1 text-(--md-sys-color-on-surface-variant)">
											Avatar sync is active. Manual uploads will be added soon.
										</p>
									</div>
								</div>
							) : null}

							<div className="grid gap-3 md:grid-cols-2">
								<label className="grid gap-1.5" htmlFor={displayNameId}>
									<span className="md-label-small uppercase text-(--md-sys-color-on-surface-variant)">
										Display name
									</span>
									<input
										id={displayNameId}
										type="text"
										value={displayName}
										onChange={(event) =>
											onDisplayNameChange(event.target.value)
										}
										placeholder="How your name appears"
										className={INPUT_CLASS}
									/>
								</label>

								<label className="grid gap-1.5" htmlFor={timezoneId}>
									<span className="md-label-small uppercase text-(--md-sys-color-on-surface-variant)">
										Timezone
									</span>
									<select
										id={timezoneId}
										value={timezone}
										onChange={(event) => onTimezoneChange(event.target.value)}
										className={INPUT_CLASS}
									>
										{TIMEZONE_GROUPS.map((group) => (
											<optgroup key={group.region} label={group.region}>
												{group.zones.map((zone) => (
													<option key={zone} value={zone}>
														{zone}
													</option>
												))}
											</optgroup>
										))}
									</select>
								</label>
							</div>

							<div className="grid gap-1.5">
								<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
									Clock style
								</p>
								<div className="inline-flex w-fit gap-1 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-1">
									<button
										type="button"
										className={`rounded-(--md-sys-shape-corner-medium) px-3.5 py-2 md-label-large ${
											timeFormat === "12h"
												? "bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)"
												: "text-(--md-sys-color-on-surface-variant)"
										}`}
										onClick={() => onTimeFormatChange("12h")}
									>
										12-hour
									</button>
									<button
										type="button"
										className={`rounded-(--md-sys-shape-corner-medium) px-3.5 py-2 md-label-large ${
											timeFormat === "24h"
												? "bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)"
												: "text-(--md-sys-color-on-surface-variant)"
										}`}
										onClick={() => onTimeFormatChange("24h")}
									>
										24-hour
									</button>
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								<M3Button
									variant="text"
									onClick={() => onStepChange(1)}
									disabled={isSavingProfile}
								>
									Back
								</M3Button>
								<M3Button
									variant="filled"
									onClick={onSaveProfileAndContinue}
									disabled={isSavingProfile}
								>
									{isSavingProfile ? "Saving..." : "Save and continue"}
								</M3Button>
							</div>
						</div>
					)}

					{step === 3 && hasBlueskyProfile && (
						<div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 duration-300">
							<p className="md-body-medium m-0">
								Import the people you already follow on Bluesky who are on
								OpnShelf. We will only connect accounts that already exist here.
							</p>

							<div className="grid gap-3 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-4">
								<p className="md-label-small m-0 uppercase tracking-[0.12em] text-(--md-sys-color-primary)">
									Bluesky friends
								</p>
								<p className="md-title-medium m-0">
									Bring your existing follows into OpnShelf in one step.
								</p>
								<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
									No preview list, no invites. If someone you follow is already
									on OpnShelf, we will follow them here too.
								</p>
								{followMessage ? (
									<div className="rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface) p-3">
										<p className="md-body-medium m-0">{followMessage}</p>
									</div>
								) : null}
								{followImportStatus === "success" ? (
									<M3Button
										variant="filled"
										onClick={onContinueAfterFollowImport}
									>
										Continue to watch history
									</M3Button>
								) : (
									<M3Button
										variant="filled"
										onClick={onImportBlueskyFollows}
										disabled={followImportStatus === "running"}
									>
										{followImportStatus === "running"
											? "Importing Bluesky following..."
											: followImportStatus === "error"
												? "Try again"
												: "Import my Bluesky following"}
									</M3Button>
								)}
							</div>

							<div className="flex flex-wrap gap-2">
								<M3Button
									variant="text"
									onClick={() => onStepChange(2)}
									disabled={followImportStatus === "running"}
								>
									Back
								</M3Button>
								<M3Button
									variant="text"
									onClick={onSkipFollowImport}
									disabled={followImportStatus === "running"}
								>
									Skip for now
								</M3Button>
							</div>
						</div>
					)}

					{step === 4 && (
						<div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 duration-300">
							{showImportStatusAboveInput && (
								<div className="grid gap-2 rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-3">
									<p className="md-label-large m-0">{importProgress.message}</p>
									{importProgress.phase === "preview_ready" && traktPreview ? (
										<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
											{traktPreview.importableCount} importable items found from{" "}
											{traktPreview.sourceCount} Trakt history rows.
										</p>
									) : (
										<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
											Preparing data for import...
										</p>
									)}
								</div>
							)}

							<div
								className="inline-flex w-fit gap-1 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-1"
								role="tablist"
								aria-label="Import source"
							>
								<button
									type="button"
									role="tab"
									aria-selected={activeTab === "trakt"}
									className={`rounded-(--md-sys-shape-corner-medium) px-3 py-2 md-label-large ${
										activeTab === "trakt"
											? "bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)"
											: "text-(--md-sys-color-on-surface-variant)"
									}`}
									onClick={() => onActiveTabChange("trakt")}
								>
									Trakt username
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={activeTab === "csv"}
									className={`rounded-(--md-sys-shape-corner-medium) px-3 py-2 md-label-large ${
										activeTab === "csv"
											? "bg-(--md-sys-color-secondary-container) text-(--md-sys-color-on-secondary-container)"
											: "text-(--md-sys-color-on-surface-variant)"
									}`}
									onClick={() => onActiveTabChange("csv")}
								>
									CSV upload
								</button>
							</div>

							{activeTab === "trakt" ? (
								<div className="grid gap-3" role="tabpanel">
									<label className="grid gap-1.5">
										<span className="md-label-small uppercase text-(--md-sys-color-on-surface-variant)">
											Trakt username
										</span>
										<input
											type="text"
											value={traktUsername}
											onChange={(event) =>
												onTraktUsernameChange(event.target.value)
											}
											placeholder="your-trakt-handle"
											className={INPUT_CLASS}
											disabled={isTraktImporting}
										/>
									</label>
									<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
										We fetch the Trakt profile and recent plays first so you can
										confirm the account before importing.
									</p>
									<M3Button
										variant="filled"
										onClick={onTraktImport}
										disabled={isImportBusy}
									>
										{traktPreview ? "Refresh preview" : "Fetch preview"}
									</M3Button>
									{isTraktImporting ? (
										<div className="grid gap-3 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-4">
											<p className="md-label-large m-0">
												{importProgress.message}
											</p>
											<div className="h-2 overflow-hidden rounded-full bg-(--md-sys-color-surface-container-highest)">
												<div
													className="h-full rounded-full bg-(--md-sys-color-primary) transition-[width] duration-300"
													style={{ width: `${importPercent}%` }}
												/>
											</div>
											<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
												{importProgress.processedItems} /{" "}
												{importProgress.totalItems} items ({importPercent}%)
											</p>
											<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
												Batch {importProgress.currentBatch} of{" "}
												{importProgress.totalBatches}. Imported{" "}
												{importProgress.imported}, skipped{" "}
												{importProgress.skipped}, failed {importProgress.failed}
												.
											</p>
										</div>
									) : traktPreview ? (
										<div className="grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-4">
											<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
												<div className="grid gap-1">
													<p className="md-label-small m-0 uppercase tracking-[0.12em] text-(--md-sys-color-primary)">
														Trakt profile
													</p>
													<h3 className="md-title-large m-0">
														{traktPreview.profile.name ??
															`@${traktPreview.profile.username}`}
													</h3>
													<p className="md-body-medium m-0 text-(--md-sys-color-on-surface-variant)">
														@{traktPreview.profile.username}
														{traktPreview.profile.isVip ? " • VIP" : ""}
														{traktPreview.profile.isPrivate ? " • Private" : ""}
													</p>
												</div>
												<div className="grid gap-2 text-right">
													<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
														Ready to import
													</p>
													<p className="md-headline-small m-0 text-(--md-sys-color-primary)">
														{traktPreview.importableCount}
													</p>
												</div>
											</div>

											<div className="grid gap-2">
												<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
													Last played items
												</p>
												{traktPreview.previewItems.length > 0 ? (
													<ul className="m-0 grid list-none gap-2 p-0">
														{traktPreview.previewItems.map((item) => (
															<li
																key={`${item.type}-${item.watchedAt}-${item.title}`}
																className="rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface) p-3"
															>
																<div className="flex items-start justify-between gap-3">
																	<div className="grid gap-1">
																		<p className="md-title-small m-0">
																			{item.title}
																		</p>
																		{item.subtitle ? (
																			<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
																				{item.subtitle}
																			</p>
																		) : null}
																	</div>
																	<p className="md-body-small m-0 whitespace-nowrap text-(--md-sys-color-on-surface-variant)">
																		{formatPreviewDate(item.watchedAt)}
																	</p>
																</div>
															</li>
														))}
													</ul>
												) : (
													<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
														No importable watch items were found for this
														profile.
													</p>
												)}
											</div>

											<M3Button
												variant="filled"
												onClick={onTraktImportConfirm}
												disabled={
													isImportBusy || traktPreview.importableCount < 1
												}
											>
												Import {traktPreview.importableCount} item
												{traktPreview.importableCount === 1 ? "" : "s"}
											</M3Button>
										</div>
									) : null}
								</div>
							) : (
								<div className="grid gap-3" role="tabpanel">
									<label
										htmlFor={fileInputId}
										className={`inline-flex w-fit items-center gap-2 rounded-(--md-sys-shape-corner-medium) border border-dashed border-(--md-sys-color-outline) bg-(--md-sys-color-surface) px-3 py-2 md-label-large ${
											isImportBusy
												? "pointer-events-none opacity-55"
												: "hover:bg-(--md-sys-color-surface-container-high)"
										}`}
									>
										<FileSpreadsheet size={18} />
										<span>
											{isImportBusy
												? "Import in progress"
												: "Select Trakt CSV file"}
										</span>
									</label>
									<input
										id={fileInputId}
										type="file"
										className="sr-only"
										accept=".csv,text/csv"
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (file) {
												onCsvUpload(file);
												event.currentTarget.value = "";
											}
										}}
										disabled={isImportBusy}
									/>
									<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
										Use the standard Trakt export columns: watched_at, action,
										type, tmdb_id, season_number, episode_number.
									</p>
								</div>
							)}

							<div className="flex flex-wrap gap-2">
								<M3Button
									variant="text"
									onClick={() => onStepChange(hasBlueskyProfile ? 3 : 2)}
									disabled={isImportBusy}
								>
									Back
								</M3Button>
								<M3Button
									variant="text"
									onClick={onSkipHistoryImport}
									disabled={isCompleting || isImportBusy}
								>
									{isCompleting ? "Finishing..." : "Skip import"}
								</M3Button>
							</div>
						</div>
					)}

					{step === 5 && (
						<div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 rounded-(--md-sys-shape-corner-large) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) p-4 duration-300">
							<h3 className="md-title-large m-0">You are all set.</h3>
							<p className="md-body-medium m-0">
								Your profile is ready and your shelf can start collecting watch
								history.
							</p>
							{followImportResult?.createdCount ? (
								<p className="md-body-small m-0 text-(--md-sys-color-on-surface-variant)">
									You&apos;re already connected to{" "}
									{followImportResult.createdCount} friend
									{followImportResult.createdCount === 1 ? "" : "s"} from
									Bluesky.
								</p>
							) : null}
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-3">
									<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
										Imported
									</p>
									<strong className="md-headline-small mt-1 block text-(--md-sys-color-primary)">
										{importResult.imported}
									</strong>
								</div>
								<div className="rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-3">
									<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
										Skipped
									</p>
									<strong className="md-headline-small mt-1 block text-(--md-sys-color-primary)">
										{importResult.skipped}
									</strong>
								</div>
								<div className="rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container-high) p-3">
									<p className="md-label-small m-0 uppercase text-(--md-sys-color-on-surface-variant)">
										Failed
									</p>
									<strong className="md-headline-small mt-1 block text-(--md-sys-color-primary)">
										{importResult.failed}
									</strong>
								</div>
							</div>

							{importResult.errors.length > 0 && (
								<div className="max-h-[220px] overflow-auto rounded-(--md-sys-shape-corner-medium) border border-(--md-sys-color-error) bg-(--md-sys-color-error-container)/20 p-3">
									<p className="md-label-large m-0 mb-2 text-(--md-sys-color-error)">
										Import errors
									</p>
									<ul className="md-body-small m-0 grid list-disc gap-1 pl-4 text-(--md-sys-color-error)">
										{importResult.errors.map((error) => (
											<li key={error}>{error}</li>
										))}
									</ul>
								</div>
							)}

							<div className="flex flex-wrap gap-2">
								<M3Button
									variant="filled"
									onClick={onComplete}
									disabled={isCompleting}
								>
									{isCompleting ? "Finishing..." : "Open my shelf"}
								</M3Button>
							</div>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function formatPreviewDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

function getFollowImportMessage(
	status: FollowImportStatus,
	result: FollowImportResult | null,
) {
	if (status === "error") {
		return "We could not import your Bluesky following right now.";
	}

	if (status !== "success" || !result) {
		return null;
	}

	if (result.createdCount > 0) {
		return `Followed ${result.createdCount} Bluesky friend${result.createdCount === 1 ? "" : "s"} on OpnShelf.`;
	}

	if (result.alreadyFollowingCount > 0) {
		return "Your Bluesky follows are already synced.";
	}

	if (result.matchedCount === 0) {
		return "None of the people you follow on Bluesky are on OpnShelf yet.";
	}

	return null;
}
