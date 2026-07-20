import type { ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

type Hook<Props, Result> = (props: Props) => Result;

export function renderHook<Props, Result>(
	hook: Hook<Props, Result>,
	initialProps: Props,
) {
	let current: Result;
	let renderer: ReactTestRenderer;

	function TestComponent({ props }: { props: Props }): ReactNode {
		current = hook(props);
		return null;
	}

	act(() => {
		renderer = create(<TestComponent props={initialProps} />);
	});

	return {
		result: {
			get current(): Result {
				return current;
			},
		},
		rerender(props: Props) {
			act(() => {
				renderer.update(<TestComponent props={props} />);
			});
		},
		unmount() {
			act(() => {
				renderer.unmount();
			});
		},
	};
}
