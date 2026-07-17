interface LogoProps {
	className?: string;
}

/** Opnshelf app-icon mark. Inline SVG stays crisp at every UI size. */
export default function Logo({ className }: LogoProps) {
	return (
		<svg
			viewBox="0 0 256 256"
			role="img"
			aria-label="Opnshelf"
			className={className}
		>
			<title>Opnshelf</title>
			<rect width="256" height="256" rx="56" fill="#0F172A" />
			<path
				fill="#F8FAFC"
				d="M67 42h124c7 0 10 8 6 13l-14 17h-70c-27 0-47 20-47 46 0 15 7 28 19 37l-20 28h129v31H67c-23 0-39-16-39-39V81c0-23 16-39 39-39Z"
			/>
			<path fill="#F3BC00" d="M96 158h52l13 22H81l15-22Z" />
		</svg>
	);
}
