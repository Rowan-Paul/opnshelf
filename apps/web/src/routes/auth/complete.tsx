import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/complete")({
	component: AuthCompletePage,
});

/**
 * Validates that a redirect path is safe (relative path only).
 * Rejects absolute URLs, protocol-relative URLs, and other attack vectors.
 */
function isValidRedirectPath(path: string): boolean {
	if (!path || typeof path !== "string") return false;
	// Must start with /
	if (!path.startsWith("/")) return false;
	// Must not contain // (protocol-relative or double slash)
	if (path.includes("//")) return false;
	// Must not start with /\ (Windows path injection)
	if (path.startsWith("/\\")) return false;
	return true;
}

function AuthCompletePage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	useEffect(() => {
		// Invalidate auth query so app picks up the new session
		queryClient.invalidateQueries({ queryKey: ["auth"] });

		// Read stored redirect path
		const storedRedirect = sessionStorage.getItem("auth_redirect");
		sessionStorage.removeItem("auth_redirect");

		// Validate and redirect
		if (storedRedirect && isValidRedirectPath(storedRedirect)) {
			navigate({ to: storedRedirect });
		} else {
			navigate({ to: "/shelf" });
		}
	}, [navigate, queryClient]);

	return (
		<div className="flex-1 bg-gray-950 text-gray-50 flex flex-col min-h-0">
			<div className="flex-1 flex flex-col items-center justify-center p-4">
				<Film className="w-12 h-12 text-purple-500 mb-4" />
				<div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
				<p className="text-gray-400">Completing sign-in...</p>
			</div>
		</div>
	);
}
