import { Link } from "@tanstack/react-router";
import { Film, Github } from "lucide-react";

export default function Footer() {
	return (
		<footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
			<div className="container mx-auto px-4">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<Film className="w-6 h-6 text-amber-500" />
						<span className="font-semibold text-white">OpnShelf</span>
					</div>

					<nav className="flex items-center gap-6 text-sm">
						<Link to="/privacy" className="hover:text-white transition-colors">
							Privacy Policy
						</Link>
						<a
							href="https://tangled.org/rowanpaulflynn.dev/opnshelf"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 hover:text-white transition-colors"
						>
							<img
								src="https://assets.tangled.network/tangled_dolly_face_only_white_on_trans.svg"
								alt="Tangled"
								className="w-4 h-4"
							/>
							Tangled
						</a>
						<a
							href="https://bsky.app/profile/opnshelf.xyz"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 hover:text-white transition-colors"
						>
							<svg
								preserveAspectRatio="xMidYMid"
								viewBox="0 0 256 226"
								className="w-4 h-4"
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
							className="flex items-center gap-2 hover:text-white transition-colors"
						>
							<Github className="w-4 h-4" />
							GitHub
						</a>
					</nav>

					<p className="text-sm">
						© {new Date().getFullYear()} OpnShelf. Built on AT Protocol.
					</p>
				</div>
			</div>
		</footer>
	);
}
