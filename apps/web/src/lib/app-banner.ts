import { platformFromUserAgent } from "./platform";
import { DISMISSED_KEY } from "./prompt-state";

/**
 * Decides before first paint whether this browser gets the Mobile App Banner.
 *
 * The banner used to be inserted after hydration, once `localStorage` could say
 * whether it had been dismissed, and on every phone it pushed the page down.
 * The HTML cannot carry the decision instead: media pages are shared through
 * the edge cache, so it has to be the same for every device. This inline
 * script runs in <head> before the body is parsed, marks <html>, and CSS in
 * styles.css hides the banner, or the other platform's link, from there.
 *
 * `platformFromUserAgent` is inlined from its source, so the rules the rest of
 * the app uses and the ones this script uses cannot drift apart.
 */
export const APP_BANNER_SCRIPT = `(()=>{try{const p=(${platformFromUserAgent.toString()})(navigator.userAgent);let d=false;try{d=localStorage.getItem(${JSON.stringify(DISMISSED_KEY)})==="1"}catch(e){}const h=document.documentElement;h.setAttribute("data-app-os",p.os==="ios"?"ios":"android");if(!p.isMobile||p.isIosSafari||d)h.setAttribute("data-app-banner","hidden")}catch(e){}})()`;

/** Hides the banner at once after a dismissal, without waiting for a reload. */
export function hideAppBanner(): void {
	document.documentElement.setAttribute("data-app-banner", "hidden");
}
