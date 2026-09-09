import { isIP } from "node:net";

export type PublicUrlOptions = {
	/**
	 * Accept `http:` in addition to `https:`. Only for non-production
	 * environments where a local PDS runs without TLS.
	 */
	allowHttp?: boolean;
};

/**
 * Checks that a URL points at a public host before the server fetches it on
 * behalf of a client. Returns `null` when the URL is acceptable, otherwise a
 * short reason meant for server-side logs (never for the client).
 *
 * This is a hostname allowlist check only: it rejects IP literals in
 * loopback, private, link-local, unspecified and metadata ranges and a few
 * well-known internal hostnames. It does not resolve DNS, so a public
 * hostname that resolves to a private address is not caught here; `safeFetch`
 * in `./safe-fetch` closes that gap by applying `isBlockedIpAddress` to every
 * resolved address at connect time.
 */
export function validatePublicHttpUrl(
	value: string,
	options: PublicUrlOptions = {},
): string | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return "invalid URL";
	}

	if (url.protocol !== "https:") {
		if (!(url.protocol === "http:" && options.allowHttp)) {
			return `disallowed scheme ${url.protocol}`;
		}
	}

	if (url.username || url.password) {
		return "credentials in URL";
	}

	const hostname = url.hostname.toLowerCase();
	if (hostname.length === 0) {
		return "empty hostname";
	}

	if (isBlockedHostname(hostname)) {
		return `blocked hostname ${hostname}`;
	}

	// The URL parser keeps IPv6 literals bracketed and normalizes IPv4
	// shorthand (hex, octal, fewer octets) to dotted decimal.
	const ipLiteral = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
	const version = isIP(ipLiteral);
	if (version === 4 && isBlockedIpv4(ipLiteral)) {
		return `blocked IPv4 address ${ipLiteral}`;
	}
	if (version === 6 && isBlockedIpv6(ipLiteral)) {
		return `blocked IPv6 address ${ipLiteral}`;
	}

	return null;
}

function isBlockedHostname(hostname: string): boolean {
	const bare = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
	return (
		bare === "localhost" ||
		bare.endsWith(".localhost") ||
		bare.endsWith(".internal") ||
		bare.endsWith(".local")
	);
}

/**
 * Whether an IP address (v4 or v6, no brackets) falls in a range this server
 * must never connect to. Anything that is not a well-formed IP address counts
 * as blocked, so callers fail closed.
 */
export function isBlockedIpAddress(address: string): boolean {
	const version = isIP(address);
	if (version === 4) {
		return isBlockedIpv4(address);
	}
	if (version === 6) {
		return isBlockedIpv6(address);
	}
	return true;
}

export function isBlockedIpv4(address: string): boolean {
	const octets = address.split(".").map(Number);
	if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
		return true;
	}
	const [a, b] = octets as [number, number, number, number];
	return (
		a === 0 || // 0.0.0.0/8 (includes 0.0.0.0, "this host")
		a === 10 || // 10.0.0.0/8
		a === 127 || // 127.0.0.0/8 loopback
		(a === 169 && b === 254) || // 169.254.0.0/16 link-local, cloud metadata
		(a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
		(a === 192 && b === 168) || // 192.168.0.0/16
		(a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 shared address space
		a >= 224 // multicast and reserved, including broadcast
	);
}

export function isBlockedIpv6(address: string): boolean {
	const hextets = expandIpv6(address);
	if (!hextets) {
		return true;
	}

	// IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms.
	const leadingZero = hextets.slice(0, 5).every((hextet) => hextet === 0);
	if (leadingZero && (hextets[5] === 0xffff || hextets[5] === 0)) {
		const high = hextets[6] as number;
		const low = hextets[7] as number;
		if (hextets[5] === 0 && high === 0 && low <= 1) {
			return true; // :: (unspecified) and ::1 (loopback)
		}
		const mapped = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
		return isBlockedIpv4(mapped);
	}

	const first = hextets[0] as number;
	return (
		(first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
		(first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
		(first & 0xff00) === 0xff00 // ff00::/8 multicast
	);
}

/** Expands an IPv6 literal into eight 16-bit hextets. */
function expandIpv6(address: string): number[] | null {
	// Strip a zone id such as fe80::1%eth0.
	const [withoutZone] = address.split("%") as [string];
	let text = withoutZone;

	// Convert a trailing dotted IPv4 (::ffff:1.2.3.4) into two hextets.
	const lastColon = text.lastIndexOf(":");
	const tail = text.slice(lastColon + 1);
	if (tail.includes(".")) {
		const octets = tail.split(".").map(Number);
		if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
			return null;
		}
		const [a, b, c, d] = octets as [number, number, number, number];
		text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}

	const parts = text.split("::");
	if (parts.length > 2) {
		return null;
	}
	const head = parts[0] ? parts[0].split(":") : [];
	const rest = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
	const missing = 8 - head.length - rest.length;
	if (missing < 0 || (parts.length === 1 && missing !== 0)) {
		return null;
	}
	const hextets = [
		...head,
		...Array.from({ length: missing }, () => "0"),
		...rest,
	].map((hextet) => Number.parseInt(hextet, 16));
	if (hextets.some((hextet) => Number.isNaN(hextet))) {
		return null;
	}
	return hextets;
}
