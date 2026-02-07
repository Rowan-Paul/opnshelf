import { useDeviceSize } from '../utils';

/**
 * Hook to determine device orientation and capabilities
 * Only tablets (medium/expanded size) should support landscape
 */
export function useOrientation() {
  const deviceSize = useDeviceSize();
  const isTablet = deviceSize === 'medium' || deviceSize === 'expanded';

  return {
    isTablet,
    isPhone: !isTablet,
    supportsLandscape: isTablet,
    // Phones should be portrait-only, tablets can rotate
    shouldLockToPortrait: !isTablet,
  };
}
