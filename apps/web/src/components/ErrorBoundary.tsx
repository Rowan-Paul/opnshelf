import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";

interface ErrorComponentProps {
	error?: Error;
	reset?: () => void;
}

export function DefaultErrorComponent({ error, reset }: ErrorComponentProps) {
	const router = useRouter();

	const handleRetry = () => {
		if (reset) {
			reset();
		} else {
			router.invalidate();
		}
	};

	return (
		<div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
			{/* Error Icon */}
			<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/20">
				<AlertTriangle className="h-10 w-10 text-red-500" />
			</div>

			{/* Error Title */}
			<h1 className="text-display-2 mb-3 text-[var(--foreground)]">
				Something went wrong
			</h1>

			{/* Error Description */}
			<p className="mb-8 max-w-md text-lg text-[var(--foreground-muted)]">
				{error?.message ||
					"We encountered an unexpected error. Please try again or go back to the home page."}
			</p>

			{/* Error Details (only in development) */}
			{import.meta.env.DEV && error?.stack && (
				<div className="mb-8 max-w-2xl overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-900 dark:bg-red-950/20">
					<p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
						Stack trace:
					</p>
					<pre className="text-xs text-red-600 dark:text-red-300">
						{error.stack}
					</pre>
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<button
					type="button"
					onClick={handleRetry}
					className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[#3f2e00] transition-colors hover:bg-[var(--accent-hover)]"
				>
					<RefreshCw className="h-4 w-4" />
					Try Again
				</button>

				<Link
					to="/"
					className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background-subtle)] hover:border-[var(--border-strong)]"
				>
					<Home className="h-4 w-4" />
					Go Home
				</Link>

				<button
					type="button"
					onClick={() => router.history.back()}
					className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-6 py-3 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)]"
				>
					<ArrowLeft className="h-4 w-4" />
					Go Back
				</button>
			</div>
		</div>
	);
}

export function NotFoundComponent() {
	const router = useRouter();

	return (
		<div className="container-app flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
			{/* 404 Icon */}
			<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent-subtle)]">
				<span className="text-4xl font-bold text-[var(--accent)]">404</span>
			</div>

			{/* Title */}
			<h1 className="text-display-2 mb-3 text-[var(--foreground)]">
				Page not found
			</h1>

			{/* Description */}
			<p className="mb-8 max-w-md text-lg text-[var(--foreground-muted)]">
				The page you&apos;re looking for doesn&apos;t exist or has been moved.
			</p>

			{/* Action Buttons */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Link
					to="/"
					className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[#3f2e00] transition-colors hover:bg-[var(--accent-hover)]"
				>
					<Home className="h-4 w-4" />
					Go Home
				</Link>

				<button
					type="button"
					onClick={() => router.history.back()}
					className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-6 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background-subtle)] hover:border-[var(--border-strong)]"
				>
					<ArrowLeft className="h-4 w-4" />
					Go Back
				</button>
			</div>
		</div>
	);
}

export default DefaultErrorComponent;
