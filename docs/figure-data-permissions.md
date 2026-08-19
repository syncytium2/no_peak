# Digitizing data from a published figure: where the permissions question lands

> **Status, 2026-08-19, third and current — DONE. The committed values now come
> from the print scan.** All eight series were re-read from the U-M library's
> Document Delivery scan of the bound volume and the PDF-derived values were
> retired, not kept alongside. That content was obtained outside the
> subscription, so the terms the library signed do not reach it, and what
> governs is copyright alone, which does not protect facts. **Nothing published
> by this project now derives from the licensed copy.**
>
> The extractor is `tools/digitize_webster_print.py`.
> `tools/digitize_webster1991.py`, which reads the licensed PDF, is superseded
> and now **refuses to write**. See "The re-extraction, and what it changed"
> below for what moved in the numbers.
>
> ⚠ **The site still serves the old values until it is redeployed.** The repo
> and the bundle are updated; `dist/` deliberately still matches what is live.
>
> **Superseded, 2026-08-19, first — "counsel answered, and it goes against the
> reading this file was built on."** Half right for about three hours. The
> answer on the license stands; the answer on the delivery notice was retracted
> the same afternoon, by the person who gave it, once he saw the notice itself.
>
> **Superseded, 2026-08-14 — "a route exists that needs nobody's permission."**
> Restored, in substance: the print copy is the way out, the Document Delivery
> scan carries that provenance, and the notice on it is a disclaimer rather than
> a restriction. What the 08-14 line got wrong is only that it needed no
> checking.
>
> **2026-08-13 — the author route closed, and it closed correctly.**
> This document's recommendation was "ask the authors." That was done, and the
> answer was that **it is not an author's question to answer**: permission
> belongs to the copyright holder. No objection was raised to the data being
> used or published — the author simply declined to be the grantor, and
> suggested generating test data by hand instead, which is what
> [`data/synthetic/`](../data/synthetic/README.md) already does.
>
> **A banner on this file previously read "Resolved, 2026-08-11. One of the
> paper's authors gave permission."** That claim named no author and had no
> artifact behind it; `next-steps.md` §1 had flagged it as unverifiable, and it
> has now been withdrawn from every file that carried it — eight CSV headers,
> `src/samples.ts` and therefore every exported figure, PDF and results CSV,
> `tools/digitize_webster1991.py`, and four public pages. **Do not reinstate
> it.**
>
> The eight traces remain in [`data/digitized/`](../data/digitized/README.md).
> They now rest on the analysis below and nothing else, which is the honest
> position and, on this document's own reasoning, a sufficient one: copyright
> was never the obstacle, the practice is routine and precedented, and no
> publisher has ever been recorded objecting. The contractual question remains
> unresolved and untested — as it was on 2026-08-11, since an author's blessing
> never addressed it.
>
> **2026-08-14: there is a way out that needs no one's permission.** The U-M
> Copyright Librarian read the license and found that its constraints bind the
> *electronic* copy only — read the numbers off the library's print volume and
> no contract applies at all, leaving only copyright, which does not protect
> facts. The rule is sharper still: the test is whether the content was obtained
> **outside the subscription**, not whether it is paper. See "The print copy is
> the way out" in the ledger below. **The scan arrived 2026-08-17 and it passes
> the provenance test** — see "The scan arrived, and what it does and does not
> settle" below. ~~University counsel (Jack Bernard) is checking whether even
> that was necessary.~~ **He answered on 2026-08-19: it was necessary. It is
> also sufficient** — a first reading said otherwise and was retracted the same
> day.
>
> Requests are tracked in the ledger. **The ledger is the next section — update
> it there, not here.**
>
> One lesson worth keeping, because it cost a fortnight: the recommendation
> below said author blessing "addresses the relational risk," and that was
> right — but a blessing that is never written down addresses nothing, because
> it cannot be produced later. Get the artifact at the time or do not make the
> claim.

## The request ledger

Every ask, dated, with what came back. **This is the file's live state; keep it
current and put outcomes here rather than in prose elsewhere.** The point of the
ledger is that the last round of this produced a claim with no artifact behind
it, and the fix for that is not "remember better" — it is writing down each
request when it is made rather than after it is answered.

| # | Date | Asked | For | Outcome |
|---|---|---|---|---|
| 1 | 2026-08-11 | An author of the paper | Blessing to digitize the figures | Given informally. **No artifact kept**, so unverifiable; the claim built on it was withdrawn 2026-08-13. |
| 2 | 2026-08-13 | An author of the paper | Permission on the record, and the underlying values | **Declined to be the grantor** — correctly: it is the copyright holder's question. No objection to the use. Did not offer raw data. Suggested generating test data by hand instead. |
| 3 | 2026-08-13 | OUP, `journals.permissions@oup.com` | Permission, or a statement that none is needed | Automated reply routing to RightsLink. **Resubmitted in-thread the same day** invoking their own human-review clause. Their stated turnaround is 10 working days. **OPEN.** |
| 4 | 2026-08-13 | U-M library, `library.collections@umich.edu` | Whether the institutional license already permits publishing values derived this way | **Answered 2026-08-14** by the Copyright Librarian, who read the agreement. It governs TDM, and the closest clause bars Authorized Users from distributing "any part of the Publications on any electronic network … other than the Secure Network". **But the constraint is contractual and reaches only content obtained through the subscription** — see below. Referred to University counsel (Jack Bernard), who **answered 2026-08-19 that the clause does reach derived values**. **CLOSED, against us.** |
| 5 | 2026-08-14 | Same, four numbered questions | Provenance of a library scan; whether the earlier PDF extraction contaminates it; whether the license reaches a derived table of facts; whether Document Delivery's fair-use notice bears on publishing | **Two answered the same day**, two on **2026-08-19** via counsel. (2) A library-made scan carries the clean provenance — handling the paper is irrelevant, obtaining it outside the subscription is the whole test. (1) "Any part of the Publications" **does** reach a derived table of values. (3) The earlier extraction **does** matter, correcting the 08-14 answer, but what you *use* is the operative test. (4) OUP would likely read the delivery notice as covering extracted content. **CLOSED.** See "Counsel answered" below. |
| 6 | 2026-08-14 | U-M Document Delivery | Scan of the bound volume, p. 1639 | **Delivered 2026-08-17, and it is the print volume.** Verified against the four tests this file set: no OUP download watermark, physical-scan artifacts throughout, ~490 dpi effective (400 was asked), and the whole article rather than the one page requested. **CLOSED.** See the next-but-one section. |
| 7 | 2026-08-19 | University counsel, via the Copyright Librarian | Answers to questions 1 and 4 of request 5 | **Answered.** Derived values are "any part of the Publications"; ~~the delivery notice would likely be read as reaching extracted content~~ **— that second half was retracted the same day, see row 8.** **CLOSED.** |
| 8 | 2026-08-19 | Same, sending him the delivery notice itself | Whether Q4 had been read as asked — does the notice restrict use, or disclaim responsibility for it? | **Answered within the hour, and it reverses Q4.** He had taken the question to be about OUP's language rather than the library's own notice. The notice states the purpose the copy was made for and then says "It is your responsibility to address copyright for any other uses" — a **disclaimer, not a restriction**. His full answer to Q2 therefore applies to the scan in hand: obtained outside the subscription, so the license does not reach it. **CLOSED, and it opens the route.** A thank-you is owed. |

