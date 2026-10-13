import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export function migrationManifest(source) {
	const directory = join(source, "migrations");
	const files = readdirSync(directory)
		.filter((name) => /^\d+.*\.sql$/.test(name))
		.sort();
	if (!files.length) throw new Error("No PDS migrations found");
	return Object.fromEntries(
		files.map((name) => [
			name,
			createHash("sha256")
				.update(readFileSync(join(directory, name)))
				.digest("hex"),
		]),
	);
}

export function assertCompatible(baseline, candidate) {
	if (
		!baseline ||
		typeof baseline !== "object" ||
		Array.isArray(baseline) ||
		!Object.keys(baseline).length
	) {
		throw new Error(
			"Baseline migration provenance is missing; establish the exact deployed source first",
		);
	}
	for (const [name, hash] of Object.entries(baseline)) {
		if (
			!/^\d+.*\.sql$/.test(name) ||
			typeof hash !== "string" ||
			!/^[a-f0-9]{64}$/.test(hash)
		)
			throw new Error("Invalid baseline migration manifest");
		if (candidate[name] !== hash)
			throw new Error(
				`Candidate removes or changes deployed migration ${name}`,
			);
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const [command, source, baselineImage, legacySource] =
			process.argv.slice(2);
		if (command !== "prepare" || !source || !baselineImage)
			throw new Error(
				"Usage: node scripts/pds-image-provenance.mjs prepare SOURCE BASELINE_IMAGE [LEGACY_BASELINE_SOURCE]",
			);
		const revision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim();
		if (
			execFileSync("git", ["-C", source, "status", "--porcelain"], {
				encoding: "utf8",
			}).trim()
		)
			throw new Error("Candidate source must be clean");
		const [image] = JSON.parse(
			execFileSync("docker", ["image", "inspect", baselineImage], {
				encoding: "utf8",
			}),
		);
		const digest = image.RepoDigests?.[0];
		if (!digest || !/@sha256:[a-f0-9]{64}$/.test(digest))
			throw new Error(
				"Baseline must be pulled from a registry and have an immutable digest",
			);
		const label = image.Config?.Labels?.["xyz.opnshelf.pds.migrations"];
		// Bootstrap only from the operator-specified exact source of an older image.
		if (
			legacySource &&
			execFileSync("git", ["-C", legacySource, "status", "--porcelain"], {
				encoding: "utf8",
			}).trim()
		)
			throw new Error("Legacy baseline source must be clean");
		const baseline = label
			? JSON.parse(label)
			: legacySource
				? migrationManifest(legacySource)
				: undefined;
		const candidate = migrationManifest(source);
		assertCompatible(baseline, candidate);
		writeFileSync("candidate-migrations.json", JSON.stringify(candidate));
		writeFileSync(
			"candidate-provenance.json",
			JSON.stringify(
				{
					revision,
					baselineDigest: digest,
					baselineRevision:
						image.Config?.Labels?.["org.opencontainers.image.revision"] ??
						(legacySource
							? execFileSync("git", ["-C", legacySource, "rev-parse", "HEAD"], {
									encoding: "utf8",
								}).trim()
							: null),
					migrations: candidate,
				},
				null,
				2,
			),
		);
		console.log(
			`Verified ${Object.keys(baseline).length} baseline migrations at ${digest}; candidate ${revision}`,
		);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
