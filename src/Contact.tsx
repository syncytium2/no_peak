// Contact form, plus the fallback mailto link.
//
// Submissions go to Web3Forms, which relays them to the address registered
// with the access key — so the address itself never appears on the page or in
// the bundle. Until a key is configured the form is replaced by the
// runtime-assembled mailto link, so the site is never left with a dead form.
//
// To enable: get a free key at https://web3forms.com (enter your email, they
// mail you a key — no account needed) and paste it below.

import { useState } from "react";

export const WEB3FORMS_KEY = ""; // <-- paste the access key here

const USER = ["to", "ny"].join("");
const HOST = ["tonydefazio", "com"].join(".");

export const contactAddress = () => `${USER}@${HOST}`;

/** Runtime-assembled mailto, so the literal address is not in the bundle. */
export function MailLink() {
  const addr = contactAddress();
  return <a href={`mailto:${addr}`}>{addr}</a>;
}

type State = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  if (!WEB3FORMS_KEY) {
    return (
      <p>
        Email <MailLink />. (A contact form is wired up here but needs an access key — see{" "}
        <code>src/Contact.tsx</code>.)
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.botcheck) return; // honeypot: bots fill hidden fields, people don't
    setState({ kind: "sending" });
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: "no_peak contact form",
          from_name: "no_peak",
          ...data,
        }),
      });
      const body = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !body.success) throw new Error(body.message || `HTTP ${res.status}`);
      setState({ kind: "sent" });
      form.reset();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <p className="note">
        Thanks — message sent. If it needs a reply you&apos;ll get one at the address you gave.
      </p>
    );
  }

  return (
    <form className="contact" onSubmit={onSubmit}>
      <label>
        Your email
        <input type="email" name="email" required placeholder="you@lab.edu" />
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Bug report, dataset request, a citation that needs fixing…"
        />
      </label>
      {/* honeypot — hidden from people, irresistible to bots */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        style={{ display: "none" }}
      />
      <div className="contactfoot">
        <button className="primary" type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Send message"}
        </button>
        <span className="cite">
          This form is the one thing on the site that leaves your browser, and it sends only what
          you type here — never your data files.
        </span>
      </div>
      {state.kind === "error" && (
        <p className="error">
          Could not send ({state.message}). Please email <MailLink /> instead.
        </p>
      )}
    </form>
  );
}
