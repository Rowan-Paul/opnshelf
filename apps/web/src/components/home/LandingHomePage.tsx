import { Link } from "@tanstack/react-router";
import {
	CalendarRange,
	Clock3,
	Database,
	Film,
	ListChecks,
	LogIn,
	Search,
	ShieldCheck,
	Tv,
} from "lucide-react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

const featureCards = [
	{
		icon: Tv,
		title: "Movie, show, season, episode",
		description:
			"Track at exactly the level you want, from full-series completion down to single episodes.",
	},
	{
		icon: Clock3,
		title: "Full watch history",
		description:
			"Log rewatches, keep each watch date, and build a complete timeline of your viewing activity.",
	},
	{
		icon: ListChecks,
		title: "Powerful list workflows",
		description:
			"Use default lists and custom lists to organize favorites, queues, themes, and deep cuts.",
	},
	{
		icon: Database,
		title: "Import your history",
		description:
			"Import history from a public Trakt username or CSV to start with real data instead of a blank slate.",
	},
	{
		icon: CalendarRange,
		title: "Timezone-aware activity",
		description:
			"Keep your watch dates accurate with timezone and 12h/24h preferences built into your profile.",
	},
	{
		icon: ShieldCheck,
		title: "AT Protocol identity",
		description:
			"Sign in with your Atmosphere account and keep your identity and data model portable across apps.",
	},
];

export function LandingHomePage() {
	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div
				className="border-b"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<div className="container mx-auto px-4 py-14 md:py-20 max-w-6xl">
					<div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
						<div>
							<div className="flex items-center gap-3 mb-6">
								<img
									src="/icon.png"
									alt="OpnShelf"
									className="w-14 h-14 rounded-xl"
								/>
								<span
									className="md-label-large px-3 py-1 rounded-full"
									style={{
										backgroundColor:
											"var(--md-sys-color-secondary-container)",
										color: "var(--md-sys-color-on-secondary-container)",
									}}
								>
									Built for serious tracking
								</span>
							</div>
							<h1 className="md-display-medium mb-4">
								Track every watch. Organize every obsession.
							</h1>
							<p
								className="md-title-large mb-6"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								OpnShelf gives you movie and show tracking down to season and
								episode level, complete watch history, list organization, and a
								portable AT Protocol account.
							</p>
							<div className="flex flex-wrap gap-3">
								<M3Button variant="filled" size="lg" asChild>
									<Link to="/login">
										<LogIn className="w-5 h-5 mr-2" />
										Sign in to start tracking
									</Link>
								</M3Button>
								<M3Button variant="outlined" size="lg" asChild>
									<Link to="/search" search={{ q: "", type: "all" }}>
										<Search className="w-5 h-5 mr-2" />
										Browse catalog
									</Link>
								</M3Button>
							</div>
						</div>

						<M3Card variant="elevated" className="h-fit">
							<M3CardHeader>
								<M3CardTitle>Why people use OpnShelf</M3CardTitle>
								<M3CardDescription>
									Built for people who want more than a single watched toggle.
								</M3CardDescription>
							</M3CardHeader>
							<M3CardContent>
								<div className="space-y-4">
									{[
										{
											title: "Granular tracking",
											description:
												"Track movies, shows, seasons, and episodes as separate items.",
										},
										{
											title: "Real watch history",
											description:
												"Keep every watch date and rewatch, not just a binary status.",
										},
										{
											title: "Lists that stay useful",
											description:
												"Combine default lists with your own lists for any workflow.",
										},
									].map((item, index) => (
										<div key={item.title} className="flex items-start gap-3">
											<span
												className="md-label-large w-7 h-7 rounded-full flex items-center justify-center"
												style={{
													backgroundColor:
														"var(--md-sys-color-primary-container)",
													color: "var(--md-sys-color-on-primary-container)",
												}}
											>
												{index + 1}
											</span>
											<div>
												<p className="md-title-small">{item.title}</p>
												<p
													className="md-body-small"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													{item.description}
												</p>
											</div>
										</div>
									))}
								</div>
							</M3CardContent>
						</M3Card>
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 py-12 max-w-6xl">
				<div className="mb-6">
					<h2 className="md-headline-small mb-2">Features</h2>
					<p
						className="md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Everything you need to track and organize what you watch.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{featureCards.map((card) => {
						const Icon = card.icon;

						return (
							<M3Card key={card.title} variant="elevated">
								<M3CardHeader>
									<M3CardTitle className="flex items-center gap-2">
										<Icon className="w-5 h-5" />
										{card.title}
									</M3CardTitle>
								</M3CardHeader>
								<M3CardContent>
									<M3CardDescription>{card.description}</M3CardDescription>
								</M3CardContent>
							</M3Card>
						);
					})}
				</div>

				<M3Card variant="elevated" className="mt-8">
					<M3CardHeader>
						<M3CardTitle className="flex items-center gap-2">
							<Film className="w-5 h-5" />
							Explore without signing in
						</M3CardTitle>
						<M3CardDescription>
							Explore movies and shows right away, then sign in when you are
							ready to track.
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent className="flex flex-wrap gap-3">
						<M3Button variant="filled-tonal" asChild>
							<Link to="/search" search={{ q: "", type: "all" }}>
								<Search className="w-4 h-4 mr-2" />
								Start searching
							</Link>
						</M3Button>
						<M3Button variant="filled" asChild>
							<Link to="/login">
								<LogIn className="w-4 h-4 mr-2" />
								Unlock full tracking
							</Link>
						</M3Button>
					</M3CardContent>
				</M3Card>
			</div>
		</div>
	);
}
