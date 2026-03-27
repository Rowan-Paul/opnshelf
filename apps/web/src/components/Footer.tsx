import { Link } from "@tanstack/react-router";
import { Film, Github } from "lucide-react";

export default function Footer() {
	return (
		<footer
			className="border-t py-8"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container-low)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			<div className="container mx-auto max-w-7xl px-4">
				<div className="flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
					<div className="flex items-center gap-2">
						<Film
							className="size-6"
							style={{ color: "var(--md-sys-color-primary)" }}
						/>
						<span
							className="font-semibold"
							style={{ color: "var(--md-sys-color-on-surface)" }}
						>
							OpnShelf
						</span>
					</div>

					<nav className="flex flex-wrap items-center justify-center gap-5 text-sm sm:gap-6">
						<Link
							to="/privacy"
							className="whitespace-nowrap transition-colors hover:text-(--md-sys-color-on-surface)"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Privacy Policy
						</Link>
						<a
							href="https://tangled.org/rowanpaulflynn.dev/opnshelf"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 transition-colors hover:text-(--md-sys-color-on-surface)"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							<img
								src="https://assets.tangled.network/tangled_dolly_face_only_white_on_trans.svg"
								alt="Tangled"
								className="size-4"
							/>
							Tangled
						</a>
						<a
							href="https://bsky.app/profile/opnshelf.xyz"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 transition-colors hover:text-(--md-sys-color-on-surface)"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							<svg
								preserveAspectRatio="xMidYMid"
								viewBox="0 0 256 226"
								className="size-4"
								aria-hidden="true"
							>
								<path
									fill="#1185FE"
									d="M55.491 15.172c29.35 22.035 60.917 66.712 72.509 90.686 11.592-23.974 43.159-68.651 72.509-90.686C221.686-.727 256-13.028 256 26.116c0 7.818-4.482 65.674-7.111 75.068-9.138 32.654-42.436 40.983-72.057 35.942 51.775 8.812 64.946 38 36.501 67.187-54.021 55.433-77.644-13.908-83.696-31.676-1.11-3.257-1.63-4.78-1.637-3.485-.008-1.296-.527.228-1.637 3.485-6.052 17.768-29.675 87.11-83.696 31.676-28.445-29.187-15.274-58.375 36.5-67.187-29.62 5.041-62.918-3.288-72.056-35.942C4.482 91.79 0 33.934 0 26.116 0-13.028 34.314-.727 55.491 15.172Z"
								/>
							</svg>
							Bluesky
						</a>
						<a
							href="https://github.com/Rowan-Paul/opnshelf"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 transition-colors hover:text-(--md-sys-color-on-surface)"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							<Github className="size-4" />
							GitHub
						</a>
					</nav>

					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						© {new Date().getFullYear()} OpnShelf. Built on AT Protocol.
					</p>
				</div>
			</div>
		</footer>
	);
}
