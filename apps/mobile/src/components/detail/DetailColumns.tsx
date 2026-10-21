import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useState,
} from "react";
import {
	ScrollView,
	type ScrollViewInstance,
	type ScrollViewProps,
	View,
} from "react-native";
import { DetailLayoutLock } from "@/lib/detail-layout-lock";
import { usePaneWidth, useWideLayout } from "@/lib/use-wide-layout";

/** One compact page, or independently scrolling poster/actions and content panes. */
export function DetailColumns({
	primary,
	secondary,
	scrollRef,
	refreshControl,
	renderContent,
}: {
	primary: ReactNode;
	secondary: ReactNode;
	scrollRef?: RefObject<ScrollViewInstance | null>;
	refreshControl?: ScrollViewProps["refreshControl"];
	/** Season pages supply a virtualized episode list instead of a ScrollView. */
	renderContent?: (header: ReactNode) => ReactNode;
}) {
	const requestedWide = useWideLayout();
	const [wide, setWide] = useState(requestedWide);
	const [locks, setLocks] = useState(0);
	const lock = useCallback(() => {
		setLocks((count) => count + 1);
		return () => setLocks((count) => count - 1);
	}, []);
	// Reparenting an action unmounts its modal and draft. Apply a pending fold
	// only after all detail sheets have closed.
	useEffect(() => {
		if (locks === 0) setWide(requestedWide);
	}, [locks, requestedWide]);
	const primaryWidth = usePaneWidth();
	const header = (
		<>
			{!wide && <View style={{ gap: 24 }}>{primary}</View>}
			{secondary}
		</>
	);
	return (
		<DetailLayoutLock value={lock}>
			<View style={{ flex: 1, flexDirection: "row", gap: wide ? 24 : 0 }}>
				{wide && (
					<View style={{ width: primaryWidth, minWidth: 0 }}>
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ gap: 24, paddingBottom: 48 }}
							showsVerticalScrollIndicator={false}
						>
							{primary}
						</ScrollView>
					</View>
				)}
				<View style={{ flex: 1, minWidth: 0, paddingTop: wide ? 24 : 0 }}>
					{renderContent ? (
						renderContent(header)
					) : (
						<ScrollView
							ref={scrollRef}
							contentContainerStyle={{ gap: 24, paddingBottom: 48 }}
							showsVerticalScrollIndicator={false}
							refreshControl={refreshControl}
						>
							{header}
						</ScrollView>
					)}
				</View>
			</View>
		</DetailLayoutLock>
	);
}
