import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { useEffect } from "react";

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

	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ["auth"] });

		const storedRedirect = sessionStorage.getItem("auth_redirect");
		sessionStorage.removeItem("auth_redirect");

		if (storedRedirect && isValidRedirectPath(storedRedirect)) {
			navigate({ to: storedRedirect });
		} else {
			navigate({ to: "/profile/shelf" });
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
