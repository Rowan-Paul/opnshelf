import { authControllerMeOptions } from "@opnshelf/api";
import { usePostHog } from "@posthog/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/auth/complete")({
	component: AuthCompletePage,
});

function isValidRedirectPath(path: string): boolean {
	if (!path || typeof path !== "string") return false;
	if (!path.startsWith("/")) return false;
	if (path.includes("//")) return false;
	if (path.startsWith("/\\")) return false;
	return true;
}

function AuthCompletePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { seedColor } = useTheme();
	const posthog = usePostHog();

	useEffect(() => {
		async function completeAuth() {
			try {
				queryClient.invalidateQueries({ queryKey: ["auth"] });
				sessionStorage.removeItem("oauth_pending");

				const user = await queryClient.fetchQuery({
					...authControllerMeOptions(),
					staleTime: 0,
				});

				if (user) {
					posthog.identify(user.did, {
						$set: {
							handle: user.handle,
							did: user.did,
						},
						$set_once: {
							first_login_date: new Date().toISOString(),
						},
					});
					posthog.capture("user_logged_in", {
						handle: user.handle,
					});
				}

				posthog.capture("auth_completed");

				const storedRedirect = sessionStorage.getItem("auth_redirect");
				sessionStorage.removeItem("auth_redirect");

				if (storedRedirect && isValidRedirectPath(storedRedirect)) {
					navigate({ to: storedRedirect });
				} else {
					navigate({ to: "/profile/shelf" });
				}
			} catch (error) {
				console.error("Auth complete failed:", error);
				posthog.capture("auth_completed", {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				navigate({ to: "/login" });
			}
		}

		completeAuth();
	}, [navigate, queryClient, posthog]);

	return (
		<div
			className="flex-1 flex flex-col min-h-0"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="flex-1 flex flex-col items-center justify-center p-4">
				<img
					src="/icon.png"
					alt="OpnShelf"
					className="w-16 h-16 rounded-xl mb-4"
				/>
				<div
					className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mb-4"
					style={{ borderColor: seedColor }}
				/>
				<p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
					Completing sign-in...
				</p>
			</div>
		</div>
	);
}