**The correspondence itself is not committed** — it is third-party email, it
names real people, and it does not belong in a public repository. It is kept
outside the repo, in the darkroom folder:

    <Dropbox>/Richard DeFazio/darkroom/no_peak/2026-08-13_permissions-correspondence/

That folder holds every draft sent, plus `REPLIES-RECEIVED.txt` with every
reply transcribed and its operative text quoted verbatim. Hold the split:
**this ledger records that something was said, dated, with the outcome; that
folder holds the saying of it.** Neither substitutes for the other, and the
reason both exist is row 1 — a permission that was real, was never written down,
and could not be produced when it was needed.

⚠ **That folder sits on the same determination as `reference/`** — that the
Dropbox member folder is private, confirmed by the owner on 2026-08-14 (see
`AGENTS.md`, "The store, and the one rule attached to it"). The rule there names
`reference/` as first out if the folder is ever shared or re-pointed. **Third-
party email quoting named people belongs in that same review and the rule does
not mention it**, so the folder's own README says so. Anyone applying the rule
will be looking at `reference/` and would not think of a darkroom subfolder.

### ⭐ Counsel answered, and it goes the other way

⚠ **Answer 4 below was retracted the same afternoon, and with it the conclusion
that the Document Delivery scan is encumbered. Read "Answer 4 was retracted"
immediately after this section before acting on anything here.** The rest of
this section stands: answer 1 is unchanged and still governs the values
currently committed.

**2026-08-19.** The two questions left with University counsel on 2026-08-14
came back through the Copyright Librarian, who spoke with Jack Bernard that
morning. Both answers are quoted verbatim in `REPLIES-RECEIVED.txt` entry 5 in
the darkroom folder. **This section is the record of what was said and what it
displaces. It is not a decision — see "What has to be decided" at the end of
it.**

| Q | What was asked | What came back |
|---|---|---|
| 1 | Does "any part of the Publications" reach a derived table of measured values? | **"Yes, the terms of the agreement prohibits use of derived information since this constitutes 'any part' of the Publication."** |
| 2 | Does a library scan of the print volume carry the print provenance? | Unchanged from 08-14: handling the paper is irrelevant, obtaining the content **outside the subscription** is the whole test. |
| 3 | Does the earlier extraction from the licensed PDF contaminate a later print-sourced version? | **"As a matter of fact it does matter that you extracted the text. However, whether or how you use the extracted text is of key importance."** If you do not *use* the licensed copy, the licensing terms do not reach you. |
| 4 | Does the scan's "private study, scholarship, or research" notice bear on publishing values derived from it? | **"OUP would likely interpret their language as applying to anything in the scan (including extracted content)."** |

**Answer 1 removes this document's load-bearing argument.** Thousands of words
below, and the reasoning in eight CSV headers, rest on the position that a table
of measured facts is not a part of the publication — that the clause governs the
reproduction and not the numbers taken from it. Counsel says derived information
*is* "any part." The argument was worth making and it lost. Do not run it again
without saying that it was put to counsel and rejected.

**And that reaches data already published, not just data not yet extracted.**
This is the part the 08-17 work did not have in view. The eight series in
[`data/digitized/`](../data/digitized/README.md) were read off the licensed PDF
by `tools/digitize_webster1991.py`. They are committed to a public GitHub
repository, compiled into `src/samples.ts`, and therefore in the bundle served
at <https://nopeak.tonydefazio.com> and in every figure, PDF and results CSV the
tool exports. On counsel's reading that is display or distribution of "any part
of the Publications" on a public electronic network other than the Secure
Network, which is the clause the Copyright Librarian quoted on 08-14. **The
exposure is present tense.** Everything before today treated this as a question
about whether to publish; it is now also a question about what is already
published.

**Answer 3 says the cure exists, and says what it costs.** It corrects 08-14 in
one direction and softens it in another: the earlier extraction does matter, but
the operative test is what you *use*. Values re-read from an unencumbered copy,
with the PDF-derived series **retired rather than kept alongside**, fall outside
the licensing terms. So a fix is available, and it is re-extraction *plus*
retirement — not re-extraction alone, which is what 08-14's "the earlier
extraction does not carry forward" was taken to mean.

~~**Answer 4 is the catch, and it lands on the scan that arrived Monday.**~~
**Retracted — see the next section.** What it said: the Document Delivery copy
carries U-M's "private study, scholarship, or research" notice, counsel expects
OUP to read that as covering extracted content, and the delivery scan is
therefore not the clean route this file took it for on 08-17.

Two things about answer 4 were worth keeping straight, because the difference
between them is the difference between a closed door and an open one. It is a
prediction of how the publisher would *interpret* language, not a statement that
the notice binds. And the notice's own wording disclaims the copyright analysis
that supported making the copy — "if you use the copy for a different purpose …
the copyright analysis that supported making the copy does not apply" — rather
than granting or withholding rights in facts read off it. **That distinction had
not been put to him, and it should be rather than being resolved here.** The
last time this project resolved a rights question by reasoning rather than
asking, the conclusion had to be withdrawn from nineteen files.

**It was put to him, and it was the whole thing.** Left in place above because
the reasoning is the part worth keeping: the answer came from noticing that a
sentence was about responsibility rather than permission, and asking, rather
than from deciding which reading to prefer.

~~**What nothing has been said against: the bound volume itself.**~~ **Moot as
of the retraction**, but recorded because it remains the fallback if the scan
proves unreadable for the panels that matter. A physical loan or recall of
*Endocrinology* v.129 1991 Sep from Offsite Shelving carries no subscription
license — answer 2 — and no delivery notice, because no Document Delivery
reproduction is involved. The Copyright Librarian offered physical delivery
unprompted on 2026-08-19, so the mechanism is available for the asking.

**Buying a copy is moot too, and it was never as easy as it sounded.** Checked
2026-08-19: AbeBooks has no listing for v.129, and Periodicals Service Company —
the dealer publishers refer people to for exactly this — closed on 2026-01-01.
Recorded so that "just buy the issue" is not re-proposed as the cheap option.
Buying the *article* from OUP was never a route at all: a pay-per-view copy
arrives under personal, non-commercial terms that prohibit redistribution, which
is a fresh license rather than an escape from one.

