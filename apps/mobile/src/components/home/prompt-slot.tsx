import * as SecureStore from "expo-secure-store";
import type { LucideIcon } from "lucide-react-native";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

/**
 * Prompt ids in priority order: the first one that has something to show wins
 * the slot, exactly like the Web App's `PromptSlot`, which keeps the first
 * eligible child in DOM order and hides the rest.
 */
export const PROMPT_PRIORITY = [
	"release-note",
	"notification",
	"atstore-review",
] as const;
export type PromptId = (typeof PROMPT_PRIORITY)[number];

/** Same window as the Web App's `startPromptCooldown`. */
const COOLDOWN_KEY = "prompt-cooldown-until";
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

type SlotContextValue = {
	active: PromptId | null;
	claim: (id: PromptId) => () => void;
	startCooldown: () => void;
};

const SlotContext = createContext<SlotContextValue | null>(null);

/**
 * The reserved Prompt slot on Home: shows at most one Prompt at a time.
 *
 * Web gets this from one CSS rule (`nth-child(n+2)` hidden), which React Native
 * does not have. Instead each Prompt claims the slot while it has a card to
 * show, and the slot renders only the highest-priority claimant. A Prompt that
 * does not apply returns null before claiming, so it never blocks the next one.
 *
 * Dismissing any Prompt silences the whole slot for a few days, so saying no
 * to one card does not immediately produce the next one.
 */
export function PromptSlot({ children }: { children: ReactNode }) {
	const [claims, setClaims] = useState<ReadonlySet<PromptId>>(new Set());
	// When the cooldown ends (epoch ms, 0 for none). null while the stored value
	// loads: show nothing rather than flash a card that turns out to be silenced.
	const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
	// Home stays mounted behind the tab bar for days, so "now" is re-read when
	// the app returns to the foreground and when the cooldown runs out.
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		let active = true;
		void SecureStore.getItemAsync(COOLDOWN_KEY)
			.then((until) => {
				if (active) setCooldownUntil(Number(until) || 0);
			})
			.catch(() => {
				if (active) setCooldownUntil(0);
			});
		return () => {
			active = false;
		};
	}, []);
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") setNow(Date.now());
		});
		return () => subscription.remove();
	}, []);
	const coolingDown = cooldownUntil === null ? null : cooldownUntil > now;
	useEffect(() => {
		if (!coolingDown || cooldownUntil === null) return;
		const timer = setTimeout(
			() => setNow(Date.now()),
			Math.max(0, cooldownUntil - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [coolingDown, cooldownUntil]);
	const claim = useCallback((id: PromptId) => {
		setClaims((current) => new Set(current).add(id));
		return () =>
			setClaims((current) => {
				const next = new Set(current);
				next.delete(id);
				return next;
			});
	}, []);
	const startCooldown = useCallback(() => {
		const until = Date.now() + COOLDOWN_MS;
		setNow(Date.now());
		setCooldownUntil(until);
		void SecureStore.setItemAsync(COOLDOWN_KEY, String(until)).catch(() => {});
	}, []);
	const active =
		coolingDown === false
			? (PROMPT_PRIORITY.find((id) => claims.has(id)) ?? null)
			: null;
	const value = useMemo(
		() => ({ active, claim, startCooldown }),
		[active, claim, startCooldown],
	);
	return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** Silence the slot after a dismissal. A no-op outside a slot. */
export function usePromptCooldown(): () => void {
	return useContext(SlotContext)?.startCooldown ?? noop;
}

function noop() {}

/**
 * Wrap a Prompt's card (or its loading placeholder) so it takes part in the
 * slot. Renders the card only while it is the slot's winner. Outside a slot it
 * always renders.
 */
export function PromptSlotItem({
	id,
	onShown,
	children,
}: {
	id: PromptId;
	/** Fires each time the card actually appears, for impression tracking.
	 *  A claimant hidden behind a higher-priority Prompt or a cooldown is not
	 *  seen, so it must not count as viewed. */
	onShown?: () => void;
	children: ReactNode;
}) {
	const slot = useContext(SlotContext);
	const claim = slot?.claim;
	useEffect(() => claim?.(id), [claim, id]);
	const visible = !slot || slot.active === id;
	const onShownRef = useRef(onShown);
	onShownRef.current = onShown;
	useEffect(() => {
		if (visible) onShownRef.current?.();
	}, [visible]);
	if (!visible) return null;
	return <>{children}</>;
}

/**
 * The one card shape every Home Prompt uses, matching the Web App's
 * `PromptCard`: icon, title, one-sentence body, then dismiss and primary
 * actions on the right.
 */
export function PromptCard({
	icon: Icon,
	title,
	children,
	actions,
}: {
	icon: LucideIcon;
	title: string;
	children: ReactNode;
	actions: ReactNode;
}) {
	const colors = useThemeColors();
	return (
		<View className="gap-4 rounded-2xl border border-border bg-card p-5">
			<View className="flex-row items-start gap-3">
				<View className="size-11 items-center justify-center rounded-full bg-accent-subtle">
					<Icon color={colors.accent} size={20} />
				</View>
				<View className="min-w-0 flex-1 gap-1">
					<Text className="font-display-semibold text-foreground text-lg">
						{title}
					</Text>
					<Text className="text-muted-foreground text-sm leading-5">
						{children}
					</Text>
				</View>
			</View>
			<View className="flex-row flex-wrap justify-end gap-2">{actions}</View>
		</View>
	);
}
