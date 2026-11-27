#!/usr/bin/env node
// Keeps the three places that state Opnshelf's design tokens in step, and
// rejects the class patterns that ADR 0053 retired.
//
//   node scripts/check-design-system.mjs
//
// 1. Web (apps/web/src/styles.css) and Mobile (apps/mobile/src/global.css)
//    give every shared token the same value in both themes.
// 2. The published design system (design/system/project/tokens.json) states
//    the Web values.
// 3. No amber text colour, and no focus style named after the accent.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THEMES = ["light", "dark"];

/** Tokens only Web needs: Mobile has no hover. A token missing from this list must exist on both clients. */
const WEB_ONLY = new Set(["accent-text-hover", "destructive-solid-hover", "shadow-color"]);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const normalize = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The declarations written directly in the first block that `opener` starts,
 * as `{ name: value }` without the leading dashes. A declaration inside a
 * nested rule belongs to that rule, so it is left out: read as the block's
 * own, it would hide the value the block really sets.
 */
export function declarations(css, opener) {
	const start = css.indexOf(opener);
	if (start < 0) throw new Error(`No "${opener}" block found`);
	let depth = 0;
	let own = "";
	for (let i = css.indexOf("{", start); i < css.length; i++) {
		const char = css[i];
		if (char === "{") depth++;
		else if (char === "}") {
			if (--depth === 0) break;
			// Ends the nested rule's text so it cannot join the next declaration.
			own += ";";
		} else if (depth === 1) own += char;
	}
	const out = {};
	for (const [, name, value] of own.matchAll(/(?:^|[;\s])--([\w.-]+)\s*:\s*([^;]+);/g)) out[name] = value.trim();
	return out;
}

/** Replaces every `var(--x)` with its value, so two spellings of one colour compare equal. */
export function resolve(value, scope, seen = new Set()) {
	return value.replace(/var\(--([\w.-]+)\)/g, (whole, name) => {
		if (seen.has(name) || !(name in scope)) return whole;
		return resolve(scope[name], scope, new Set(seen).add(name));
	});
}

const resolveAll = (scope) => Object.fromEntries(Object.entries(scope).map(([name, value]) => [name, normalize(resolve(value, scope))]));

/** Web tokens per theme. `.dark` overrides `:root`, so the dark theme is both blocks together. */
export function webTokens(css) {
	const clean = stripComments(css);
	const root = declarations(clean, "\n:root {");
	const dark = declarations(clean, "\n.dark {");
	return { light: resolveAll(root), dark: resolveAll({ ...root, ...dark }) };
}

/** Mobile tokens per theme, with the `color-` prefix Tailwind needs taken off. */
export function mobileTokens(css) {
	const clean = stripComments(css);
	const constants = declarations(clean, "@theme {");
	const unprefix = (scope) => Object.fromEntries(Object.entries(scope).map(([name, value]) => [name.replace(/^color-/, ""), value]));
	const theme = (variant) => resolveAll(unprefix({ ...constants, ...declarations(clean, `@variant ${variant} {`) }));
	return { light: theme("light"), dark: theme("dark") };
}

/** tokens.json per theme: `{name}` aliases resolved, a single value shared by both themes. */
export function publishedTokens(json) {
	const families = ["color", "radius", "shadow"].flatMap((family) => json[family]?.tokens ?? []);
	const themed = (theme) => {
		const scope = Object.fromEntries(
			families.map((token) => [token.name, typeof token.value === "string" ? token.value : (token.value[theme] ?? token.value.light)]),
		);
		const deref = (value, seen = new Set()) =>
			value.replace(/^\{([\w.-]+)\}$/, (whole, name) => (seen.has(name) || !(name in scope) ? whole : deref(scope[name], new Set(seen).add(name))));
		return Object.fromEntries(Object.entries(scope).map(([name, value]) => [name, normalize(deref(value))]));
	};
	return { light: themed("light"), dark: themed("dark") };
}

/** Only colours and radii are compared across clients; shadows, fonts and spacing differ by design. */
const isShared = (name) => !/^(shadow|font|spacing)/.test(name) && !WEB_ONLY.has(name);

export function compareClients(web, mobile) {
	const problems = [];
	for (const theme of THEMES) {
		for (const [name, value] of Object.entries(web[theme])) {
			if (!isShared(name)) continue;
			const other = mobile[theme][name];
			if (other === undefined) problems.push(`Mobile has no "${name}" token (${theme}). Web sets --${name} to ${value}.`);
			else if (other !== value) problems.push(`--${name} differs in ${theme}: Web ${value}, Mobile ${other}.`);
		}
		// The other direction: a token removed from Web must not linger on Mobile.
		for (const [name, value] of Object.entries(mobile[theme])) {
			if (isShared(name) && !(name in web[theme])) problems.push(`Web has no --${name} (${theme}). Mobile sets it to ${value}.`);
		}
	}
	return problems;
}