**What has to be decided, and by whom.** Two questions follow from this and both
are the owner's. Neither has been put to him, and **nothing has been retracted,
regenerated, unpublished or re-extracted on the strength of this reply**:

1. **The eight published series.** Leave them up, pull them pending a clean
   re-extraction, or something in between. The tool does not fall over without
   them — [`data/synthetic/`](../data/synthetic/README.md) already generates
   records to this paper's protocol, and the position stated to the library was
   that losing these costs a check, not a feature. But `data/digitized/` is
   wired into presets, tests, `/methods` and the exported artifacts, so
   "pull them" is a day of work and a visible change to the site, not a
   `git rm`. **Update 2026-08-19: that cost is now paid in advance.**
   `docs/digitized-suppression.md` carries a built, tested, unthrown switch —
   withdrawal is one commit and reversal is another. It changes nothing about
   the decision itself, which is still open; it removes the cost of executing it
   from the reasons for or against.
2. ~~**Whether to pursue the bound volume**, or to stop here and let the
   synthetic records carry the validation on their own.~~ **Overtaken by the
   retraction** — the scan already on disk is a sufficient source, so the
   question is now whether to spend the re-extraction, not how to obtain a copy.

A third item is smaller and not a decision: **a reply is owed to Jeremy York.**
He offered email or a video consultation. The question worth sending back is the
one in answer 4 — whether the delivery notice governs the reproduction or is
being read to govern facts derived from it, and whether a physical loan of the
bound volume avoids the question entirely. **Sent the same afternoon, and it is
what produced the retraction below.**

**What has not changed.** `tools/crosscheck_webster_print.py` remains an
instrument rather than a re-extraction; it writes nothing to `data/digitized/`,
and the cross-check result recorded below stands as a measurement of
digitization accuracy regardless of how the rights question resolves. ~~The
standing instruction "do not re-extract until counsel answers" is now spent —
counsel has answered — and is replaced by: **do not re-extract from the delivery
scan at all until item 2 above is decided**, because answer 4 says that scan is
not the clean source it was taken for.~~ **Lifted by the retraction. The
delivery scan is a clean source; re-extracting from it is now a question of
effort and the owner's go-ahead, not of rights.**

### ⭐ Answer 4 was retracted, and the route is open

**2026-08-19, 3:56 PM — three hours after the section above.** The owner sent
the Copyright Librarian the actual notice attached to the delivery scan and
asked whether question 4 had been read as written. It had not. Verbatim in
`REPLIES-RECEIVED.txt` entry 6; the operative part:

> "I didn't understand that you were talking about the language from the digital
> copy you received from the library … we note that we are providing the scan to
> you for private study, scholarship, or research purposes. However, we also say
> **'It is your responsibility to address copyright for any other uses.'** So it
> is fine to use the copy for other purposes, you just need to know that you are
> responsible for the decisions you make. In your situation, then, my full answer
> under #2 applies."

**The notice disclaims responsibility; it does not restrict use.** It states the
purpose the copy was made for, then puts the copyright analysis for any other
use on the requester. That is the reading the section above flagged as worth
asking about rather than settling in-house — and the notice is U-M's own
document, so the library's reading of it is the authoritative one, not a
prediction about what a publisher might argue.

**So answer 2 applies in full to the scan already on disk.** Values re-read off
the Document Delivery copy were obtained outside the subscription, the terms the
library signed do not reach them, and what governs is copyright alone — which
does not protect facts. That is the position this document reached on 2026-08-14
and has now been confirmed against the one document that was thought to
complicate it.

**The route, stated once, plainly:** re-extract the eight series from the
library scan, **retire the PDF-derived values rather than keep both** (answer 3
is untouched and that is what it requires), and publish. Nothing else is
outstanding on rights.

⚠ **What the retraction does NOT do is cure what is currently published.**
Answer 1 stands: derived values are "any part of the Publications" for content
obtained *through* the subscription, and the eight committed series came off the
licensed PDF. Today reopens the route to *replacing* them. It does not make them
retrospectively fine, and the replacement is not free — the re-extraction cost
is written down in "The scan arrived" below, and it is the real remaining
obstacle. **Until the replacement lands, the position on the committed data is
exactly what it was this morning.**

**Two smaller things worth keeping.** OUP has still never replied to request 3,
now well past its stated 10 working days; that request is no longer load-bearing
but it is also not withdrawn. And a thank-you is owed — he corrected himself
within the hour, unprompted, having already volunteered the Document Delivery
route before he understood the question.

### ⭐ The re-extraction, and what it changed

**2026-08-19, the same day.** All eight series re-read from the library scan by
`tools/digitize_webster_print.py --write`; the PDF-derived values retired. 218
tests pass. What follows is what moved, because a source change that moved
nothing would be the suspicious outcome.

**The axis calibration was wrong, and fixing it was most of the work.** The
08-17 instrument fit one tick lattice across the four panels of a hormone, on
the reasoning that they share one printed axis. They share a *design*, not a
size: **Figures 3 and 4 are printed at different reductions**, Fig. 4's boxes
about 2% taller than Fig. 3's on the same page. One shared period returned a
compromise between the two, and that was the whole of the "systematic ~2% scale
difference" this file recorded on 08-17 as an open question. It was never a
difference between the two scans; it was an error in the new reading.

The reading now takes each panel's size from its box height — two long straight
rules, good to about a pixel in 650 — and uses the labelled ticks only to fix
one shared number per hormone, the value at the box top. The minor ticks are not
used at all: they clear this scan's heavy axis by two or three pixels, and a
vote over them moved the two hormones in opposite directions. Zero stays where
the figure puts it, on the bottom frame rule.

**Agreement with the licensed-PDF reading, which is the last time these two can
ever be compared:** median 0.8% of each record's range, 0.18 printed line
widths, across the five records not at the figure's resolution limit. The 08-17
number was 1.5% and 0.26. **68 of the paper's 70 marked pulses fall at identical
sample indices**; two move by one sample.

**The fitted GnRH error floor moved from 0.06 to 0.07 pg/min.** It is the one
tuned constant in the project, it has always been labelled as fitted, and it was
re-fitted by re-running the sweep `docs/validation-status.md` already specifies —
the joint optimum of sensitivity and precision against the paper's own 70 marks.
On the new reading false positives go to zero at 0.07 and sensitivity no longer
falls off above it, so the old upper constraint is gone and 0.07 is the low edge
of the zero-false-positive plateau. **It was not nudged to make a record come
out at a particular count**, and the sweep is recorded in the tool so the claim
is checkable.

**The scoring improved slightly**: 68 of 70 with no false positives (97%
sensitivity, 100% precision) against 67 of 70 previously. It is now identical at
zero matching slack, where before the headline leaned a little on the one-sample
tolerance.

