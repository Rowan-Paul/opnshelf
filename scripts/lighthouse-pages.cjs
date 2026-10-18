// Separate sibling hosts preserve production's host-only API cookie boundary.
const webOrigin = "http://web.opnshelf.localhost:3390";
const apiOrigin = "http://api.opnshelf.localhost:3391";
const pages = [
	{
		name: "Home",
		path: "/",
		text: [
			"Welcome back, Local scenario",
			"Fixture film 1",
			"Local fixture show 1",
			"Upcoming",
		],
		api: ["/social/feed"],
	},
	{
		name: "Shelf",
		path: "/profile/synthetic.test/shelf?page=1&type=all&sort=newest",
		text: ["Fixture film 1", "Fixture film 12"],
		api: ["/users/did:plc:bbbbbbbbbbbbbbbbbbbbbbbb/shelf"],
	},
	{
		name: "Up Next",
		path: "/profile/synthetic.test/up-next?page=1",
		text: ["Local fixture show 1", "The next chapter 1"],
		api: ["/shows/user/"],
	},
	{
		name: "Search",
		path: "/search?q=fixture&page=1",
		text: ["Fixture film 1", "Local fixture show 1"],
		api: ["/search/all"],
	},
	{
		name: "Show",
		path: "/shows/1399/local-fixture-show",
		text: ["Local fixture show", "Continue S1E6"],
		api: ["/shows/progress"],
	},
];
function checkContent(content) {
	const page = pages.find((page) => webOrigin + page.path === content.url);
	const missing = page?.text.filter((text) => !content.text.includes(text)) ?? [
		"Expected route",
	];
	if (!content.ownProfile) missing.push("Signed-in profile link");
	return {
		score: missing.length ? 0 : 1,
		explanation: missing.length ? `Missing: ${missing.join(", ")}` : undefined,
	};
}
module.exports = { webOrigin, apiOrigin, pages, checkContent };
