import type { PrismaService } from "../prisma/prisma.service";

export async function sendPushNotification(
	prisma: PrismaService,
	token: string,
	job: { title: string; body: string; url: string | null },
): Promise<boolean> {
	const response = await fetch("https://exp.host/--/api/v2/push/send", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			to: token,
			title: job.title,
			body: job.body,
			data: { path: job.url },
			sound: "default",
			channelId: "releases",
		}),
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok)
		throw new Error(`Expo push returned HTTP ${response.status}`);
	const result = (await response.json()) as {
		data?: { status?: string; details?: { error?: string } };
	};
	if (result.data?.details?.error === "DeviceNotRegistered") {
		await prisma.pushDevice.deleteMany({ where: { token } });
		return false;
	}
	if (result.data?.status !== "ok")
		throw new Error(
			`Expo push rejected notification: ${result.data?.details?.error ?? "unknown"}`,
		);
	return true;
}
