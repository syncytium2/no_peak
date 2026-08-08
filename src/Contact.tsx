// The contact address, assembled at runtime so the literal string never
// appears in the shipped bundle. Cloudflare's Scrape Shield email obfuscation
// only rewrites HTML, and this app's markup is built by JS — so the address
// would otherwise sit in plain text inside index-*.js for any harvester that
// bothers to fetch it. Clicking and copying still work normally.

const USER = ["to", "ny"].join("");
const HOST = ["tonydefazio", "com"].join(".");

export const contactAddress = () => `${USER}@${HOST}`;

export function MailLink() {
  const addr = contactAddress();
  return <a href={`mailto:${addr}`}>{addr}</a>;
}