**Everything downstream carries the new provenance**: the eight CSV headers name
the library scan, the exported citation on every figure and results CSV says the
values were read from the print volume and not the publisher's PDF, and
`/methods`, the About page, `llms.txt` and the README say the same.

### ⭐ The print copy is the way out, and it was there the whole time

**Established 2026-08-14 by the U-M Copyright Librarian, and it held.** For one
afternoon on 2026-08-19 this section was thought to be half wrong — that a
library-made scan escaped the license but landed under the delivery notice. The
person who said so retracted it the same day: the notice is a disclaimer, not a
restriction. **Read this section as written.** Its central claim, that the test
is provenance rather than medium, was restated by counsel word for word and has
not been disturbed by anything since.

Every contractual objection in the long analysis below — the OUP legal notice,
the Endocrine Society site terms, the U-M license — is a term of a *license for
the electronic copy*. It binds because the PDF was obtained through the
subscription. **It does not attach to the paper on a library shelf.** In his
words: if the numbers are read off the library's print volume, "you would not be
subject to any contractual constraints. Your use would be governed purely by US
copyright law, which would allow your use since facts are not copyrightable."

**The operative test is how the content was obtained — not its medium, and not
who handled it.** Asked on 2026-08-14 whether a library-made scan counts when
you never touch the volume yourself, he was unambiguous: "it doesn't matter that
you didn't handle the paper. The main consideration would be that you obtained
the content **outside of the library's subscription** to the digital content, so
your uses would not be subject to the terms the library signed as part of that
subscription."

Print versus electronic was only ever a proxy for that. State the rule the sharp
way, because the proxy misleads in both directions: a library-made scan of the
bound volume passes even though it arrives as a PDF, and printing the licensed
PDF fails even though it produces paper. Same rule, both cases.

**Extraction is not a restricted act either.** Asked whether the existing
values, taken from the publisher's PDF, contaminate a later print-sourced
version, he said — hedged as not legal advice — that he "wouldn't think that the
earlier extraction would matter because I don't think the extraction itself
violates anything in the agreement." That follows from the clause he quoted: it
bars "display or **distribute**". Reading numbers off a figure is neither, so
the restricted act is the publishing, and the publishing is what a print-sourced
dataset changes.

That collapses this entire question. Sections below spend thousands of words
establishing that copyright is not the obstacle and that contract *might* be,
untested and unresolved. Re-extracting from print removes the untested half
rather than winning the argument — which is worth far more, because an argument
you do not have to make cannot be lost.

**What it would cost.** The eight committed series were extracted from the
licensed PDF: `tools/digitize_webster1991.py` runs `pdfimages` on it. Doing this
properly means scanning the bound volume — the tool wants 400 dpi line art, and
its page selection is hardcoded to the PDF's page 5, so it needs a flag — and
re-reading the traces from that scan. Two consequences to plan for rather than
discover:

- **The committed CSVs will change**, and the byte-identical regeneration
  guarantee this repo leans on dies with them. Regenerate, re-verify, and say so.
- **It buys a real check for free.** An independent second extraction of the
  same printed figures is the only test of digitization accuracy this project
  has ever had a way to run. Record the agreement between the PDF-derived and
  print-derived values as a quality number; if they agree within the line width,
  that is a result worth stating on `/methods`, and if they do not, something is
  wrong that nobody would otherwise have caught.

**⚠ Printing the licensed PDF and scanning the printout does NOT work.** It is
the obvious shortcut, it was proposed, and it fails: the constraint follows the
*provenance* of the copy, not its medium. The license attached when the PDF was
obtained through the subscription, and a printout of that PDF is still that
copy, on paper. The library's bound volume is unencumbered because it was
acquired by purchase under different terms — not because paper is special. A
step whose only function is to obscure where a file came from is also the
opposite of the position this document exists to establish, which is one that
can be stated out loud. Recorded here because it will occur to the next reader
too.

**The logistics have a real answer: don't do the scanning, order it.** The
library holds the bound volume — *Endocrinology* v.129 1991 Sep, Offsite
Shelving, call number Journals, barcode 39015023198461, on shelf — and its
catalog record offers **"Request to have a small portion scanned"**, 1–5 days.
Placing the request against that record means the scan is of *that object*,
which is what makes the result derive from the library's purchased copy rather
than from the subscription. Use that rather than a generic article request,
which is fulfilled from whatever is fastest and would return the licensed
electronic copy while looking like progress. It costs a web form rather than an
afternoon in the stacks.

Three things to get right on that request, all recorded with the filled form in
the darkroom folder: say explicitly in the notes that it must come from the
print volume and not the e-copy; ask for 400 dpi or better, because these are
line art read for pixel positions and a compressed 300 dpi scan is unusable; and
leave the OCR checkbox alone, since its label is an accessibility attestation
rather than a quality option.

Three of the service's own policies bear on this. The scan **stays on a secure
site for two weeks only**, so download it the day it arrives. Requests are
**individually evaluated for copyright compliance**, and a refusal is offered as
a physical loan instead — which answers the provenance question completely, so
the fallback is fine either way. And **microform scanning is limited**: the
holding is offsite, and a microform scan of line art read for pixel positions
would likely be unusable even if supplied. The record shows a barcoded volume
with a Journals call number, which reads as bound paper, but confirm from what
arrives.

**Then verify what arrives.** A scan of paper looks like paper — page edges,
slight skew, print grain, the gutter shadow of a bound volume. If the
publisher's clean typeset PDF turns up instead, something was fulfilled
electronically and the provenance is exactly where it started.

**Whether a library-made scan carries the print provenance is a question for the
Copyright Librarian, not an assumption.** It should, since it derives from the
purchased copy rather than the licensed one — but assuming is what went wrong
the first time. So is the request form's own copyright notice, which conditions
the reproduction on "private study, scholarship, or research": that governs the
reproduction rather than facts extracted from it, but it trades a license term
for a delivery term and **deserved an answer rather than a shrug. It got one on
2026-08-19, and the guess written here was right** — the notice puts
responsibility for other uses on the requester rather than forbidding them. The
answer took two passes to arrive at; see "Answer 4 was retracted" above.

~~**Order the scan now; do not re-extract until counsel answers** (expected week
of 2026-08-17).~~ **Both halves are spent. The scan arrived 2026-08-17; counsel
answered 2026-08-19.** The reasoning was sound and the bet paid the other way:
the derived-facts argument did *not* hold, so ordering the scan was right, and
the scan turned out to carry a condition of its own, so it did not finish the
job either. Current instruction is in "Counsel answered" above — **do not
re-extract from the delivery scan** until the owner decides.

**For the next paper, this is the rule:** if a figure needs digitizing and the
article is licensed rather than open, read it off print from the start. It costs
a walk to the stacks and removes the only genuinely unresolved risk in this
entire document.

