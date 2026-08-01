const DEVICE_ID_KEY = "opnshelf_device_id";

/**
 * Which browser profile this is, for the Devices settings screen (ADR-0015).
 *
 * Known ceiling: a private window or cleared site data produces a new Device.
 * The only way around that is fingerprinting, which we deliberately don't do.
 */
export function browserDeviceIdentity(): {
	id: string;
	name?: string;
	platform: string;
} | null {
	let id: string | null = null;
	try {
		id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
	} catch {
		// Storage blocked (Safari private mode, hardened settings). No id means no
		// claim, which is better than a new device on every page load.
		return null;
	}
	return { id, name: browserLabel(), platform: "web" };
}

/** A short "Chrome on macOS" style label. */
function browserLabel(): string | undefined {
	const data = (
		navigator as Navigator & {
			userAgentData?: {
				brands: { brand: string }[];
				platform?: string;
			};
		}
	).userAgentData;
	if (data) {
		// Chromium sends deliberate junk entries ("Not_A Brand", "Chromium") to
		// stop naive parsing; the real brand is whatever's left.
		const brand = data.brands.find(
			(entry) => !/not.a.brand|chromium/i.test(entry.brand),
		)?.brand;
		return join(brand, data.platform);
	}
	const ua = navigator.userAgent;
	const browser = /Firefox\//.test(ua)
		? "Firefox"
		: /Edg\//.test(ua)
			? "Edge"
			: /Chrome\//.test(ua)
				? "Chrome"
				: /Safari\//.test(ua)
					? "Safari"
					: undefined;
	const platform = /Mac/.test(ua)
		? "macOS"
		: /Windows/.test(ua)
			? "Windows"
			: /Android/.test(ua)
				? "Android"
				: /iPhone|iPad/.test(ua)
					? "iOS"
					: /Linux/.test(ua)
						? "Linux"
						: undefined;
	return join(browser, platform);
}

function join(browser?: string, platform?: string): string | undefined {
	if (browser && platform) return `${browser} on ${platform}`;
	return browser ?? platform ?? undefined;
}
