import * as React from 'react';
import { View, type ViewProps, Animated } from 'react-native';
import { cn } from '@/lib/utils';

interface SkeletonProps extends ViewProps {
  show?: boolean;
}

function Skeleton({ className, show = true, ...props }: SkeletonProps) {
  const pulseAnim = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    if (!show) return;

    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.8,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0.4,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(pulse);
    loop.start();

    return () => {
      loop.stop();
    };
  }, [pulseAnim, show]);

  if (!show) return null;

  return (
    <Animated.View
      className={cn('rounded-md bg-gray-800', className)}
      style={[{ opacity: pulseAnim }]}
      {...props}
    />
  );
}

export { Skeleton };
