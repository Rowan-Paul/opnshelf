import { Link } from "@tanstack/react-router";
import type { MetadataPill } from "./types";

type MetadataPillsProps = {
	items: MetadataPill[];
};

export function MetadataPills({ items }: MetadataPillsProps) {
	return (
		<div className="flex flex-wrap gap-3">
			{items.map((item) => {
				const content = (
					<>
						{item.icon}
						{item.label}
					</>
				);

				if (item.linkTo) {
					return (
						<Link
							key={item.label}
							to={item.linkTo.to}
							params={item.linkTo.params}
							className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-(--md-sys-color-on-surface-variant) flex items-center gap-2 hover:bg-(--md-sys-color-surface-container)/40 transition-colors"
						>
							{content}
						</Link>
					);
				}

				return (
					<div
						key={item.label}
						className="rounded-full border border-(--md-sys-color-outline) px-3 py-1.5 text-sm text-(--md-sys-color-on-surface-variant) flex items-center gap-2"
					>
						{content}
					</div>
				);
			})}
		</div>
	);
}
