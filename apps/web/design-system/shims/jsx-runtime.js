import * as React from "react";
export const Fragment = React.Fragment;
function make(type, props, key, spread) {
	const { children, ...rest } = props || {};
	if (key !== undefined) rest.key = key;
	if (children === undefined) return React.createElement(type, rest);
	return spread && Array.isArray(children)
		? React.createElement(type, rest, ...children)
		: React.createElement(type, rest, children);
}
export const jsx = (type, props, key) => make(type, props, key, false);
export const jsxs = (type, props, key) => make(type, props, key, true);
export const jsxDEV = (type, props, key, isStatic) => make(type, props, key, isStatic);