### The scan arrived, and what it does and does not settle

**2026-08-17.** `<Dropbox>/Richard DeFazio/nopeak/webster scanned by document
delivery-UM library.pdf`, 10 pages, 1.8 MB. The section above said to verify
what arrives rather than assume. Here is that verification, run against the
licensed 2008 PDF sitting beside it in the same folder as a control.

**It is the print volume. Four independent signs, and they agree.**

1. **No OUP watermark.** The licensed copy carries "Downloaded from
   academic.oup.com/endo/article/129/3/1635/2535570 by University of Michigan
   Business School Library user on 11 August 2026" down the outer margin of all
   nine pages. The new scan has it on none. This is the single most decisive
   check and it is a one-liner: `pdftotext … | grep -c academic.oup.com`.
2. **It looks like paper**, which is what this file predicted. Black page-edge
   bars, per-page dimensions that vary by up to 4% (a fresh crop each sheet,
   against the licensed file's uniform ones), the left margin of the Fig. 3
   caption shaved by the gutter, and visibly heavier ink.
3. **The production chain is new.** Created 2026-08-17 11:53, PDF 1.7, no
   producer string. The licensed copy is ABBYY FineReader, created 2008, later
   rewritten by iTextSharp — a publisher's own retro-digitization, which is
   worth knowing: *both* files are scans of print, so "it is a scan" was never
   the test. Provenance was, exactly as the section above says.
4. **It carries the library's own cover page**, the copyright notice discussed
   below, which the licensed copy has no reason to carry.

**Resolution beat the request.** The ask was 400 dpi or better. Measuring the
one object whose printed size is fixed — the 0–6 h panel box on p. 1639 — it is
808 px in the licensed 400 dpi file and 992 px in the new scan, so about **490
dpi effective, 23% more pixels across the same trace**. Ignore what
`pdfimages -list` reports for this file (360 ppi); that is computed from how the
image is placed on the page and is wrong here. Measure a known object instead.

**They sent the whole article, not the single page requested** — pp. 1635–1643.
So Fig. 4 on p. 1639 and everything else is in hand, and no second request is
needed. Page 1640's photomicrographs even came through as 8-bit grayscale JPEG
2000 while the line-art pages stayed bitonal, which is the scanner doing the
right thing unasked.

**One real catch, and it will break the tool.** The scanner wrote p. 1639 as
**13 separate images** — an MRC segmentation: a base layer plus per-panel
sub-images plus masks — rather than one page bitmap. **The base layer has the
data traces stripped out of it**; they live in the sub-images. So:

- `tools/digitize_webster1991.py` runs `pdfimages -f 5 -l 5` and expects exactly
  one page image. Against this file that returns fragments, and the page index
  shifts by one anyway because of the cover page. **It will not fail loudly — it
  will find a page-shaped image with no traces on it.**
- The fix is `pdftoppm -r <dpi>` to composite the layers, or read the panel
  sub-images directly, which are clean per-column crops and arguably easier.
  Either way **the hardcoded panel geometry must be re-measured**; it was
  measured off the licensed scan and none of it transfers.
- Trace lines are relatively fatter: 0.71% of panel width against 0.62%. Small,
  but it is the same ambiguity as the line-edge problem already known to this
  project, so **re-derive the edge convention rather than carrying over the old
  constants** — the extra 23% of pixels is there to spend on exactly that.

**The delivery notice, which is the one new legal wrinkle.** Page 1 is U-M's
"NOTICE CONCERNING COPYRIGHT RESTRICTIONS": the copy is provided "for the
purposes of private study, scholarship, or research," and "if you use the copy
for a different purpose, such as posting on a course website, the copyright
analysis that supported making the copy does not apply." That is request 5's
fourth question, now sitting in the file rather than in the abstract. ~~It is
**still with counsel**.~~ **Answered 2026-08-19, twice — the second answer
retracting the first.** See "Answer 4 was retracted" above. Two things follow,
and they are different things:

- **Do not post this PDF anywhere**, and do not commit it. Nothing here changes
  that; the repo already gitignores it and should keep doing so. The notice
  makes the requester responsible for other uses, which is a reason to be
  careful with the file itself, not a reason to be careful with facts read off
  it.
- **Extracted values are a separate question**, and the notice governs the
  reproduction rather than facts taken from it — which is the Copyright
  Librarian's position on the license clause too, for the same reason.

  **Right on the limb that matters, 2026-08-19 — after a false alarm the same
  day.** A first answer said the notice would likely be read as reaching
  extracted content; it was retracted hours later by the person who gave it,
  once he saw the notice itself. **The notice governs the reproduction and puts
  responsibility for other uses on the requester.** So this bullet's reading was
  correct, and the strike-through above it recorded a conclusion that did not
  survive the afternoon.

  The separate half is still true and still bites: derived values *are* "any
  part of the Publications" under the license — but only for content obtained
  through the subscription, which this scan was not. **Re-extracting from this
  scan is clear on rights.** What is not settled is whether to spend the work;
  see "Answer 4 was retracted" above.

**What it does not settle: the assay-error question is untouched.** The scan was
read for it, since it was cheap to do so. The Methods are identical in substance
to the licensed copy, and on per-sample error the paper says only, for GnRH,
sensitivity 0.07 pg/tube, 50% displacement at 6.1 ± 0.2 pg/tube, samples run in
duplicate, and an intraassay variation "assessed by median variance ratio of
assay replicates" averaging 0.02 ± 0.01 — reference 25 being Duddleson, Midgley
& Niswender 1972. **A median variance ratio is not a CV and not a per-sample
error model**, and no per-sample error appears anywhere in the paper. So the
answer to "what did Webster's analysis use" is that the paper does not say, and
`next-steps.md` §3's banner stays up. Recorded here so the next person does not
re-read the same nine pages hoping.

### The free check came back, and the digitization holds

**2026-08-17.** The section above promised that re-extracting from print "buys a
real check for free … the only test of digitization accuracy this project has
ever had a way to run." That check has now been run, by
[`tools/crosscheck_webster_print.py`](../tools/crosscheck_webster_print.py). It
reads the eight series off the library scan and compares them to the committed
CSVs. **It writes nothing to `data/digitized/`** — it is an instrument, not a
re-extraction, and the standing instruction to wait for counsel is untouched.

The two readings share no pixels: different scan, different page decomposition,
different panel geometry, an independently solved axis, a different circle test.
All they share is the printed figure. So the spread between them is the
measurement.

**The pulse calls — the part that cannot be manufactured — come back 70 of 72
identical.** Three of the five marked panels reproduce the paper's own CLUSTER
marks at exactly the same sample indices. The other two each move a single mark
by one sample: `fig3b_thx_8067_gnrh` 31→32 and `fig4a_thx_9013_gnrh` 24→25. The
answer key this dataset exists for is therefore reproducible from an
independent scan, which is a far stronger statement than "we read it carefully."

**The values agree inside the printed line.** For the five records not already
flagged as being at the figure's resolution limit, the median disagreement is
**0.26 line widths** — worst 0.34 — or 1.5% of each record's range. The figure
does not distinguish anything below its own line width, so the two readings
agree to the limit of what the page can say. That is the quality number this
document asked for, and on its own terms it is a pass.

Two honest qualifications:

- **There is a systematic ~2% scale difference**, not just noise. The print
  reading puts the GnRH box top at 3.06 against 2.99, and the LH box top at
  31.77 against 31.12 — both about 2% high, consistently, which is why the
  per-record bias runs one way. It is a calibration difference between two
  readings of the same axis, well inside the line width, but it is a bias rather
  than scatter and should be described that way.
- **The three flat records disagree most**, up to 1.16 line widths on
  `fig4b_thx_9009_gnrh`. That is not a new problem and not a contradiction: those
  are the records whose own banner already says their sample-to-sample variation
  is line width rather than data. Two readings of a thick flat line disagreeing
  by about a line width is exactly what that banner predicts. It is corroboration
  of the warning, not a failure of it.

One sample of `fig4a_thx_9013_lh` could not be read from the print scan and is
excluded from that record's comparison.

**What re-extraction would actually cost, corrected.** The estimate above was a
flag and a re-measure. It is more, and all of it traces to one fact — the print
scan is heavier-inked:

1. `pdfimages` returns fragments, so the page must be composited with
   `pdftoppm`.
2. **Ring interiors do not scale.** The page is placed 1.36× larger, but the
   heavier ink keeps the open circles' white centres at roughly the same area
   instead of 1.36² larger, so size alone no longer separates a pulse ring from
   the counter of a letter in the panel title — they overlap. The cross-check
   keeps rings by whether the ink around them belongs to the trace, which a
   title letter never does. That returns the printed pulse count exactly in all
   five panels, and it is a better discriminator than size on either scan.
3. **The tick marks are nearly swallowed.** The axis line is thick enough that
   minor ticks clear it by two or three pixels, so the tool's fixed tick strip
   cannot see them. Ticks are found instead by protrusion relative to the axis's
   own edge, and the scale is solved as the tick lattice's period, pooled across
   the four panels that share an axis. Guessing which multiple each tick sits at
   does not work: a doubled scale puts every tick on an even multiple and fits
   exactly as well, and cross-panel agreement cannot break that tie because a
   doubled axis is equally consistent across all four panels.

None of that is a reason not to re-extract. It is a reason not to budget an
afternoon for it.

### What the attempts have established so far

- **There is no category for this request.** OUP's permissions platform handles
  figures, images, tables and text; extracting the numbers behind a figure is
  not among them, and the automated reply's own escape clause — resubmit "where
  your reuse/content is not available within our automatic permissions
  platform" — is the only route to a human. That is not an obstacle so much as
  evidence for what this document argues below: *the whole permissions
  apparatus is built around the image.* Being unable to file the request is a
  finding about the field, and it is worth quoting the next time this comes up.
- **An author may have more standing than request 2 assumed.** OUP's automated
  reply states that OUP authors "may reuse their own articles in full or part in
  other works without direct permission from OUP," subject to full credit, no
  Open Access reuse and no commercial sponsorship. That is a reuse right held by
  the authors, not something they can hand to a third party — so it does not
  reverse request 2 — but it does sit awkwardly beside "that is a question for
  the copyright holder," and request 3 asks OUP directly whether that route is
  the cleaner one here.
- **The copyright holder may not be OUP at all.** The article is from 1991 and
  predates OUP's publication of *Endocrinology*; copyright may rest with the
  Endocrine Society. Request 3 asks OUP to say which, because a redirect is a
  fast and useful answer.

### If the remaining requests come back silent

> **The print-copy route makes this section much less important than it was.**
> It does not depend on anyone answering: re-extracting from the bound volume
> needs no permission and no reply. Silence from OUP is now an inconvenience
> rather than a decision point.

Ten working days on request 3 lapses around **2026-08-27**. Silence is not
consent, but neither is it grounds to keep waiting indefinitely — decide then
rather than letting it drift, and record the decision here. The fallback that
costs nothing is already built: `data/synthetic/` generates records to this same
paper's protocol, which is what request 2's respondent recommended. What it
cannot replace is the published pulse calls, and that loss should be taken
knowingly rather than by default.

Researched 2026-08-11 across four passes, reading primary sources — the U.S.
Reports, the Copyright Office's Compendium and regulations, EUR-Lex and CURIA —
rather than summaries. **Not legal advice.** The genuinely uncertain parts are
marked as such, and one earlier draft of this analysis was wrong in a way
recorded below.

The concrete question: Webster et al. 1991 (*Endocrinology* 129(3):1635–43,
PMID 1874193) prints portal-GnRH and jugular-LH traces at 400 dpi with every
sample marked **and the pulses CLUSTER identified circled on the trace**. That
is a published pulse call sitting next to the data that produced it — an answer
key no simulator can supply, though it records what a detector reported rather
than what the animal secreted. May we read the values
off it and ship them as a CSV?

**Short answer: copyright is not the obstacle; contract might be, and that part
is unresolved. The practice is routine and no publisher has ever objected to it.
Ask the authors anyway — they may simply have the data.**

## Copyright: the numbers are not protected

Under *Feist v. Rural Telephone*, 499 U.S. 340 (1991), facts carry no copyright,
explicitly including science — "The same is true of all facts — scientific,
historical, biographical, and news of the day" (348) — and "In no event may
copyright extend to the facts themselves" (350–51). The creation/discovery
distinction describes measurement almost literally: census takers "do not
'create' the population figures that emerge from their efforts; in a sense, they
copy these figures from the world around them" (347). A later user "remains free
to use the facts contained in another's publication", and "the raw facts may be
copied at will" (349–50). 17 U.S.C. §103(b) says the same in statute.

Putting a fact in a picture does not protect it. §102(b) withholds protection
from any "idea, procedure, process, system, method of operation, concept,
principle, or discovery, **regardless of the form in which it is described,
explained, illustrated, or embodied in such work**".

The Copyright Office is more emphatic than expected:

- **Compendium §921** (charts): *blank* graphs and charts "rarely contain more
  than a de minimis amount of authorship" — the sentence is about blank forms,
  so it should not be read as a statement about populated charts generally, and the worked example concludes "The pie chart, in and
  of itself, is not copyrightable and cannot be registered."
- **§707.1** (numbers): "**The process of arriving at individual numbers or
  values may require judgment, prediction, valuation, or expertise, but an
  individual number does not express any selection, coordination, or arrangement
  that results in an original work of authorship.**"
- **§707.2** (research): registering a scientific journal "does not extend to the
  facts, ideas, procedures … described in the work."
- **§922**: registration of a scientific drawing "covers only the drawing itself".

The most useful analogy found, from Carroll's PLOS Biology primer on research
data (13(8):e1002235): "One would not be exercising any rights under copyright
by creating a drawing of an animal depicted in a photograph. **The photographer
is not the author of the animal's characteristics.**"

### The closest precedent: *Assessment Technologies v. WIREdata*

350 F.3d 640 (7th Cir. 2003), Posner J. — structurally the same problem, and it
opens:

> "This case is about the attempt of a copyright owner to use copyright law to
> block access to data that not only are neither copyrightable nor copyrighted,
> but were not created or obtained by the copyright owner. … **It would be
> appalling if such an attempt could succeed.**"

It also answers the obvious objection — that you must handle the protected
container to reach the unprotected data:

> "…if the only way WIREdata could obtain public-domain data … would be by
> copying the data in the municipalities' databases as embedded in Market Drive
> … **it would be privileged to make such a copy**. For the only purpose of the
> copying would be to extract noncopyrighted material…"

*BellSouth v. Donnelley*, 999 F.2d 1436 (11th Cir. 1993) (en banc) is consistent:
bulk intermediate copying of directory listings took "no original element of
selection, coordination or arrangement" and did not infringe.

### The one live copyright caveat, and why it is weaker than it first looked

*CDN v. Kapes*, 197 F.3d 1256 (9th Cir. 1999) and *CCC v. Maclean Hunter*, 44
F.3d 61 (2d Cir. 1994) held that numbers produced by expert judgment are
"created, not discovered" and so protectable. If a figure plots modeled, fitted
or smoothed values rather than raw readings, that line is arguable.

Four things blunt it here:

1. Both cases expressly contrast their facts with measurement. *CDN*: "**If CDN
   merely listed historical facts of actual transactions**, the guides would be
   long, cumbersome, and of little use to anyone." *CCC*: the Red Book figures "**are not
   historical market prices, quotations, or averages**" but "the Maclean editors'
   predictions". Direct RIA measurements of collected fractions are the thing
   both courts said they were *not* dealing with.
2. The Second Circuit backed away from *CCC* in *NYMEX v. IntercontinentalExchange*,
   497 F.3d 109 (2d Cir. 2007). Be precise about what it held: the court
   **expressly declined to decide** whether settlement prices are unoriginal and
   affirmed on merger instead. But it recorded a "strong argument" that NYMEX,
   "like the census taker", does not author them, and that the prices "can be
   seen as 'pre-existing facts' about the outside world which are discovered
   from actual market activity" (footnote 5). Persuasive, not a holding.
3. *CCC* limited itself to "**wholesale copying of a compilation rather than
   some more limited copying from a compilation**" (footnote 26).
4. The Copyright Office rejects the reasoning at the level of individual values
   outright — §707.1 above reads as a deliberate repudiation, echoing the
   opinions' own words ("judgment, prediction, valuation, or expertise").

**Still genuinely uncertain**, and worth stating plainly: no US decision was
found addressing extraction of values from a published chart at all. Everything
above is analogy. Whether replotting extracted data creates a derivative work is
also unlitigated — §101 requires a work "based upon one or more preexisting
*works*", and if only facts were taken there is no preexisting work in the
chain, but no court has said so. A CSV sidesteps that question by not being a
chart.

## The EU database right does not reach it

**A correction: an earlier draft of this analysis said a single figure is
"probably not a database". That was wrong.** C-444/02 defines a database as "any
collection of works, data or other materials, separable from one another without
the value of their contents being affected, including a method or system of some
sort for the retrieval of each of its constituent materials", and C-490/14
(*Verlag Esterbauer*) confirms the legislature intended a "wide scope". There is
no minimum size. A few dozen tabulated measurements qualify. Being a database is
the easy part and decides nothing.

The right fails at the next step. Art. 7(1) requires substantial investment in
*obtaining, verifying or presenting* — and *BHB v William Hill* (C-203/02) holds
this "does not cover the resources used for the creation of materials which make
up the contents of a database", nor verification "during the stage of creation".
Running the experiment is creation, not obtaining. The saving clause at BHB
[35]–[36] leaves only investment in collecting, arranging and presenting that is
*independent* of creating the data; for one chart in one article there is
essentially none. The *intrinsic* value of the data is expressly irrelevant (BHB [72], [78]) — so
"this was hard-won science" cannot convert creation into obtaining.

Supporting: the Commission's own evaluation of the Directive (SWD(2018) 146
final, §5.4.1) says courts following the 2004 rulings conclude such data was
"'created' … not 'obtained'". Art. 8(1) lets a lawful user extract insubstantial
parts "for any purposes whatsoever"; Art. 9(b) carries a scientific-research
exception; *CV-Online Latvia* (C-762/19) makes "the risk that that investment may
not be redeemed" the main criterion, hard to show for data nobody exploits
commercially. The 15-year term (Art. 10) on a 1991 publication expired around
2007 regardless. There is no US equivalent to this right.

