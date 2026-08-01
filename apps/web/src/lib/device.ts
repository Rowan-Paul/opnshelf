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
	return labelFromUserAgent(navigator.userAgent);
}

/**
 * Best-effort label from a User-Agent string.
 *
 * Order matters: iOS and Android are checked before macOS and Linux, because
 * every iPhone/iPad UA contains "like Mac OS X" and Android's contains "Linux".
 * Testing for Mac first reported every iPhone as macOS.
 *
 * A UA is a claim, not a fact — "Request desktop site" on Android Firefox sends
 * an X11/Linux UA, and this will faithfully report Linux. That's the ceiling of
 * UA sniffing; the alternative is fingerprinting, which we don't do.
 */
export function labelFromUserAgent(ua: string): string | undefined {
	const browser = /Firefox\/|FxiOS\//.test(ua)
		? "Firefox"
		: /Edg\/|EdgiOS\//.test(ua)
			? "Edge"
			: /Chrome\/|CriOS\//.test(ua)
				? "Chrome"
				: /Safari\//.test(ua)
					? "Safari"
					: undefined;
	const platform = /iPhone|iPad|iPod/.test(ua)
		? "iOS"
		: /Android/.test(ua)
			? "Android"
			: /Windows/.test(ua)
				? "Windows"
				: /Mac/.test(ua)
					? "macOS"
					: /Linux|X11/.test(ua)
						? "Linux"
						: undefined;
	return join(browser, platform);
}

function join(browser?: string, platform?: string): string | undefined {
	if (browser && platform) return `${browser} on ${platform}`;
	return browser ?? platform ?? undefined;
}
