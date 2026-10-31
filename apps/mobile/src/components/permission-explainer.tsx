import {
	accountHostName,
	PERMISSION_DEVICES_NOTICE,
	type PermissionExplainerAction,
	type PermissionIntegration,
	permissionExplainer,
} from "@opnshelf/api";
import { Check, Smartphone, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

type ExplainerRequest = {
	integration: PermissionIntegration;
	action: PermissionExplainerAction;
	/** Creates the authorization request; resolves with the URL to open. */
	start: () => Promise<string>;
};

type ExplainerState = {
	id: number;
	integration: PermissionIntegration;
	action: PermissionExplainerAction;
	url: string;
};

type Pending = {
	id: number;
	resolve: (url: string | null) => void;
	reject: (error: unknown) => void;
	outcome?: { url: string | null };
};

/**
 * Explain a permission change before leaving for the Account Host.
 *
 * `request` creates the authorization request first, so the sheet names the
 * real Account Host and a request the backend refuses (no Bluesky profile,
 * say) fails before anything opens; it then rejects. Once open, it resolves
 * with the URL to open when the User continues, or null when they back out,
 * and only after the sheet has finished closing: the in-app auth session must
 * not compete with an animating native modal. Callers show their own pending
 * state until it opens.
 */
export function usePermissionExplainer() {
	const [state, setState] = useState<ExplainerState | null>(null);
	const [visible, setVisible] = useState(false);
	const pending = useRef<Pending | null>(null);
	const nextId = useRef(0);

	const close = useCallback(
		(id: number, outcome: NonNullable<Pending["outcome"]>) => {
			if (pending.current?.id !== id || pending.current.outcome) return;
			pending.current.outcome = outcome;
			setVisible(false);
		},
		[],
	);

	const onClosed = useCallback(() => {
		const current = pending.current;
		if (!current?.outcome) return;
		pending.current = null;
		setState(null);
		current.resolve(current.outcome.url);
	}, []);

	const request = useCallback(
		({ integration, action, start }: ExplainerRequest) =>
			new Promise<string | null>((resolve, reject) => {
				if (pending.current) {
					reject(new Error("A permission request is already open"));
					return;
				}
				const id = ++nextId.current;
				pending.current = { id, resolve, reject };
				start().then(
					(url) => {
						setState({ id, integration, action, url });
						setVisible(true);
					},
					(error: unknown) => {
						pending.current = null;
						reject(error);
					},
				);
			}),
		[],
	);

	const sheet = (
		<PermissionExplainerSheet
			state={state}
			visible={visible}
			onClosed={onClosed}
			onCancel={() => state && close(state.id, { url: null })}
			onContinue={() => state && close(state.id, { url: state.url })}
		/>
	);

	return { request, sheet };
}

function PermissionExplainerSheet({
	state,
	visible,
	onClosed,
	onCancel,
	onContinue,
}: {
	state: ExplainerState | null;
	visible: boolean;
	onClosed: () => void;
	onCancel: () => void;
	onContinue: () => void;
}) {
	const colors = useThemeColors();
	const insets = useSafeAreaInsets();
	if (!state) return null;

	const copy = permissionExplainer(state.integration, state.action);
	const host = accountHostName(state.url);
	const connecting = state.action === "connect";

	return (
		<BottomSheetModal
			visible={visible}
			onRequestClose={onCancel}
			onClosed={onClosed}
		>
			<View className="flex-1 justify-end">
				<Pressable
					className="flex-1"
					accessibilityLabel="Not now"
					onPress={onCancel}
				/>
				<View
					className="rounded-t-2xl border border-border bg-card"
					style={{ paddingBottom: insets.bottom + 16, maxHeight: "90%" }}
				>
					<ScrollView contentContainerClassName="gap-4 p-5">
						<View className="flex-row items-start justify-between gap-3">
							<Text className="flex-1 font-display-bold text-foreground text-lg">
								{copy.title}
							</Text>
							<Pressable
								hitSlop={8}
								accessibilityLabel="Not now"
								onPress={onCancel}
							>
								<X color={colors.mutedForeground} size={22} />
							</Pressable>
						</View>
						<Text className="text-muted-foreground text-sm">
							{host ? (
								<Text className="font-semibold text-foreground text-sm">
									{host}
								</Text>
							) : (
								"The service that"
							)}{" "}
							hosts your account, so it asks you to approve this change, not
							Opnshelf.
						</Text>

						<View className="gap-2">
							<Text className="font-semibold text-foreground text-sm">
								{copy.canHeading}
							</Text>
							{copy.can.map((line) => (
								<View key={line} className="flex-row gap-2">
									<Check color={colors.success} size={16} strokeWidth={2.5} />
									<Text className="flex-1 text-foreground text-sm">{line}</Text>
								</View>
							))}
						</View>
						<View className="gap-2">
							<Text className="font-semibold text-foreground text-sm">
								{copy.cannotHeading}
							</Text>
							{copy.cannot.map((line) => (
								<View key={line} className="flex-row gap-2">
									{connecting ? (
										<X color={colors.mutedForeground} size={16} />
									) : (
										<Check color={colors.mutedForeground} size={16} />
									)}
									<Text className="flex-1 text-muted-foreground text-sm">
										{line}
									</Text>
								</View>
							))}
						</View>
						{copy.note ? (
							<Text className="text-muted-foreground text-sm">{copy.note}</Text>
						) : null}
						<View className="flex-row items-center gap-2">
							<Smartphone color={colors.mutedForeground} size={16} />
							<Text className="flex-1 text-muted-foreground text-xs">
								{PERMISSION_DEVICES_NOTICE}
							</Text>
						</View>

						<View className="gap-2 pt-1">
							<Button
								label={host ? `Continue to ${host}` : "Continue"}
								variant={connecting ? "primary" : "destructive"}
								onPress={onContinue}
							/>
							<Button label="Not now" variant="ghost" onPress={onCancel} />
						</View>
					</ScrollView>
				</View>
			</View>
		</BottomSheetModal>
	);
}