Contestable at the edges: the German *Autobahnmaut* decision accepted a database
right in machine-recorded toll data, and the CJEU has never ruled on scientific
measurement data specifically.

## Contract is the real constraint, and it is unresolved

> **Read the print-copy finding above before this section.** Everything here is
> a term of a license for the *electronic* copy. None of it attaches to the
> printed volume, so extracting from print removes this whole section's risk
> rather than resolving it. What follows is why the risk is real when you work
> from a licensed PDF — which is how these eight series were in fact obtained.

Contract can restrict what copyright permits, and this is where the actual risk
sits. Reichman & Uhlir's standing argument about scientific data in the US is
exactly this: the operative constraint is access terms and licenses, not
copyright.

- **OUP legal notice** forbids subscribers to "display or distribute any
  Restricted Content on any other site, the internet or any electronic network".
- **Endocrine Society site terms** define "Site Materials" to include *data* and
  prohibit "harvesting, scraping, or collection of" them without written consent.
- **The U-M license** the PDF was obtained under prohibits posting
  license-accessed material publicly, and is not public.

Whether any of that reaches a derived CSV of facts — textually not a copy of
anything on their site — is arguable both ways and appears untested. Note that
*WIREdata* expressly declined to resolve the parallel license question, while
recording "profound skepticism" about the licensor's reading.

