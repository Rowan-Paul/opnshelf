import { feedbackControllerCreateFeedbackMutation } from "@opnshelf/api";
import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import { Bug, Lightbulb, X } from "lucide-react-native";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import {
	Dimensions,
	Image,
	Modal,
	PixelRatio,
	Platform,
	Pressable,
	View,
} from "react-native";
import {
	KeyboardAvoidingView,
	KeyboardProvider,
} from "react-native-keyboard-controller";
import { captureScreen } from "react-native-view-shot";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { posthog } from "@/lib/posthog";
import { useTwStyle } from "@/lib/use-tw-style";
import { useThemeColors } from "@/theme/colors";

type Category = "bug" | "feature_request";

interface FeedbackContextValue {
	/** Open the feedback sheet (from the Settings row, a shake, anywhere). */
	open: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const MAX_MESSAGE = 5000;

/** Compact context line appended to the message — the route the user was on
 * (the `pageUrl` DTO field is `@IsUrl`-validated and rejects a bare path) plus
 * minimal device info, so a shake report says where and on what it happened. */
function contextLine(pathname: string): string {
	const version = Constants.expoConfig?.version ?? "?";
	return `\n\n— mobile · ${pathname} · ${Platform.OS} ${Platform.Version} · app ${version}`;
}

const CATEGORIES: { value: Category; label: string; icon: typeof Bug }[] = [
	{ value: "bug", label: "Bug", icon: Bug },
	{ value: "feature_request", label: "Idea", icon: Lightbulb },
];

function FeedbackSheet({
	visible,
	onDismiss,
	screenshot,
	onRemoveScreenshot,
}: {
	visible: boolean;
	onDismiss: () => void;
	screenshot?: string;
	onRemoveScreenshot: () => void;
}) {
	const colors = useThemeColors();
	const toast = useToast();
	const pathname = usePathname();
	// KeyboardAvoidingView is third-party, so resolve its layout classes to a
	// style object (Uniwind className only works on RN-core components).
	const avoidingStyle = useTwStyle("flex-1 justify-end");
	const [category, setCategory] = useState<Category>("bug");
	const [message, setMessage] = useState("");

	const reset = useCallback(() => {
		setCategory("bug");
		setMessage("");
	}, []);

	const mutation = useMutation({
		mutationKey: ["feedback", "create"],
		...feedbackControllerCreateFeedbackMutation(),
		onSuccess: () => {
			posthog?.capture("feedback_submitted", { category });
			void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			toast.success("Thanks for the feedback!");
			reset();
			onDismiss();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Couldn't send feedback",
			),
	});

	const trimmed = message.trim();
	const canSubmit = trimmed.length > 0 && !mutation.isPending;

	const submit = () => {
		if (!canSubmit) return;
		mutation.mutate({
			body: {
				category,
				screenshot,
				message: (trimmed + contextLine(pathname)).slice(0, MAX_MESSAGE),
			},
		});
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			{/*
			 * RN <Modal> renders in a separate window outside the root
			 * KeyboardProvider (notably on Android), so the keyboard controller
			 * receives no events there. Nesting a KeyboardProvider inside the Modal
			 * re-bridges those events, letting its KeyboardAvoidingView lift the
			 * bottom-anchored sheet above the keyboard on both platforms.
			 */}
			<KeyboardProvider>
				<KeyboardAvoidingView behavior="padding" style={avoidingStyle}>
					<Pressable className="flex-1" onPress={onDismiss} />
					<View className="gap-4 rounded-t-2xl border border-border bg-card p-5">
						<View className="flex-row items-center justify-between">
							<Text className="font-display-bold text-foreground text-lg">
								Send feedback
							</Text>
							<Pressable hitSlop={8} onPress={onDismiss}>
								<X color={colors.mutedForeground} size={22} />
							</Pressable>
						</View>

						<Text className="text-muted-foreground text-sm">
							Your feedback will become a public GitHub issue. Please leave out
							personal information and secrets.
						</Text>

						{screenshot && (
							<View className="flex-row items-center gap-3">
								<Image
									source={{ uri: `data:image/jpeg;base64,${screenshot}` }}
									style={{ width: 48, height: 80 }}
									resizeMode="contain"
									accessibilityLabel="Attached screenshot"
								/>
								<View className="flex-1 gap-1">
									<Text className="text-foreground text-sm">
										Screenshot attached. It will be public.
									</Text>
									<Pressable
										accessibilityRole="button"
										onPress={onRemoveScreenshot}
										hitSlop={8}
									>
										<Text className="text-primary text-sm">
											Remove screenshot
										</Text>
									</Pressable>
								</View>
							</View>
						)}

						{/* Category toggle */}
						<View className="flex-row gap-2">
							{CATEGORIES.map(({ value, label, icon: Icon }) => {
								const selected = category === value;
								return (
									<Pressable
										key={value}
										onPress={() => setCategory(value)}
										className={
											selected
												? "flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2.5"
												: "flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5"
										}
									>
										<Icon
											color={selected ? colors.accent : colors.mutedForeground}
											size={16}
										/>
										<Text
											className={
												selected
													? "font-semibold text-primary text-sm"
													: "font-medium text-foreground text-sm"
											}
										>
											{label}
										</Text>
									</Pressable>
								);
							})}
						</View>

						<TextField
							variant="subtle"
							multiline
							className="min-h-28"
							placeholder={
								category === "bug"
									? "What went wrong? What were you doing?"
									: "What would you like to see?"
							}
							value={message}
							onChangeText={setMessage}
							maxLength={MAX_MESSAGE}
							autoFocus
						/>

						<Button
							label="Send"
							loadingLabel="Sending…"
							loading={mutation.isPending}
							disabled={!canSubmit}
							onPress={submit}
						/>
					</View>
				</KeyboardAvoidingView>
			</KeyboardProvider>
		</Modal>
	);
}

/** Holds the single feedback sheet and exposes `open()` app-wide. Mounted inside
 * `Providers` (under Query + Toast). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
	const [visible, setVisible] = useState(false);
	const [screenshot, setScreenshot] = useState<string>();
	const opening = useRef(false);
	const sequence = useRef(0);
	const [openId, setOpenId] = useState(0);
	const toast = useToast();
	const open = useCallback(() => {
		if (opening.current) return;
		opening.current = true;
		setOpenId(++sequence.current);
		setScreenshot(undefined);
		const screen = Dimensions.get("screen");
		const width = Platform.OS === "ios" ? 540 / PixelRatio.get() : 540;
		void Promise.resolve()
			.then(() =>
				captureScreen({
					format: "jpg",
					quality: 0.6,
					width: Math.round(width),
					height: Math.round((width * screen.height) / screen.width),
					result: "base64",
				}),
			)
			.then((image) => {
				if (image.length > 80000) throw new Error("Screenshot too large");
				setScreenshot(image);
			})
			.catch(() =>
				toast.error(
					"Couldn't attach a screenshot. You can still send feedback.",
				),
			)
			.finally(() => setVisible(true));
	}, [toast]);
	const dismiss = () => {
		// A finished send from an older opening must not close a new draft.
		if (openId !== sequence.current) return;
		setVisible(false);
		setScreenshot(undefined);
		opening.current = false;
	};
	return (
		<FeedbackContext.Provider value={{ open }}>
			{children}
			<FeedbackSheet
				key={openId}
				visible={visible}
				onDismiss={dismiss}
				screenshot={screenshot}
				onRemoveScreenshot={() => setScreenshot(undefined)}
			/>
		</FeedbackContext.Provider>
	);
}

export function useFeedback() {
	const context = useContext(FeedbackContext);
	if (!context) {
		throw new Error("useFeedback must be used within a FeedbackProvider");
	}
	return context;
}
