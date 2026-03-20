import { Check } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useTheme } from "@/contexts/theme";
import { ONBOARDING_STEPS } from "./constants";
import { styles } from "./styles";

type OnboardingProgressCardProps = {
	step: number;
	progressPercent: number;
	hasBlueskyProfile: boolean;
};

export function OnboardingProgressCard({
	step,
	progressPercent,
	hasBlueskyProfile,
}: OnboardingProgressCardProps) {
	const { colors } = useTheme();
	const visibleSteps = hasBlueskyProfile
		? ONBOARDING_STEPS
		: ONBOARDING_STEPS.filter((_, index) => index !== 2);
	const visibleStep = hasBlueskyProfile ? step : step >= 4 ? step - 1 : step;

	return (
		<Card style={styles.progressCard}>
			<CardHeader>
				<Text style={[styles.kicker, { color: colors.primary }]}>Onboarding</Text>
				<Text style={[styles.title, { color: colors.onBackground }]}>Welcome to OpnShelf</Text>
				<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Step {visibleStep} of {visibleSteps.length} • {progressPercent}%</Text>
			</CardHeader>
			<CardContent>
				<View
					style={[
						styles.progressTrack,
						{ backgroundColor: colors.surfaceContainerHigh },
					]}
				>
					<View
						style={[
							styles.progressFill,
							{ backgroundColor: colors.primary, width: `${progressPercent}%` },
						]}
					/>
				</View>
				<View style={styles.stepsList}>
					{visibleSteps.map((item, index) => {
						const stepNumber = index + 1;
						const isComplete = visibleStep > stepNumber;
						const isActive = visibleStep === stepNumber;

						return (
							<View
								key={item.title}
								style={[
									styles.stepRow,
									{
										borderColor: isActive ? colors.outline : colors.outlineVariant,
										backgroundColor: isActive
											? colors.surfaceContainer
											: colors.surface,
									},
								]}
							>
								<View
									style={[
										styles.stepBadge,
										{
											backgroundColor: isComplete
												? colors.primary
												: colors.secondaryContainer,
										},
									]}
								>
									{isComplete ? (
										<Check size={14} color={colors.onPrimary} />
									) : (
										<item.Icon size={14} color={colors.onSecondaryContainer} />
									)}
								</View>
								<View style={styles.stepTextWrap}>
									<Text style={[styles.stepTitle, { color: colors.onSurface }]}>{item.title}</Text>
								</View>
							</View>
						);
					})}
				</View>
			</CardContent>
		</Card>
	);
}
