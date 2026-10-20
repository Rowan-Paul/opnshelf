import {
	createElement,
	forwardRef,
	type PropsWithChildren,
	useImperativeHandle,
} from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NativeTabAvatar } from "./native-tab-avatar";

const state = vi.hoisted(() => ({
	exports: [] as ((data: string) => void)[],
	frames: [] as FrameRequestCallback[],
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({ View: host("View") }));
vi.mock("react-native-svg", () => ({
	default: forwardRef(function Svg({ children }: PropsWithChildren, ref) {
		useImperativeHandle(
			ref,
			() => ({
				toDataURL: (callback: (data: string) => void) =>
					state.exports.push(callback),
			}),
			[],
		);
		return createElement("Svg", {}, children);
	}),
	Circle: host("Circle"),
	ClipPath: host("ClipPath"),
	Defs: host("Defs"),
	Image: host("image"),
	Path: host("path"),
}));
let view: ReactTestRenderer;
beforeEach(() => {
	state.exports = [];
	state.frames = [];
	vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
		state.frames.push(cb);
		return state.frames.length;
	});
	vi.stubGlobal(
		"cancelAnimationFrame",
		vi.fn((id: number) => {
			delete state.frames[id - 1];
		}),
	);
});
afterEach(() => {
	act(() => view?.unmount());
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
const flushFrame = () =>
	act(() =>
		state.frames.splice(0).forEach((cb) => {
			cb(0);
		}),
	);

it("exports bounded sources only after both image variants have loaded", () => {
	vi.stubEnv("EXPO_OS", "ios");
	const onReady = vi.fn();
	act(() => {
		view = create(
			<NativeTabAvatar
				uri="https://example.test/avatar.png"
				color="gold"
				onReady={onReady}
			/>,
		);
	});
	expect(
		view.root.findAll(
			(node) => typeof node.type === "string" && node.type === "path",
		),
	).toHaveLength(2);
	expect(state.frames).toHaveLength(0);
	const images = view.root.findAll(
		(node) => typeof node.type === "string" && node.type === "image",
	);
	act(() => images[0].props.onLoad());
	expect(state.frames).toHaveLength(0);
	act(() => images[1].props.onLoad());
	flushFrame();
	act(() => state.exports.shift()?.("normal"));
	act(() => state.exports.shift()?.("selected"));
	expect(onReady).toHaveBeenCalledWith({
		default: {
			uri: "data:image/png;base64,normal",
			width: 28,
			height: 28,
			scale: 3,
		},
		selected: {
			uri: "data:image/png;base64,selected",
			width: 28,
			height: 28,
			scale: 3,
		},
	});
});

it.each([
	"ios",
	"android",
])("keeps the fallback and ignores exports after unmount on %s", (platform) => {
	vi.stubEnv("EXPO_OS", platform);
	const onReady = vi.fn();
	act(() => {
		view = create(
			<NativeTabAvatar uri={null} color="gold" onReady={onReady} />,
		);
	});
	flushFrame();
	act(() => state.exports.shift()?.("normal"));
	expect(
		view.root.findAll(
			(node) => typeof node.type === "string" && node.type === "path",
		),
	).toHaveLength(2);
	const finish = state.exports.shift();
	act(() => view.unmount());
	act(() => finish?.("old-avatar"));
	expect(onReady).not.toHaveBeenCalled();
});

it("exports a cached avatar even when Android sends no image load events", () => {
	vi.stubEnv("EXPO_OS", "android");
	const onReady = vi.fn();
	act(() => {
		view = create(
			<NativeTabAvatar
				uri="https://example.test/cached-avatar.png"
				color="gold"
				onReady={onReady}
			/>,
		);
	});
	flushFrame();
	expect(
		view.root.findAll(
			(node) => typeof node.type === "string" && node.type === "path",
		),
	).toHaveLength(0);
	expect(state.exports).toHaveLength(1);
	act(() => state.exports.shift()?.("cached-normal"));
	act(() => state.exports.shift()?.("cached-selected"));
	expect(onReady).toHaveBeenCalledWith({
		default: expect.objectContaining({
			uri: "data:image/png;base64,cached-normal",
		}),
		selected: expect.objectContaining({
			uri: "data:image/png;base64,cached-selected",
		}),
	});
});
