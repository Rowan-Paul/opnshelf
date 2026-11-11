import { authControllerMeOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/auth/complete")({
	head: () => ({
		meta: [{ title: "Completing sign in | Opnshelf" }],
	}),
	component: AuthCompletePage,
});

function AuthCompletePage() {
	const search = useSearch({ from: "/auth/complete" });
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<"loading" | "success" | "error">(
		"loading",
	);
	const [errorMessage, setErrorMessage] = useState("");
	const maintenanceMessage =
		"Account storage maintenance is in progress. Please try again shortly.";

	// Helper function to get error message - memoized with useCallback
	const getErrorMessage = useCallback((error: string): string => {
		switch (error) {
			case "handle_required":
				return "Please provide your handle to sign in.";
			case "auth_failed":
				return "Authentication failed. Please check your handle and try again.";
			case "callback_failed":
				return "Something went wrong during authentication. Please try again.";
			default:
				return "An unexpected error occurred. Please try again.";
		}
	}, []);

	useEffect(() => {
		// Check for error in query params
		const error = (search as { error?: string }).error;
		if (error) {
			sessionStorage.removeItem("opnshelf-privacy-choice");
			setStatus("error");
			setErrorMessage(getErrorMessage(error));
			return;
		}

		// Refetch user data
		queryClient
			.fetchQuery(authControllerMeOptions())
			.then((data) => {
				setStatus("success");
				// Redirect to onboarding for new users, otherwise home
				const permission = (search as { permission?: string }).permission;
				const redirectTo = data?.needsOnboarding
					? "/onboarding"
					: permission === "privacy"
						? "/settings/privacy"
						: permission === "connections"
							? "/settings/connections"
							: permission === "atstore"
								? "/?review=compose"
								: permission === "popfeed"
									? "/integrations/popfeed"
									: "/";
				// Clear any stale query cache from previous sessions
				queryClient.clear();
				setTimeout(() => {
					window.location.href = redirectTo;
				}, 1500);
			})
			.catch((err) => {
				console.error("Failed to fetch user:", err);
				setStatus("error");
				const statusCode =
					err && typeof err === "object" && "statusCode" in err
						? (err as { statusCode?: unknown }).statusCode
						: err && typeof err === "object" && "status" in err
							? (err as { status?: unknown }).status
							: undefined;
				setErrorMessage(
					statusCode === 503
						? maintenanceMessage
						: "Failed to complete authentication. Please try again.",
				);
			});
	}, [queryClient, search, getErrorMessage]);

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-md text-center">
				{status === "loading" && (
					<>
						<Loader2 className="mx-auto size-16 animate-spin text-(--accent)" />
						<h1 className="mt-6 text-display-3">Completing Sign In...</h1>
						<p className="mt-2 text-(--foreground-muted)">
							Please wait while we verify your account.
						</p>
					</>
				)}

				{status === "success" && (
					<>
						<CheckCircle className="mx-auto size-16 text-success" />
						<p className="mt-6 text-(--foreground-muted)">Redirecting...</p>
					</>
				)}

				{status === "error" && (
					<>
						<XCircle className="mx-auto size-16 text-destructive" />
						<h1 className="mt-6 text-display-3">Sign In Failed</h1>
						<p className="mt-2 text-(--foreground-muted)">{errorMessage}</p>
						<a href="/login" className="btn btn-primary mt-6 inline-flex">
							Try Again
						</a>
					</>
				)}
			</div>
		</div>
	);
}
