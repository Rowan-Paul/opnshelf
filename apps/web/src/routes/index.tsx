import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Calendar,
	Film,
	Heart,
	List,
	Sparkles,
	Tv,
	Users,
} from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	// Redirect to dashboard if already authenticated
	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const features = [
		{
			icon: Film,
			title: "Track Everything",
			description:
				"Log movies and TV shows you watch. Keep a complete history of your viewing journey.",
		},
		{
			icon: Heart,
			title: "Rate & Review",
			description:
				"Share your thoughts and ratings. Help others discover great content.",
		},
		{
			icon: Calendar,
			title: "Release Calendar",
			description:
				"Never miss a premiere. Track upcoming releases for shows you follow.",
		},
		{
			icon: Users,
			title: "Social Feed",
			description:
				"See what your friends are watching. Discover new favorites together.",
		},
		{
			icon: List,
			title: "Curated Lists",
			description:
				"Create and share watchlists. Organize your must-watch content.",
		},
		{
			icon: Tv,
			title: "Episode Tracking",
			description:
				"Track episodes and seasons. Pick up right where you left off.",
		},
	];

	return (
		<div className="min-h-screen">
			{/* Hero Section */}
			<section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
				<div className="container-app">
					<div className="mx-auto max-w-3xl text-center">
						{/* Badge */}
						<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-1.5 text-sm">
							<Sparkles className="h-4 w-4 text-[var(--accent)]" />
							<span>Powered by AT Protocol</span>
						</div>

						{/* Headline */}
						<h1 className="text-display-1 mb-6">
							Track what you watch.
							<br />
							Share with friends.
						</h1>

						{/* Subheadline */}
						<p className="mx-auto mb-10 max-w-xl text-lg text-[var(--foreground-muted)]">
							OpnShelf is your personal media tracker. Log movies and shows, see
							what friends are watching, and discover your next favorite.
						</p>

						{/* CTA Buttons */}
						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Link
								to="/login"
								className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
							>
								Get Started
								<ArrowRight className="h-5 w-5" />
							</Link>
							<Link
								to="/about"
								className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
							>
								Learn more
							</Link>
						</div>
					</div>
				</div>

				{/* Background decoration */}
				<div className="absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.03] blur-3xl" />
				</div>
			</section>

			{/* Features Grid */}
			<section className="border-t border-[var(--border)] py-24">
				<div className="container-app">
					<div className="mb-16 text-center">
						<h2 className="text-display-2 mb-4">Everything you need</h2>
						<p className="mx-auto max-w-xl text-[var(--foreground-muted)]">
							A complete toolkit for media tracking and social discovery.
						</p>
					</div>

					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => {
							const Icon = feature.icon;
							return (
								<div
									key={feature.title}
									className="card p-6 transition-colors hover:border-[var(--border-strong)]"
								>
									<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
										<Icon className="h-6 w-6" />
									</div>
									<h3 className="mb-2 text-lg font-semibold">
										{feature.title}
									</h3>
									<p className="text-sm text-[var(--foreground-muted)]">
										{feature.description}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-t border-[var(--border)] py-24">
				<div className="container-app">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="text-display-2 mb-4">Ready to start tracking?</h2>
						<p className="mb-8 text-[var(--foreground-muted)]">
							Join thousands of users tracking their media journey with
							OpnShelf. Sign in with your AT Protocol account to get started.
						</p>
						<Link
							to="/login"
							className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
						>
							Sign In
							<ArrowRight className="h-5 w-5" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
