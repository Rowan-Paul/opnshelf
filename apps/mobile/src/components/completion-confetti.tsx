import { useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Animated,
	Easing,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import {
	CONFETTI_DURATION,
	createConfettiParticles,
} from "@/lib/confetti-particles";
import { isConfettiEnabled } from "@/lib/confetti-preference";

const listeners = new Set<() => void>();
export function celebrateCompletion() {
	for (const listener of listeners) listener();
}

function Burst() {
	const progress = useRef(new Animated.Value(0)).current;
	const { width, height } = useWindowDimensions();
	const particles = useMemo(
		() => createConfettiParticles(width, height),
		[width, height],
	);
	useEffect(() => {
		const animation = Animated.timing(progress, {
			toValue: 1,
			duration: CONFETTI_DURATION,
			easing: Easing.linear,
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
			{particles.map((particle) => {
				const inputRange = particle.frames.map((frame) => frame.offset);
				return (
					<Animated.View
						key={particle.id}
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							width: particle.width,
							height: particle.height,
							backgroundColor: particle.color,
							opacity: progress.interpolate({
								inputRange,
								outputRange: particle.frames.map((frame) => frame.opacity),
							}),
							transform: [
								{ perspective: 600 },
								{
									translateX: progress.interpolate({
										inputRange,
										outputRange: particle.frames.map((frame) => frame.x),
									}),
								},
								{
									translateY: progress.interpolate({
										inputRange,
										outputRange: particle.frames.map((frame) => frame.y),
									}),
								},
								{
									rotateZ: progress.interpolate({
										inputRange,
										outputRange: particle.frames.map(
											(frame) => `${frame.rotation}deg`,
										),
									}),
								},
								{
									rotateX: progress.interpolate({
										inputRange,
										outputRange: particle.frames.map(
											(frame) => `${frame.tumble}deg`,
										),
									}),
								},
							],
						}}
					/>
				);
			})}
		</View>
	);
}

export function CompletionConfetti() {
	const [burst, setBurst] = useState(0);
	useEffect(() => {
		let mounted = true;
		let active = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const celebrate = () => {
			if (active) return;
			active = true;
			void Promise.all([
				AccessibilityInfo.isReduceMotionEnabled(),
				isConfettiEnabled(),
			])
				.then(([reduced, enabled]) => {
					if (!mounted || reduced || !enabled) {
						active = false;
						return;
					}
					setBurst((value) => value + 1);
					clearTimeout(timer);
					timer = setTimeout(() => {
						active = false;
						setBurst(0);
					}, CONFETTI_DURATION + 100);
				})
				.catch(() => {
					active = false;
				});
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
