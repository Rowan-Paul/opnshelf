import { useWindowDimensions } from 'react-native';

// Breakpoints based on Material Design 3 guidelines
export const BREAKPOINTS = {
  COMPACT: 600,
  MEDIUM: 840,
} as const;

export type DeviceSize = 'compact' | 'medium' | 'expanded';

/**
 * Hook to detect device size category based on screen width
 * - compact: < 600dp (phones in portrait)
 * - medium: 600-840dp (phones in landscape, small tablets)
 * - expanded: > 840dp (tablets, large screens)
 */
export function useDeviceSize(): DeviceSize {
  const { width } = useWindowDimensions();

  if (width < BREAKPOINTS.COMPACT) {
    return 'compact';
  } else if (width < BREAKPOINTS.MEDIUM) {
    return 'medium';
  }
  return 'expanded';
}

/**
 * Hook to check if device is a tablet (medium or expanded size)
 */
export function useIsTablet(): boolean {
  const deviceSize = useDeviceSize();
  return deviceSize === 'medium' || deviceSize === 'expanded';
}

/**
 * Hook to get the number of columns for grid layouts
 * - Search results: compact=2, medium=3, expanded=4
 * - Shelf grid: compact=1 (list), medium=2, expanded=3
 */
export function useNumColumns(type: 'search' | 'shelf' = 'search'): number {
  const deviceSize = useDeviceSize();

  if (type === 'search') {
    switch (deviceSize) {
      case 'compact':
        return 2;
      case 'medium':
        return 3;
      case 'expanded':
        return 4;
    }
  } else {
    // shelf type
    switch (deviceSize) {
      case 'compact':
        return 1; // List view on phones
      case 'medium':
        return 2;
      case 'expanded':
        return 3;
    }
  }
}

/**
 * Hook to get responsive padding/margins based on device size
 */
export function useResponsiveSpacing(): {
  horizontalPadding: number;
  gap: number;
} {
  const deviceSize = useDeviceSize();

  switch (deviceSize) {
    case 'compact':
      return { horizontalPadding: 16, gap: 16 };
    case 'medium':
      return { horizontalPadding: 24, gap: 20 };
    case 'expanded':
      return { horizontalPadding: 32, gap: 24 };
  }
}

/**
 * Hook to determine if current orientation is landscape
 */
export function useIsLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height;
}

/**
 * Hook to get max content width for centered layouts
 * Prevents text from stretching too wide on tablets
 */
export function useMaxContentWidth(): number | undefined {
  const deviceSize = useDeviceSize();

  switch (deviceSize) {
    case 'compact':
      return undefined; // Full width on phones
    case 'medium':
      return 600;
    case 'expanded':
      return 800;
  }
}
