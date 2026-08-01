import { X } from "lucide-react-native";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";
import { Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";

type DialogAction = {
	label: string;
	variant?: "default" | "destructive" | "ghost";
	onPress?: () => void;
};

/** Dismiss-only actions ("Cancel", "Keep editing") get quiet outline styling. */
function actionVariant(
	action: DialogAction,
): "default" | "destructive" | "ghost" {
	return action.variant ?? (action.onPress ? "default" : "ghost");
}

const ACTION_BOX: Record<string, string> = {
	default: "bg-primary",
	destructive: "bg-red-500",
	ghost: "border border-border",
};

const ACTION_TEXT: Record<string, string> = {
	default: "text-[#3f2e00]",
	destructive: "text-white",
	ghost: "text-foreground",
};

type DialogOptions = {
	title: string;
	description?: string;
	actions: DialogAction[];
	input?: {
		placeholder?: string;
		initialValue?: string;
		onSubmit: (value: string) => void;
	};
};

type DialogContextValue = { showDialog: (options: DialogOptions) => void };

const DialogContext = createContext<DialogContextValue | null>(null);

/** A consistent, app-rendered replacement for the platform Alert APIs. */
export function DialogProvider({ children }: { children: ReactNode }) {
	const [dialog, setDialog] = useState<DialogOptions | null>(null);
	const [inputValue, setInputValue] = useState("");

	const showDialog = useCallback((options: DialogOptions) => {
		setInputValue(options.input?.initialValue ?? "");
		setDialog(options);
	}, []);

	const dismiss = useCallback(() => setDialog(null), []);
	const pressAction = (action: DialogAction) => {
		dismiss();
		action.onPress?.();
	};
	const actions = dialog?.actions ?? [];
	const stacked = actions.length > 2;
	const orderedActions = stacked ? [...actions].reverse() : actions;

	const submitInput = () => {
		const input = dialog?.input;
		if (!input) return;
		dismiss();
		input.onSubmit(inputValue);
	};

	return (
		<DialogContext.Provider value={{ showDialog }}>
			{children}
			<Modal
				visible={dialog !== null}
				transparent
				animationType="fade"
				onRequestClose={dismiss}
			>
				<View className="flex-1 items-center justify-center bg-black/50 p-6">
					<Pressable className="absolute inset-0" onPress={dismiss} />
					<View className="w-full max-w-sm gap-4 rounded-2xl border border-border bg-card p-5">
						<View className="flex-row items-start justify-between gap-3">
							<View className="flex-1 gap-1.5">
								<Text className="font-bold font-display text-foreground text-lg">
									{dialog?.title}
								</Text>
								{dialog?.description ? (
									<Text className="text-muted-foreground text-sm">
										{dialog.description}
									</Text>
								) : null}
							</View>
							<Pressable
								hitSlop={8}
								onPress={dismiss}
								accessibilityLabel="Close dialog"
							>
								<X color="#94a3b8" size={20} />
							</Pressable>
						</View>
						{dialog?.input ? (
							<TextField
								value={inputValue}
								onChangeText={setInputValue}
								placeholder={dialog.input.placeholder}
								autoFocus
								autoCapitalize="none"
								keyboardType="url"
								onSubmitEditing={submitInput}
							/>
						) : null}
						{/* Three or more actions don't fit side by side on a phone, so they
						    stack full-width, most emphasized first and the cancel last. */}
						<View className={stacked ? "gap-2" : "flex-row justify-end gap-2"}>
							{orderedActions.map((action) => (
								<Pressable
									key={action.label}
									onPress={() => pressAction(action)}
									className={`items-center rounded-lg px-3.5 py-3 ${ACTION_BOX[actionVariant(action)]}`}
								>
									<Text
										className={`font-semibold ${ACTION_TEXT[actionVariant(action)]}`}
									>
										{action.label}
									</Text>
								</Pressable>
							))}
							{dialog?.input ? (
								<Pressable
									onPress={submitInput}
									className="rounded-lg bg-primary px-3.5 py-2.5"
								>
									<Text className="font-semibold text-[#3f2e00]">Add link</Text>
								</Pressable>
							) : null}
						</View>
					</View>
				</View>
			</Modal>
		</DialogContext.Provider>
	);
}

export function useDialog() {
	const context = useContext(DialogContext);
	if (!context)
		throw new Error("useDialog must be used within a DialogProvider");
	return context;
}
