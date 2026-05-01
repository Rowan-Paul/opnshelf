import { authControllerMeOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/auth/complete")({
	component: AuthCompletePage,
});

function AuthCompletePage() {
	const search = useSearch({ from: "/auth/complete" });
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<"loading" | "success" | "error">(
		"loading",
	);
	const [errorMessage, setErrorMessage] = useState("");

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
				const redirectTo = data?.needsOnboarding ? "/onboarding" : "/dashboard";
				setTimeout(() => {
					window.location.href = redirectTo;
				}, 1500);
			})
			.catch((err) => {
				console.error("Failed to fetch user:", err);
				setStatus("error");
				setErrorMessage("Failed to complete authentication. Please try again.");
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
						<CheckCircle className="mx-auto size-16 text-green-500" />
						<h1 className="mt-6 text-display-3">Welcome!</h1>
						<p className="mt-2 text-(--foreground-muted)">
							You&apos;re signed in. Redirecting to your dashboard...
						</p>
					</>
				)}

				{status === "error" && (
					<>
						<XCircle className="mx-auto size-16 text-red-500" />
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