export function comparePublished(web, published) {
	const problems = [];
	for (const theme of THEMES) {
		for (const [name, value] of Object.entries(web[theme])) {
			if (name === "shadow-color") continue;
			const other = published[theme][name];
			if (other === undefined) problems.push(`tokens.json has no "${name}" token. Web sets --${name} to ${value} (${theme}).`);
			else if (other !== value) problems.push(`"${name}" differs in ${theme}: Web ${value}, tokens.json ${other}.`);
		}
		for (const name of Object.keys(published[theme])) {
			if (!(name in web[theme])) problems.push(`tokens.json has "${name}", which styles.css does not define.`);
		}
	}
	return [...new Set(problems)];
}

// Amber may colour a graphic, never text. A line counts as a graphic only when
// it is one self-closing component and nothing else (`<Star className="…" />`),
// or when the classes themselves say so: `fill-` exists only on SVG, and
// `animate-spin` is the spinner. A class such as `size-8` proves nothing, and
// text on the same line as an icon stays text.
const ICON_ELEMENT = /^\s*<[A-Z]\w*\s[^<>]*\/>\s*$/;
const GRAPHIC_CLASS = /(?<![\w-])fill-|(?<![\w-])animate-spin(?![\w-])/;

/** Files whose amber classes sit on an icon the two patterns above cannot see: the class string is built on its own line. */
const GRAPHIC_FILES = new Set(["apps/web/src/components/StarRating.tsx", "apps/web/src/components/following/UserAvatar.tsx"]);

// `primary` is an alias of the accent, so it is the same colour under another name.
const WEB_AMBER_TEXT = /(?<![\w-])text-(?:\(--(?:accent|primary)\)|(?:accent|primary)(?![\w-]))/;
const WEB_AMBER_HOVER = /hover:text-(?:\(--(?:accent|primary)\)|(?:accent|primary)(?![\w-]))/;
const WEB_AMBER_FOCUS = /focus(?:-visible|-within)?:(?:ring|border|outline)-(?:\(--(?:accent|primary)\)|(?:accent|primary)(?![\w-]))/;
const MOBILE_AMBER_TEXT = /(?<![\w-])text-(?:primary|accent)(?![\w-])/;

const isGraphic = (line, file) => ICON_ELEMENT.test(line) || GRAPHIC_CLASS.test(line) || GRAPHIC_FILES.has(file);

/**
 * Class patterns ADR 0053 retired. Each takes a source line and its
 * repository-relative path and returns a message when the line breaks it.
 * An opacity suffix (`text-accent/60`) is still the same colour.
 */
export const CLASS_RULES = {
	web: [
		(line, file) =>
			WEB_AMBER_HOVER.test(line) || (WEB_AMBER_TEXT.test(line) && !isGraphic(line, file))
				? "amber text is under 2:1 in the light theme; use text-(--accent-text)"
				: null,
		(line) => (WEB_AMBER_FOCUS.test(line) ? "a focus style must use the ring token: (--ring), not the accent" : null),
	],
	mobile: [
		(line, file) =>
			MOBILE_AMBER_TEXT.test(line) && !isGraphic(line, file) ? "amber text is under 2:1 in the light theme; use text-accent-text" : null,
	],
};

export function checkClasses(source, rules, file = "") {
	const problems = [];
	source.split("\n").forEach((line, index) => {
		for (const rule of rules) {
			const message = rule(line, file);
			if (message) problems.push({ line: index + 1, message });
		}
	});
	return problems;
}

function sourceFiles(dir) {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name))
		.map((entry) => path.join(entry.parentPath, entry.name));
}

export function checkRepository(root) {
	const read = (file) => readFileSync(path.join(root, file), "utf8");
	const web = webTokens(read("apps/web/src/styles.css"));
	const problems = [
		...compareClients(web, mobileTokens(read("apps/mobile/src/global.css"))),
		...comparePublished(web, publishedTokens(JSON.parse(read("design/system/project/tokens.json")))),
	];
	for (const [client, rules] of Object.entries(CLASS_RULES)) {
		for (const file of sourceFiles(path.join(root, "apps", client, "src"))) {
			const relative = path.relative(root, file).split(path.sep).join("/");
			for (const { line, message } of checkClasses(readFileSync(file, "utf8"), rules, relative)) {
				problems.push(`${relative}:${line}: ${message}.`);
			}
		}
	}
	return problems;
}

if (import.meta.main) {
	const problems = checkRepository(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
	if (problems.length > 0) {
		console.error(`Design system check failed (${problems.length}):\n${problems.map((problem) => `  - ${problem}`).join("\n")}\n\nSee docs/design-system.md.`);
		process.exit(1);
	}
	console.log("Design system check passed.");
}
