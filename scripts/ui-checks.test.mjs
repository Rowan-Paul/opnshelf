import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	comparePairs,
	expectedTrigger,
	screenshotName,
	topRightFailure,
} from "./ui-checks.mjs";

const trigger = { top: 14, right: 400, bottom: 50, left: 364 };

test("the unread indicator moves from the menu button to the avatar at 768 px", () => {
	assert.equal(expectedTrigger(390), "Open menu");
	assert.equal(expectedTrigger(767), "Open menu");
	assert.equal(expectedTrigger(768), "User menu");
});

test("an indicator in the trigger's top-right corner passes within tolerance", () => {
	assert.equal(topRightFailure({ top: 14, right: 400, bottom: 22, left: 392 }, trigger), null);
	assert.equal(topRightFailure({ top: 16, right: 398, bottom: 24, left: 390 }, trigger), null);
});

test("a low or centred indicator fails the corner check", () => {
	assert.match(topRightFailure({ top: 24, right: 400, bottom: 32, left: 392 }, trigger), /10\.0 px below/);
	assert.match(topRightFailure({ top: 14, right: 386, bottom: 22, left: 378 }, trigger), /14\.0 px left/);
});

function png(width, height) {
	const buffer = Buffer.alloc(24);
	Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(buffer);
	buffer.writeUInt32BE(width, 16);
	buffer.writeUInt32BE(height, 20);
	return buffer;
}

test("screenshots are named scenario-viewport-label and paired by viewport size", () => {
	assert.equal(screenshotName("issue-fixes", "tablet", "before"), "issue-fixes-tablet-before.png");
	assert.throws(() => screenshotName("issue-fixes", "tablet", "old"));
	assert.throws(() => screenshotName("issue-fixes", "watch", "after"));
	const directory = mkdtempSync(join(tmpdir(), "ui-checks-"));
	writeFileSync(join(directory, "s-phone-before.png"), png(390, 844));
	writeFileSync(join(directory, "s-phone-after.png"), png(390, 844));
	writeFileSync(join(directory, "s-tablet-before.png"), png(700, 1024));
	writeFileSync(join(directory, "s-tablet-after.png"), png(1280, 800));
	writeFileSync(join(directory, "s-desktop-after.png"), png(1280, 800));
	const pairs = Object.fromEntries(comparePairs(directory).map((p) => [p.name, p.matches]));
	assert.deepEqual(pairs, { "s-phone": true, "s-tablet": false });
});
