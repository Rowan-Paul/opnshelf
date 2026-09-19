import { Transform } from "class-transformer";

/**
 * A repeated query parameter (`?mediaIds=550&mediaIds=680`) arrives as an
 * array, but a single occurrence (`?mediaIds=550`) arrives as a bare string.
 * A batch read takes a list either way, so widen the one-value case before
 * validation sees it and rejects a perfectly good request.
 */
export function IsQueryArray(): PropertyDecorator {
	return Transform(({ value }) =>
		value === undefined || Array.isArray(value) ? value : [value],
	);
}
