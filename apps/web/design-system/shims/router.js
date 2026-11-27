import * as React from "react";
/** Stand-in for TanStack Router's Link: the design system has no router, so it renders an anchor that does not navigate. */
export function Link({ to, children, onClick, ...props }) {
	return React.createElement(
		"a",
		{
			href: typeof to === "string" ? to : "#",
			...props,
			onClick: (event) => {
				if (onClick) onClick(event);
				event.preventDefault();
			},
		},
		children,
	);
}
