import {
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
} from "@opnshelf/api";
import { expect, it } from "vitest";

it.each([
	["queued", true, false],
	["running", true, false],
	["waiting_retry", true, false],
	["completed", false, true],
	["failed", false, true],
	["continued_in_sync", false, true],
	["", false, false],
	["Running", false, false],
	["unknown", false, false],
])("classifies Trakt Import status %j", (status, active, terminal) => {
	expect(isActiveTraktImportStatus(status)).toBe(active);
	expect(isTerminalTraktImportStatus(status)).toBe(terminal);
	expect(isKnownTraktImportStatus(status)).toBe(active || terminal);
});
