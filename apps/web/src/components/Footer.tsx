import { Link } from "@tanstack/react-router";
import Logo from "./Logo";

// Bluesky icon component using local SVG
const BlueskyIcon = ({ className }: { className?: string }) => (
	<img src="/bluesky.svg" alt="Bluesky" className={className} />
);

// Tangled icon component with dark/light mode variants
const TangledIcon = ({ className }: { className?: string }) => (
	<div
		className={`relative ${className}`}
		style={{ width: "1rem", height: "1rem" }}
	>
		{/* Dark mode (white icon) */}
		<img
			src="/tangled-white.svg"
			alt="Tangled"
			className="absolute inset-0 hidden h-full w-full object-contain dark:block"
		/>
		{/* Light mode (black icon) */}
		<img
			src="/tangled-black.svg"
			alt="Tangled"
			className="absolute inset-0 block h-full w-full object-contain dark:hidden"
		/>
	</div>
);

const footerLinks = {
	social: [
		{
			name: "Bluesky",
			href: "https://bsky.app/profile/opnshelf.xyz",
			icon: BlueskyIcon,
		},
		{
			name: "Tangled",
			href: "https://tangled.org/rowanpaulflynn.dev/opnshelf",
			icon: TangledIcon,
		},
	],
};

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-border border-t bg-background">
			<div className="container-app py-12">
				<div className="flex flex-col items-center gap-8">
					{/* Brand */}
					<div className="text-center">
						<Link to="/" className="inline-flex items-center gap-2">
							<Logo className="size-8 rounded-lg" />
							<span className="font-bold font-display text-lg">Opnshelf</span>
						</Link>
						<p className="mx-auto mt-4 max-w-sm text-(--foreground-muted) text-sm">
							Track what you watch, share your taste, and discover what others
							are watching.
						</p>
						<div className="mt-6 flex items-center justify-center gap-4">
							{footerLinks.social.map((item) => {
								const Icon = item.icon;
								return (
									<a
										key={item.name}
										href={item.href}
										target="_blank"
										rel="noopener noreferrer"
										className="flex h-9 w-9 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-foreground"
										aria-label={item.name}
									>
										{item.name === "Tangled" ? (
											<TangledIcon className="h-4 w-4" />
										) : (
											<Icon className="h-4 w-4" />
										)}
									</a>
								);
							})}
						</div>
					</div>
				</div>

				{/* Bottom */}
				<div className="mt-12 flex flex-col items-center justify-between gap-4 border-border border-t pt-8 sm:flex-row">
					<p className="text-(--foreground-subtle) text-sm">
						&copy; {year} Opnshelf. All rights reserved.
					</p>
					<div className="flex items-center gap-4">
						<Link
							to="/tos"
							className="text-(--foreground-subtle) text-xs hover:text-(--foreground)"
						>
							Terms of Service
						</Link>
						<Link
							to="/privacy"
							className="text-(--foreground-subtle) text-xs hover:text-(--foreground)"
						>
							Privacy Policy
						</Link>
						<p className="text-(--foreground-subtle) text-xs">
							Built with ❤️ by{" "}
							<a
								href="https://rowanpaulflynn.com"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent hover:underline"
							>
								Rowan Paul Flynn
							</a>
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
