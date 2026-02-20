import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem, ColorTheme } from "./types";

type BreadcrumbNavProps = {
	items: BreadcrumbItem[];
	colors: ColorTheme;
};

export function BreadcrumbNav({ items, colors }: BreadcrumbNavProps) {
	return (
		<nav className="flex items-center gap-1 text-sm mb-4">
			{items.map((item, index) => {
				const isLast = index === items.length - 1;

				return (
					<div key={item.label} className="flex items-center gap-1">
						{index > 0 && <ChevronRight className="w-4 h-4 text-gray-500" />}
						{item.linkTo && !isLast ? (
							<Link
								to={item.linkTo.to}
								params={item.linkTo.params}
								className="text-gray-400 hover:text-gray-200 transition-colors"
							>
								{item.label}
							</Link>
						) : (
							<span className="font-medium" style={{ color: colors.primary }}>
								{item.label}
							</span>
						)}
					</div>
				);
			})}
		</nav>
	);
}
