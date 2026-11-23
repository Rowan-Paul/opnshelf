// Builds the two generated files of the Opnshelf design system from the Web
// App: components/bundle.js and components/bundle.css. Everything else the
// design system publishes is committed under design/system/project.
//
//   pnpm design:build
//
// See docs/design-system.md for how the result is published.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const generated = path.join(here, ".generated");
const project = path.resolve(here, "../../../design/system/project");

/** The cards the design system page lists, in order. Each needs a folder under design/system/project/components. */
const COMPONENTS = [
	"Button",
	"Switch",
	"Tooltip",
	"Dialog",
	"DropdownMenu",
	"Select",
	"Popover",
	"MediaCard",
	"StarRating",
	"WatchCountBadge",
	"ContentState",
];

function fail(message) {
	console.error(`design:build: ${message}`);
	process.exit(1);
}

/**
 * The design system page declares every token itself, from tokens.json, and
 * switches theme with a `data-theme` attribute. So the stylesheet it loads is
 * the Web App's with the token values and the font faces taken out and the
 * dark variant keyed on that attribute. A token left in would silently win
 * over the page's value.
 */
function deriveStyles(source) {
	const tokensStart = source.indexOf("\n:root {");
	const tokensEnd = source.indexOf("/* ====", tokensStart);
	if (tokensStart < 0 || tokensEnd < 0) fail("could not find the :root and .dark token blocks in styles.css");
	const darkVariant = "@custom-variant dark (&:is(.dark *));";
	if (!source.includes(darkVariant)) fail("styles.css no longer declares the dark variant this build rewrites");
	const derived = `${source.slice(0, tokensStart)}\n/* Token values live in tokens.css, generated from tokens.json. */\n\n${source.slice(tokensEnd)}`
		.replace("@import './assets/fonts/timeless-sans.css';\n", "")
		.replace(darkVariant, '@custom-variant dark (&:is([data-theme="dark"] *));\n@source "../../src";')
		.replaceAll(".dark .", '[data-theme="dark"] .');
	const leftover = derived.replace("@custom-variant dark", "").match(/:root|\.dark\b|timeless-sans\.css/);
	if (leftover) fail(`the derived stylesheet still contains "${leftover[0]}"; update deriveStyles for the new styles.css`);
	return derived;
}

mkdirSync(generated, { recursive: true });
writeFileSync(path.join(generated, "styles.css"), deriveStyles(readFileSync(path.resolve(here, "../src/styles.css"), "utf8")));
writeFileSync(path.join(generated, "entry.js"), 'import "./styles.css";\nexport * from "../entry.tsx";\n');

await build({ configFile: path.join(here, "vite.config.mjs") });

const script = readFileSync(path.join(generated, "out/bundle.js"), "utf8");
const styles = `${readFileSync(path.join(generated, "out/bundle.css"), "utf8")}${readFileSync(path.join(here, "extras.css"), "utf8")}`;
// The page inlines both files, so a closing tag inside one would end its element early.
if (/<\/script|<!--/i.test(script)) fail("bundle.js contains </script or <!--, which the design system page cannot inline");
if (/<\/style/i.test(styles)) fail("bundle.css contains </style, which the design system page cannot inline");

const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: "Opnshelf", components: COMPONENTS.map((name) => ({ name })) })} */\n`;
mkdirSync(path.join(project, "components"), { recursive: true });
writeFileSync(path.join(project, "components/bundle.js"), header + script);
writeFileSync(
	path.join(project, "components/bundle.css"),
	`/* Built from apps/web/src/styles.css by apps/web/design-system/build.mjs. Token values are removed: they live in tokens.css. */\n${styles}`,
);
console.log(`design:build: wrote bundle.js (${Math.round(script.length / 1024)} kB) and bundle.css (${Math.round(styles.length / 1024)} kB) to design/system/project/components`);
