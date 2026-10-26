import { useEffect, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

const listeners = new Set<() => void>();
const colors = ["#f59e0b", "#22c55e", "#38bdf8", "#f472b6", "#a78bfa"];
export function celebrateCompletion() {
	for (const listener of listeners) listener();
}

function Burst() {
	const progress = useRef(new Animated.Value(0)).current;
	const { width, height } = useWindowDimensions();
	useEffect(() => {
		const animation = Animated.timing(progress, {
			toValue: 1,
			duration: 2400,
			useNativeDriver: true,
		});
		animation.start();
		return () => animation.stop();
	}, [progress]);
	return (
		<View
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[StyleSheet.absoluteFill, { zIndex: 9999, overflow: "hidden" }]}
		>
			{Array.from({ length: 48 }, (_, index) => (
				<Animated.View
					// biome-ignore lint/suspicious/noArrayIndexKey: Fixed decorative particles never reorder.
					key={index}
					style={{
						position: "absolute",
						top: -16,
						left: (((index * 37) % 100) * width) / 100,
						width: 8,
						height: 12,
						borderRadius: 2,
						backgroundColor: colors[index % colors.length],
						opacity: progress.interpolate({
							inputRange: [0, 0.8, 1],
							outputRange: [1, 1, 0],
						}),
						transform: [
							{
								translateY: progress.interpolate({
									inputRange: [0, 1],
									outputRange: [-20 - (index % 7) * 45, height + 350],
								}),
							},
							{
								translateX: progress.interpolate({
									inputRange: [0, 1],
									outputRange: [0, (index % 2 ? 1 : -1) * (30 + index * 2)],
								}),
							},
							{
								rotate: progress.interpolate({
									inputRange: [0, 1],
									outputRange: ["0deg", `${360 + index * 23}deg`],
								}),
							},
						],
					}}
				/>
			))}
		</View>
	);
}

export function CompletionConfetti() {
	const [burst, setBurst] = useState(0);
	useEffect(() => {
		let mounted = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const celebrate = () => {
			void AccessibilityInfo.isReduceMotionEnabled()
				.then((reduced) => {
					if (!mounted || reduced) return;
					setBurst((value) => value + 1);
					clearTimeout(timer);
					timer = setTimeout(() => setBurst(0), 2600);
				})
				.catch(() => {});
		};
		listeners.add(celebrate);
		return () => {
			mounted = false;
			listeners.delete(celebrate);
			clearTimeout(timer);
		};
	}, []);
	return burst ? <Burst key={burst} /> : null;
}
