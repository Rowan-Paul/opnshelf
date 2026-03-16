import { Redirect, useLocalSearchParams } from "expo-router";

export default function PublicUserIndexScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();

	return (
		<Redirect
			href={{
				pathname: "/user/[handle]/shelf",
				params: { handle: handle ?? "" },
			}}
		/>
	);
}
