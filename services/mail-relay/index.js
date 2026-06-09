import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

// opnshelf mail-relay
// ------------------------------------------------------------------
// Railway blocks outbound SMTP (25/465/587/2525) on Hobby plans, so the
// Tranquil PDS — which only speaks SMTP smarthost — cannot reach Cloudflare's
// SMTP endpoint directly. This service bridges that gap: it accepts SMTP on the
// Railway *private* network (no public egress, so not blocked) and forwards each
// message to Cloudflare's Email Sending REST API over HTTPS (port 443, allowed).
//
// Tranquil → [private SMTP :2500] → mail-relay → [HTTPS 443] → Cloudflare.

const {
	CLOUDFLARE_API_TOKEN,
	CLOUDFLARE_ACCOUNT_ID,
	SMTP_PORT = "2500",
} = process.env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
	console.error(
		"FATAL: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required",
	);
	process.exit(1);
}

const SEND_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/sending/send`;

/** Build an Error carrying an explicit SMTP reply code for smtp-server. */
function smtpError(responseCode, message) {
	const err = new Error(message);
	err.responseCode = responseCode;
	return err;
}

/**
 * Map a mailparser AddressObject to Cloudflare's recipient shape:
 * a plain string, or { address, name } when a display name is present.
 */
function toRecipients(addr) {
	if (!addr?.value) return [];
	return addr.value
		.filter((a) => a.address)
		.map((a) => (a.name ? { address: a.address, name: a.name } : a.address));
}

const server = new SMTPServer({
	// Internal-only listener on a trusted private network: no TLS, no auth.
	// (Tranquil must be configured MAIL_SMARTHOST_TLS=none with no password.)
	authOptional: true,
	disabledCommands: ["AUTH", "STARTTLS"],
	onConnect(session, callback) {
		console.log(`connect from ${session.remoteAddress}`);
		callback();
	},
	onData(stream, _session, callback) {
		simpleParser(stream)
			.then(async (mail) => {
				const from = mail.from?.value?.[0];
				if (!from?.address) {
					return callback(smtpError(550, "message has no From address"));
				}

				const payload = {
					from: from.name
						? { address: from.address, name: from.name }
						: { address: from.address },
					to: toRecipients(mail.to),
					subject: mail.subject || "",
				};
				const cc = toRecipients(mail.cc);
				if (cc.length) payload.cc = cc;
				const replyTo = toRecipients(mail.replyTo)[0];
				if (replyTo) payload.reply_to = replyTo;
				if (mail.text) payload.text = mail.text;
				if (mail.html) payload.html = mail.html;

				if (!payload.to.length) {
					return callback(smtpError(550, "message has no recipients"));
				}

				const res = await fetch(SEND_URL, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!res.ok) {
					const detail = await res.text().catch(() => "");
					console.error(`Cloudflare send failed (HTTP ${res.status}): ${detail}`);
					// 451 → transient: Tranquil re-queues and retries the message.
					return callback(smtpError(451, `upstream send failed (${res.status})`));
				}

				console.log(
					`relayed: from=${from.address} subject=${JSON.stringify(payload.subject)}`,
				);
				callback();
			})
			.catch((err) => {
				console.error("relay error:", err);
				callback(err);
			});
	},
});

server.on("error", (err) => console.error("SMTP server error:", err));

const port = Number(SMTP_PORT);
// Bind to :: so the service is reachable over Railway's IPv6 private network.
server.listen(port, "::", () => {
	console.log(
		`mail-relay listening on [::]:${port} → Cloudflare account ${CLOUDFLARE_ACCOUNT_ID}`,
	);
});
