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
	useState,
} from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import {
	KeyboardAvoidingView,
	KeyboardProvider,
} from "react-native-keyboard-controller";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useTwStyle } from "@/lib/use-tw-style";

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
}: {
	visible: boolean;
	onDismiss: () => void;
}) {
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
							<Text className="font-bold font-display text-foreground text-lg">
								Send feedback
							</Text>
							<Pressable hitSlop={8} onPress={onDismiss}>
								<X color="#94a3b8" size={22} />
							</Pressable>
						</View>

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
										<Icon color={selected ? "#f3bc00" : "#94a3b8"} size={16} />
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

						<Pressable
							onPress={submit}
							disabled={!canSubmit}
							className="items-center rounded-lg bg-primary px-4 py-3"
							style={{ opacity: canSubmit ? 1 : 0.5 }}
						>
							<Text className="font-semibold text-[#3f2e00] text-base">
								{mutation.isPending ? "Sending…" : "Send"}
							</Text>
						</Pressable>
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
	const open = useCallback(() => setVisible(true), []);
	return (
		<FeedbackContext.Provider value={{ open }}>
			{children}
			<FeedbackSheet visible={visible} onDismiss={() => setVisible(false)} />
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
