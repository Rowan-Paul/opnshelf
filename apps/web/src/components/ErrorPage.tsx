import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import * as React from "react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export function ErrorPage({ error, reset }: ErrorComponentProps) {
	const [canGoBack, setCanGoBack] = React.useState(false);

	React.useEffect(() => {
		setCanGoBack(window.history.length > 1);
	}, []);

	// Get error message based on error type
	const errorMessage = React.useMemo(() => {
		if (error instanceof Error) {
			return error.message;
		}
		if (typeof error === "string") {
			return error;
		}
		if (error && typeof error === "object" && "message" in error) {
			return String((error as { message: unknown }).message);
		}
		return "An unexpected error occurred";
	}, [error]);

	// Get error status/code if available (from API errors, etc.)
	const errorStatus = React.useMemo(() => {
		if (
			error &&
			typeof error === "object" &&
			"status" in error &&
			typeof error.status === "number"
		) {
			return error.status;
		}
		return null;
	}, [error]);

	return (
		<section className="relative isolate flex flex-1 items-center overflow-hidden">
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at top left, color-mix(in srgb, var(--md-sys-color-error) 14%, transparent), transparent 34%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--md-sys-color-error) 8%, transparent), transparent 28%)",
				}}
			/>

			<div className="container relative mx-auto flex w-full max-w-7xl flex-1 px-4 py-12 md:py-20">
				<div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
					<div className="max-w-2xl">
						<div
							className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
							style={{
								backgroundColor:
									"color-mix(in srgb, var(--md-sys-color-error) 10%, transparent)",
								borderColor:
									"color-mix(in srgb, var(--md-sys-color-error) 24%, transparent)",
								color: "var(--md-sys-color-error)",
							}}
						>
							<AlertTriangle className="size-4" />
							<span className="md-label-large">
								{errorStatus ? `${errorStatus} · ` : ""}Something went wrong
							</span>
						</div>

						<h1 className="md-display-small mb-4 max-w-xl">
							This page hit a technical snag.
						</h1>

						<p
							className="md-title-large max-w-xl"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{errorMessage ||
								"An unexpected error occurred while loading this page. The issue may be temporary or related to your connection."}
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<M3Button variant="filled" size="lg" asChild>
								<a href="/">
									<Home className="size-5" />
									Go home
								</a>
							</M3Button>

							<M3Button variant="filled-tonal" size="lg" onClick={reset}>
								<RefreshCw className="size-5" />
								Try again
							</M3Button>

							{canGoBack ? (
								<M3Button
									variant="text"
									size="lg"
									type="button"
									onClick={() => window.history.back()}
								>
									<ArrowLeft className="size-5" />
									Go back
								</M3Button>
							) : null}
						</div>
					</div>

					<M3Card
						variant="elevated"
						className="rounded-xl border"
						style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
					>
						<M3CardHeader className="gap-3 p-6 pb-4">
							<div
								className="flex size-14 items-center justify-center rounded-full"
								style={{
									backgroundColor: "var(--md-sys-color-error-container)",
									color: "var(--md-sys-color-on-error-container)",
								}}
							>
								<AlertTriangle className="size-7" />
							</div>
							<M3CardTitle className="md-headline-small">
								Let&apos;s get you back on track
							</M3CardTitle>
							<M3CardDescription className="md-body-large">
								Choose a recovery path below to continue using OpnShelf.
							</M3CardDescription>
						</M3CardHeader>

						<M3CardContent className="space-y-4 p-6 pt-0">
							<div
								className="rounded-xl border p-4"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Return to the dashboard
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									Start fresh from home and access your shelf, lists, and queue.
								</p>
							</div>

							<div
								className="rounded-xl border p-4"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Try reloading the page
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									If this is a temporary glitch, the Try again button above will
									reload the route data.
								</p>
							</div>

							<div
								className="rounded-xl border p-4"
								style={{
									backgroundColor:
										"color-mix(in srgb, var(--md-sys-color-error) 10%, transparent)",
									borderColor:
										"color-mix(in srgb, var(--md-sys-color-error) 24%, transparent)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Check your connection
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									If the error persists, it may be due to a network or server
									issue.
								</p>
							</div>
						</M3CardContent>
					</M3Card>
				</div>
			</div>
		</section>
	);
}
