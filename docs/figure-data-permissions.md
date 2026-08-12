# Digitizing data from a published figure: where the permissions question lands

> **Resolved, 2026-08-11.** One of the paper's authors gave permission, which is
> the route this document recommends below. The eight traces are digitized and
> live in [`data/digitized/`](../data/digitized/README.md); the extraction is
> `tools/digitize_webster1991.py`. The article itself is not redistributed —
> only the numbers.
>
> The analysis below is kept because the question will recur for the next paper,
> and because what it concluded still holds: copyright was never the obstacle,
> the contractual position remains unresolved and untested, and asking an author
> was both the quickest way through and the only one that also produced someone
> who could confirm the data was being read correctly.

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

That is the route that was taken, on 2026-08-11; the outcome is in the banner at
the top of this document and the traces are in `data/digitized/`.
