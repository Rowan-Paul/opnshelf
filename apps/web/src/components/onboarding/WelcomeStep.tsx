import { ArrowRight } from "lucide-react";
import Logo from "#/components/Logo";

/** Onboarding step 1: the welcome card. */
export function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<div className="card p-8 text-center">
			<div className="mb-6 flex justify-center">
				<Logo className="size-16 rounded-2xl" />
			</div>
			<h1 className="mb-3 text-display-2">Welcome to Opnshelf</h1>
			<p className="mx-auto mb-8 max-w-sm text-(--foreground-muted)">
				Let&apos;s get you set up in just a few steps. You can import your watch
				history and connect with friends already here.
			</p>
			<button type="button" onClick={onNext} className="btn btn-primary w-full">
				Get Started
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}
