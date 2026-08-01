import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";

/**
 * Which install this app is, for the Devices settings screen (ADR-0015).
 *
 * The platform's own vendor id, not a uuid we mint: both platforms clear an
 * app's keychain storage on uninstall, so a self-minted id would hand the user
 * a brand-new "device" after every reinstall. The vendor id survives that.
 *
 * Returns null when the platform withholds an id — the session then stays
 * unnamed rather than claiming a device, and is still revocable.
 */
export async function nativeDeviceIdentity(): Promise<{
	id: string;
	name?: string;
	platform: string;
} | null> {
	const id =
		Platform.OS === "ios"
			? await Application.getIosIdForVendorAsync()
			: Application.getAndroidId();
	if (!id) {
		return null;
	}
	return {
		id,
		// modelName ("iPhone 15 Pro"), not deviceName: since iOS 16 the latter
		// returns the model anyway unless the app holds Apple's user-assigned
		// device name entitlement, so asking for it buys nothing.
		name: Device.modelName ?? undefined,
		platform: Platform.OS,
	};
}
