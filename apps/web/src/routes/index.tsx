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
import LoadingState from "#/components/LoadingState";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	// Redirect to dashboard (or onboarding for new users) if already authenticated
	useEffect(() => {
		if (!authLoading && isAuthenticated) {
			if (user?.needsOnboarding) {
				navigate({ to: "/onboarding" });
			} else {
				navigate({ to: "/dashboard" });
			}
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	// Show loading while auth state is resolving (or when already
	// authenticated but the redirect hasn't fired yet) to prevent
	// logged-out content from flashing for logged-in users
	if (authLoading || isAuthenticated) {
		return <LoadingState />;
	}

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
						<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--background-elevated) px-4 py-1.5 text-sm">
							<Sparkles className="h-4 w-4 text-(--accent)" />
							<span>Powered by AT Protocol</span>
						</div>

						{/* Headline */}
						<h1 className="mb-6 text-display-1">
							Track what you watch.
							<br />
							Share with friends.
						</h1>

						{/* Subheadline */}
						<p className="mx-auto mb-10 max-w-xl text-(--foreground-muted) text-lg">
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
								<ArrowRight className="size-5" />
							</Link>
							<Link
								to="/about"
								className="text-(--foreground-muted) transition-colors hover:text-(--foreground)"
							>
								Learn more
							</Link>
						</div>
					</div>
				</div>

				{/* Background decoration */}
				<div className="absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-(--accent) opacity-[0.03] blur-3xl" />
				</div>
			</section>

			{/* Features Grid */}
			<section className="border-(--border) border-t py-24">
				<div className="container-app">
					<div className="mb-16 text-center">
						<h2 className="mb-4 text-display-2">Everything you need</h2>
						<p className="mx-auto max-w-xl text-(--foreground-muted)">
							A complete toolkit for media tracking and social discovery.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => {
							const Icon = feature.icon;
							return (
								<div
									key={feature.title}
									className="card p-6 transition-colors hover:border-(--border-strong)"
								>
									<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent-subtle) text-(--accent)">
										<Icon className="h-6 w-6" />
									</div>
									<h3 className="mb-2 font-semibold text-lg">
										{feature.title}
									</h3>
									<p className="text-(--foreground-muted) text-sm">
										{feature.description}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-(--border) border-t py-24">
				<div className="container-app">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="mb-4 text-display-2">Ready to start tracking?</h2>
						<p className="mb-8 text-(--foreground-muted)">
							Join thousands of users tracking their media journey with
							OpnShelf. Sign in with your AT Protocol account to get started.
						</p>
						<Link
							to="/login"
							className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
						>
							Sign In
							<ArrowRight className="size-5" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
