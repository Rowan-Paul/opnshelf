import { useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/theme";
import { OnboardingProgressCard } from "./OnboardingProgressCard";
import {
	BriefingStepCard,
	FriendsStepCard,
	IdentityStepCard,
	ImportStepCard,
	LaunchStepCard,
} from "./OnboardingStepCards";
import { OnboardingTimezoneModal } from "./OnboardingTimezoneModal";
import type {
	FollowImportResult,
	FollowImportStatus,
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
	TraktImportPreview,
} from "./types";
import { styles } from "./styles";

type OnboardingContentProps = {
	step: number;
	progressPercent: number;
	activeTab: TabValue;
	traktUsername: string;
	traktPreview: TraktImportPreview | null;
	displayName: string;
	timezone: string;
	timeFormat: "12h" | "24h";
	csvFileName: string | null;
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
	onCsvImport: () => void;
	onSkipHistoryImport: () => void;
	onComplete: () => void;
};

export function OnboardingContent({
	step,
	progressPercent,
	activeTab,
	traktUsername,
	traktPreview,
	displayName,
	timezone,
	timeFormat,
	csvFileName,
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
	onCsvImport,
	onSkipHistoryImport,
	onComplete,
}: OnboardingContentProps) {
	const { colors } = useTheme();
	const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "left", "right", "bottom"]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<OnboardingProgressCard step={step} progressPercent={progressPercent} />

				{step === 1 && (
					<BriefingStepCard
						onStart={() => onStepChange(2)}
						onSkip={onSkipSetup}
						isCompleting={isCompleting}
					/>
				)}

				{step === 2 && (
					<IdentityStepCard
						displayName={displayName}
						timezone={timezone}
						timeFormat={timeFormat}
						isSavingProfile={isSavingProfile}
						onDisplayNameChange={onDisplayNameChange}
						onOpenTimezonePicker={() => setIsTimezoneModalOpen(true)}
						onTimeFormatChange={onTimeFormatChange}
						onBack={() => onStepChange(1)}
						onSave={onSaveProfileAndContinue}
					/>
				)}

				{step === 3 && (
					<FriendsStepCard
						followImportStatus={followImportStatus}
						followImportResult={followImportResult}
						onImport={onImportBlueskyFollows}
						onContinue={onContinueAfterFollowImport}
						onBack={() => onStepChange(2)}
						onSkip={onSkipFollowImport}
					/>
				)}

				{step === 4 && (
					<ImportStepCard
						activeTab={activeTab}
						traktUsername={traktUsername}
						traktPreview={traktPreview}
						csvFileName={csvFileName}
						importProgress={importProgress}
						importPercent={importPercent}
						isImportBusy={isImportBusy}
						isCompleting={isCompleting}
						onActiveTabChange={onActiveTabChange}
						onTraktUsernameChange={onTraktUsernameChange}
						onTraktImport={onTraktImport}
						onTraktImportConfirm={onTraktImportConfirm}
						onCsvImport={onCsvImport}
						onBack={() => onStepChange(3)}
						onSkip={onSkipHistoryImport}
					/>
				)}

				{step === 5 && (
					<LaunchStepCard
						followImportResult={followImportResult}
						importResult={importResult}
						isCompleting={isCompleting}
						onComplete={onComplete}
					/>
				)}
			</ScrollView>

			<OnboardingTimezoneModal
				visible={isTimezoneModalOpen}
				timezone={timezone}
				onClose={() => setIsTimezoneModalOpen(false)}
				onSelect={onTimezoneChange}
			/>
		</SafeAreaView>
	);
}
