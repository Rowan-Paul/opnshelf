import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { describe, expect, it } from "vitest";
import {
	getActiveFormatting,
	isMarkActive,
	isNodeActive,
} from "./MarkdownEditor";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { content: "inline*", group: "block" },
		heading: {
			attrs: { level: { default: 1 } },
			content: "inline*",
			group: "block",
		},
		blockquote: { content: "block+", group: "block" },
		code_block: { content: "text*", group: "block", marks: "" },
		bullet_list: { content: "list_item+", group: "block" },
		ordered_list: { content: "list_item+", group: "block" },
		list_item: { content: "paragraph block*" },
		text: { group: "inline" },
	},
	marks: {
		strong: {},
		emphasis: {},
		inlineCode: {},
		link: {},
	},
});

const strong = schema.marks.strong;
if (!strong) throw new Error("Strong mark is missing from the test schema");

const doc = schema.node("doc", null, [
	schema.node("paragraph", null, [
		schema.text("bold", [strong.create()]),
		schema.text(" plain"),
	]),
]);

function stateAt(position: number) {
	return EditorState.create({
		schema,
		doc,
		selection: TextSelection.create(doc, position),
	});
}

describe("isMarkActive", () => {
	it("detects a mark at a collapsed cursor", () => {
		expect(isMarkActive(stateAt(2), "strong")).toBe(true);
		expect(isMarkActive(stateAt(7), "strong")).toBe(false);
	});

	it("detects a mark across a selected range", () => {
		const state = EditorState.create({
			schema,
			doc,
			selection: TextSelection.create(doc, 1, 5),
		});

		expect(isMarkActive(state, "strong")).toBe(true);
	});

	it("uses stored marks for the next typed character", () => {
		const state = stateAt(7);
		const withStoredStrong = state.apply(
			state.tr.setStoredMarks([strong.create()]),
		);

		expect(isMarkActive(withStoredStrong, "strong")).toBe(true);
	});
});

describe("isNodeActive", () => {
	it("distinguishes heading levels", () => {
		const headingDoc = schema.node("doc", null, [
			schema.node("heading", { level: 2 }, [schema.text("Heading")]),
		]);
		const state = EditorState.create({
			schema,
			doc: headingDoc,
			selection: TextSelection.create(headingDoc, 2),
		});

		expect(isNodeActive(state, "heading", { level: 2 })).toBe(true);
		expect(isNodeActive(state, "heading", { level: 3 })).toBe(false);
	});

	it.each([
		["bullet_list", "bulletList", 3],
		["ordered_list", "orderedList", 3],
		["blockquote", "quote", 2],
		["code_block", "codeBlock", 1],
	] as const)("detects an active %s ancestor", (nodeName, key, position) => {
		const content =
			nodeName === "bullet_list" || nodeName === "ordered_list"
				? [
						schema.node("list_item", null, [
							schema.node("paragraph", null, [schema.text("Item")]),
						]),
					]
				: nodeName === "blockquote"
					? [schema.node("paragraph", null, [schema.text("Quote")])]
					: [schema.text("Code")];
		const activeDoc = schema.node("doc", null, [
			schema.node(nodeName, null, content),
		]);
		const state = EditorState.create({
			schema,
			doc: activeDoc,
			selection: TextSelection.create(activeDoc, position),
		});

		expect(getActiveFormatting(state)[key]).toBe(true);
	});
});

describe("getActiveFormatting", () => {
	it("reports every active inline mark", () => {
		const marks = ["strong", "emphasis", "inlineCode", "link"].map((name) => {
			const mark = schema.marks[name];
			if (!mark) throw new Error(`${name} is missing from the test schema`);
			return mark.create();
		});
		const markedDoc = schema.node("doc", null, [
			schema.node("paragraph", null, [schema.text("Formatted", marks)]),
		]);
		const state = EditorState.create({
			schema,
			doc: markedDoc,
			selection: TextSelection.create(markedDoc, 2),
		});

		expect(getActiveFormatting(state)).toMatchObject({
			bold: true,
			italic: true,
			inlineCode: true,
			link: true,
		});
	});
});
