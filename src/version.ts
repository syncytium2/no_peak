// Build stamp shown in the footer and on the About page.
// BORN is the date of the first commit and never changes; VERSION and BUILT
// are injected from package.json and the build clock (see vite.config.ts).

export const BORN = "2026-08-07";
export const VERSION = __APP_VERSION__;
export const BUILT = __BUILD_DATE__;

/** "7 August 2026" — long form for prose. */
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
