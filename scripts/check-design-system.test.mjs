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
		'Mobile has no "primary" token (light). Web sets --primary to #f3bc00.',
	]);
});

test("a token removed from Web is reported while Mobile still has it", () => {
	const withoutRadius = webTokens(WEB.replace("  --radius-md: 10px;\n", ""));
	assert.deepEqual(compareClients(withoutRadius, mobileTokens(MOBILE)), [
		"Web has no --radius-md (light). Mobile sets it to 10px.",
		"Web has no --radius-md (dark). Mobile sets it to 10px.",
	]);
});

test("a declaration inside a nested rule does not stand in for the block's own", () => {
	const nested = WEB.replace("  --muted: #5e6d83;", "  --muted: red;\n  .child { --muted: #5e6d83; }\n  --after-nested: 1px;");
	const web = webTokens(nested);
	assert.equal(web.light.muted, "red");
	assert.equal(web.light["after-nested"], "1px");
	assert.deepEqual(compareClients(web, mobileTokens(MOBILE)).slice(0, 1), ["--muted differs in light: Web red, Mobile #5e6d83."]);
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
	assert.equal(flagged('<Clock className="size-4 text-(--accent)" />'), false);
	assert.equal(flagged('className="size-8 animate-spin text-(--accent)"'), false);
	assert.equal(flagged('<span className="bg-(--accent) text-(--accent-foreground)">'), false);
	assert.equal(flagged('<span className="bg-primary text-primary-foreground">'), false);
	assert.equal(flagged('<input className="focus-visible:ring-(--ring) focus:ring-ring">'), false);
});

test("a size class or a neighbouring icon does not make text a graphic", () => {
	const flagged = (line, file) => checkClasses(line, CLASS_RULES.web, file).length > 0;
	assert.equal(flagged('<span className="size-8 text-accent">8</span>'), true);
	assert.equal(flagged('<Star className="size-4" /> <span className="text-(--accent)">8.1</span>'), true);
	assert.equal(flagged('className={`${sizeClasses[size]} shrink-0 text-accent/30`}'), true);
	// The two files whose icon classes are built on their own line are named, not guessed.
	assert.equal(flagged('className={`${sizeClasses[size]} shrink-0 text-accent/30`}', "apps/web/src/components/StarRating.tsx"), false);
	assert.equal(flagged('<a className="hover:text-(--accent)">', "apps/web/src/components/StarRating.tsx"), true);
});

test("the accent's alias and plain spellings are the same colour", () => {
	const flagged = (line) => checkClasses(line, CLASS_RULES.web).length > 0;
	assert.equal(flagged('<a className="text-primary underline">'), true);
	assert.equal(flagged('<a className="text-(--primary)">'), true);
	assert.equal(flagged('<a className="text-accent/60">'), true);
	assert.equal(flagged('<a className="hover:text-primary">'), true);
	assert.equal(flagged('<input className="focus:ring-accent">'), true);
	assert.equal(flagged('<a className="focus-visible:outline-(--primary)">'), true);
	assert.equal(flagged('<input className="focus-within:border-primary/50">'), true);
});

test("amber text classes are rejected on Mobile", () => {
	const flagged = (line) => checkClasses(line, CLASS_RULES.mobile).length > 0;
	assert.equal(flagged('<Text className="font-medium text-primary text-sm">'), true);
	assert.equal(flagged('<Text className="text-accent underline">'), true);
	assert.equal(flagged('<Text className="text-accent/80">'), true);
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
