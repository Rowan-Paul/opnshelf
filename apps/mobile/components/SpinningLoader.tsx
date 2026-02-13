import { Loader2 } from "lucide-react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

interface SpinningLoaderProps {
	size: number;
	color: string;
}

export function SpinningLoader({ size, color }: SpinningLoaderProps) {
	const rotation = useSharedValue(0);

	rotation.value = withRepeat(
		withTiming(360, { duration: 1000, easing: Easing.linear }),
		-1,
		false,
	);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	return (
		<Animated.View style={animatedStyle}>
			<Loader2 size={size} color={color} />
		</Animated.View>
	);
}
