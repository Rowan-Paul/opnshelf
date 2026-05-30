interface LogoProps {
	className?: string;
}

/** OpnShelf brand mark. Renders the app logo image. */
export default function Logo({ className }: LogoProps) {
	return (
		<img
			src="/logo512.png"
			alt="OpnShelf"
			className={className}
			width={512}
			height={512}
		/>
	);
}
