import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	CLASS_RULES,
	checkClasses,
	checkRepository,
	compareClients,
	comparePublished,
	mobileTokens,
	publishedTokens,
	webTokens,
} from "./check-design-system.mjs";

const WEB = `
:root {
  --slate-500: #64748B;
  --accent-600: #f3bc00;
  --accent: var(--accent-600);
  /* a comment with --fake: value; inside */
  --muted: #5e6d83;
  --primary: var(--accent);
  --shadow-color: 215 28% 17%;
  --shadow-sm: 0 1px 2px 0 hsl(var(--shadow-color) / 0.05);
  --radius-md: 10px;
}

.dark {
  --accent: #fbbf24;
}
`;

const MOBILE = `
@theme {
  --color-slate-500: #64748b;
  --color-accent-600: #f3bc00;
  --radius-md: 10px;
}
@layer theme {
  :root {
    @variant light {
      --color-accent: #f3bc00;
      --color-muted: #5e6d83;
      --color-primary: #f3bc00;
    }
    @variant dark {
      --color-accent: #fbbf24;
      --color-muted: #5e6d83;
      --color-primary: #fbbf24;
    }
  }
}
`;

test("Web tokens resolve aliases per theme, with dark inheriting the root", () => {
	const web = webTokens(WEB);
	assert.equal(web.light.primary, "#f3bc00");
	assert.equal(web.dark.primary, "#fbbf24");
	assert.equal(web.dark.muted, "#5e6d83");
	assert.equal(web.light["slate-500"], "#64748b");
	assert.equal(web.light["shadow-sm"], "0 1px 2px 0 hsl(215 28% 17% / 0.05)");
	assert.equal("fake" in web.light, false);
});

test("matching clients pass and a changed or missing Mobile token is named", () => {
	const web = webTokens(WEB);
	assert.deepEqual(compareClients(web, mobileTokens(MOBILE)), []);

	const drifted = compareClients(web, mobileTokens(MOBILE.replace("--color-muted: #5e6d83;\n      --color-primary: #f3bc00;", "--color-muted: #64748b;")));
	assert.deepEqual(drifted, [
		"--muted differs in light: Web #5e6d83, Mobile #64748b.",
		"Mobile has no --color-primary (light). Web sets --primary to #f3bc00.",
	]);
});

test("the published tokens must state the Web values and nothing else", () => {
	const web = webTokens(WEB);
	const tokens = (overrides = {}) => ({
		color: {
			tokens: [
				{ name: "slate-500", value: "#64748b" },
				{ name: "accent-600", value: "#f3bc00" },
				{ name: "accent", value: { light: "{accent-600}", dark: "#fbbf24" } },
				{ name: "muted", value: overrides.muted ?? "#5e6d83" },
				{ name: "primary", value: "{accent}" },
				...(overrides.extra ?? []),
			],
		},
		radius: { tokens: [{ name: "radius-md", value: "10px" }] },
		shadow: { tokens: [{ name: "shadow-sm", value: "0 1px 2px 0 hsl(215 28% 17% / 0.05)" }] },
	});
	assert.deepEqual(comparePublished(web, publishedTokens(tokens())), []);
	assert.deepEqual(comparePublished(web, publishedTokens(tokens({ muted: "#64748b" }))), [
		'"muted" differs in light: Web #5e6d83, tokens.json #64748b.',
		'"muted" differs in dark: Web #5e6d83, tokens.json #64748b.',
	]);
	assert.deepEqual(comparePublished(web, publishedTokens(tokens({ extra: [{ name: "gone", value: "#000000" }] }))), [
		'tokens.json has "gone", which styles.css does not define.',
	]);
});

test("amber text and accent-named focus styles are rejected on Web; graphics may stay amber", () => {
	const flagged = (line) => checkClasses(line, CLASS_RULES.web).length > 0;
	assert.equal(flagged('<a className="font-medium text-(--accent) text-sm hover:underline">'), true);
	assert.equal(flagged('<a className="hover:text-(--accent)">'), true);
	assert.equal(flagged('<a className="text-accent hover:underline">'), true);
	assert.equal(flagged('<input className="focus-visible:ring-(--accent) focus-visible:ring-2">'), true);
	assert.equal(flagged('<input className="focus:border-(--accent)">'), true);

	assert.equal(flagged('<a className="font-medium text-(--accent-text) text-sm">'), false);
	assert.equal(flagged('<Loader2 className="size-8 animate-spin text-(--accent)" />'), false);
	assert.equal(flagged('<Star className="size-4 fill-accent text-accent" />'), false);
	assert.equal(flagged('<span className="bg-(--accent) text-(--accent-foreground)">'), false);
	assert.equal(flagged('<input className="focus-visible:ring-(--ring)">'), false);
});

test("amber text classes are rejected on Mobile", () => {
	const flagged = (line) => checkClasses(line, CLASS_RULES.mobile).length > 0;
	assert.equal(flagged('<Text className="font-medium text-primary text-sm">'), true);
	assert.equal(flagged('<Text className="text-accent underline">'), true);
	assert.equal(flagged('<Text className="text-accent-text">'), false);
	assert.equal(flagged('<Text className="text-primary-foreground">'), false);
	assert.equal(flagged('<Text className="text-accent-foreground text-xs">'), false);
});

test("a problem reports its line", () => {
	assert.deepEqual(checkClasses('const a = 1;\n<a className="hover:text-(--accent)">', CLASS_RULES.web), [
		{ line: 2, message: "amber text is under 2:1 in the light theme; use text-(--accent-text)" },
	]);
});

test("the repository passes its own design system check", () => {
	assert.deepEqual(checkRepository(fileURLToPath(new URL("..", import.meta.url))), []);
});
