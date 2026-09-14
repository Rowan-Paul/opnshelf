import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/** Railway's edge supplies X-Real-IP; never sign client-supplied X-Forwarded-For. */
export function signSsrClientIp(
	request: Request,
	ip: string | undefined,
): Request {
	const secret = process.env.SSR_RATE_LIMIT_SECRET;
	if (!secret || secret.length < 32 || !ip || !isIP(ip)) return request;
	const timestamp = String(Date.now());
	request.headers.set("x-opnshelf-client-ip", ip);
	request.headers.set("x-opnshelf-client-time", timestamp);
	request.headers.set(
		"x-opnshelf-client-signature",
		createHmac("sha256", secret).update(`${ip}\n${timestamp}`).digest("hex"),
	);
	return request;
}