OUP permits non-commercial TDM without formal permission but scopes it to the
undisclosed institutional agreement and says nothing about redistributing
outputs. That silence is not inevitable: Elsevier states plainly that it claims
no copyright over TDM output and places no restriction on publishing it. OUP has
simply not taken a public position. (In the EU this would be moot — DSM Directive
Art. 3 gives research organizations a TDM exception for lawfully accessed
content, and Art. 7(1) makes contrary contract terms unenforceable. No US
equivalent.)

## What publishers actually say about data, as opposed to figures

Two say in writing that data reuse needs no permission.

**IOP Publishing** is the clearest anyone gets:

> "Reuse of raw data does not generally need permission, provided you have
> plotted it into a completely different graph/table. You should however cite the
> source of the data."
> "Reuse of a graphical/pictorial representation of data, e.g. a graph/table,
> does need permission (as someone has put effort into creating it)."

**Elsevier**: "Permission is not required if a figure/table is created using
data and not taken the table/figure as such from any third party or published
sources", and its permissions guidelines list "only data is taken from the
source" among instances where permission is not needed. Read honestly, though,
Elsevier's three formulations are not consistent — one of them qualifies the
carve-out to data "that was not previously in figure or table format", which is
precisely what digitizing a figure is not. Do not lean on any single wording.

