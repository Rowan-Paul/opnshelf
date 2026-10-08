import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRIVATE_SETTINGS_SCOPE } from "../auth/oauth-scopes";
import { describe, expect, it } from "vitest";
import {
	PRIVACY_CATEGORIES,
	privacyRepositoryConfig,
} from "./privacy-category";

describe("published Space declarations", () => {
	it.each(PRIVACY_CATEGORIES)(
		"matches the %s repository and OAuth collections",
		(category) => {
			const config = privacyRepositoryConfig(
				category,
				category === "lists" ? "list-key" : undefined,
			);
			const document = JSON.parse(
				readFileSync(
					resolve(__dirname, `../../../spaces/lexicons/${category}.json`),
					"utf8",
				),
			);
			expect(document.id).toBe(config.spaceType);
			expect(document.lexicon).toBe(1);
			expect(document.defs.main).toMatchObject({
				type: "space",
				key: category === "lists" ? "any" : "literal:self",
				collections: config.collections,
			});
			expect(document.defs.main.name.length).toBeGreaterThan(0);
		},
	);
	it("keeps a declaration for authorizing retired Settings cleanup", () => {
		const document = JSON.parse(
			readFileSync(
				resolve(__dirname, "../../../spaces/lexicons/settings.json"),
				"utf8",
			),
		);
		expect(document).toMatchObject({
			id: "xyz.opnshelf.settings",
			defs: {
				main: {
					type: "space",
					key: "literal:self",
					collections: new URLSearchParams(
						PRIVATE_SETTINGS_SCOPE.split("?")[1],
					).getAll("collection"),
				},
			},
		});
	});
});