**PLOS goes furthest and requires the opposite of permission**: its mandatory
minimal data set expressly includes "The values used to build graphs" and "**The
points extracted from images for analysis**". A major publisher mandates
depositing exactly this class of data.

The industry-wide **STM Permissions Guidelines**, by contrast, govern reuse of
"figures/tables/images" and are entirely silent on extracting the underlying
numbers. The whole permissions apparatus is built around the image.

## Field practice, and the precedent that does exist

The Cochrane Handbook §5.5.8 instructs review authors outright: "**Review
authors should consider using software for extracting numerical data from
figures when the data are not available elsewhere**", naming Plot Digitizer,
WebPlotDigitizer, Engauge and others. Searching the full text of that chapter,
"copyright" does not appear in the guidance and "permission" appears zero times.
PRISMA 2020's explanation document mentions figure data exactly once, and only
to ask that you name the tool — a transparency requirement, not a rights one.

**An earlier draft of this file said publishing digitized values as the
deliverable dataset "has no precedent found either way". That was wrong.** It is
routine and peer-reviewed:

- **GlobTherm** (*Scientific Data* 2018;5:180022, CC BY) — thermal tolerances for
  2,133 species, values "extracted using Plot digitizer software", deposited in
  Dryad.
- **Cu-Cr-X alloys** (*Scientific Data* 2025;12:2023, dataset license unverified; the article itself is CC BY-NC-ND) — 3,018
  records auto-extracted from 251 figures in 146 papers published by Elsevier,
  Springer Nature and Wiley, redistributed for "unrestricted access".
- **AedesTraits** (*Scientific Data* 2025;12:2033) — WebPlotDigitizer v4.8,
  30,969 rows on Zenodo under CC BY.
- **PANGAEA** — about 2,400 datasets match the *terms* "digitized from the
  original publication" (an exact-phrase search returns none), CC BY, with the
  digitized provenance stated in each record.
- Kaplan-Meier reconstruction (Guyot et al., *BMC Med Res Methodol* 2012;12:9,
  1,848 citations) is mainstream, and reconstructed patient-level datasets are
  deposited publicly under CC BY.

No publisher objection to any of it was found. After deliberate searching across
Retraction Watch, DMCA records, repository takedowns and editorials, **there is
no recorded instance of a publisher or journal objecting to, or acting against,
the digitization of a figure or redistribution of the resulting numbers.** The
one real takedown in this vicinity (Kaggle, July 2026) concerned verbatim
redistribution of *photographs*. The only objection of any kind found anywhere
came from an individual author, and was groundless under *Feist*.

**The honest negative, which matters.** No dataset paper, competition, or tool
has ever articulated the doctrine "extracted values are facts, therefore
redistributable regardless of the source's license". The chart-extraction
community reasons about *images* and source-document licenses, never about the
numbers. There is abundant *practice* and no stated *doctrine*. Relying on the
argument means making it, not citing someone who made it. Note also that DSM
Arts. 3–4 authorize reproductions and extractions *for the purpose of* TDM and do
not on their face authorize redistributing the resulting dataset — don't
over-read them.

## The closest precedent to this project, and what it chose

**Runvik H, Medvedev A. "Impulsive time series modeling with application to
luteinizing hormone data." *Frontiers in Endocrinology* 2022;13:957993, CC BY
4.0.** Methods, verbatim: "The female LH data were obtained through **digitizing
the representative LH profile … depicted in Figure 2 of (24)**" — where (24) is
Johnson ML et al., "AutoDecon…", *Analytical Biochemistry* 2008;381:8–17. That
is the same Michael Johnson whose license this repo already navigates, in an
Elsevier journal, in this exact domain.

So digitizing Johnson's published figure, and saying so plainly, passed peer
review at a CC BY journal. But **they did not redistribute the numbers**: their
data availability statement reads "The authors do not own the data and therefore
cannot make them available", and their public repository contains code and a
GPL-3 license, no data files. (Their statement lumps the digitized series
together with a separate clinical dataset, so it is not certain which it was
aimed at.)

## If it is ever done here, the model to follow

**GLACIMONTIS** (*Scientific Data* 2026;13:629, CC BY) is the only project found
that anticipates objections rather than ignoring them. It digitizes published
figures by default when authors do not respond, describes the output as "a
derivative product", records per-record provenance — and: "**In cases where
authors explicitly declined to have their reconstructions included … we respected
their decision.**" Courtesy, honored without conceding that permission was
legally required.

Per-record source citation is universal practice across every precedent above and
is treated as sufficient by everyone who has said anything.

## What to actually do

**Not RightsLink.** Its categories exist for reusing text and illustrations;
there is no data-extraction option, a free-text request goes to human review with
a 15-working-day turnaround, and no fee schedule or precedent exists for this
kind of ask.

**Ask the authors.** Karsch and Moenter are both at Michigan and this project is
already in contact with that lab. Author blessing is not a copyright license and
does not override the publisher's terms, but the only risk actually live here is
the relational one, and that is what it addresses. Better still, they may still
hold the underlying values — **original data from an author beats anything
digitized from a figure and moots this entire document.**

Worth asking the U-M library (`library.collections@umich.edu`) in parallel
whether the OUP agreement permits publishing TDM outputs; they can read a
contract we cannot.

That is the route that was taken, on 2026-08-11 and again on 2026-08-13. The
outcome is in the banner at the top of this document: **the author route is
closed**, because permission is not an author's to give — which this section
half-anticipated ("Author blessing is not a copyright license") without drawing
the conclusion that an author might therefore decline to offer one at all.

So the remaining routes are the two now in flight: the copyright holder, and the
U-M library on the institutional license. RightsLink is still the wrong door for
the reasons above, so the Society was approached directly, and the request leads
with the more answerable question — *does this require permission at all?* —
rather than with the formal ask.
