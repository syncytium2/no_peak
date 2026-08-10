// About page: provenance, how the algorithm works, honest caveats, and
// pointers to the literature. Every citation below was verified against
// PubMed/DOI at the time of writing — do not add one you have not checked.

import { BORN, BUILT, VERSION, longDate } from "./version";
import { ContactForm } from "./Contact";
import { downloadText } from "./chart/export";
import { TEMPLATE_CSV, TEMPLATE_NAME } from "./template";

export function About({ onBack }: { onBack: () => void }) {
  return (
    <div className="about">
      <button onClick={onBack}>← Back to the app</button>

      <h1>About no_peak</h1>
      <p className="cite">
        Version {VERSION} · built {longDate(BUILT)} · born {longDate(BORN)}
      </p>
      <p className="lede">
        no_peak is a browser-based implementation of <strong>CLUSTER</strong>, the pulse-detection
        algorithm for endocrine time-series data developed by Johannes D. Veldhuis and Michael L.
        Johnson. It is a faithful port of the Igor Pro implementation used in the Moenter Lab, with
        the original Fortran available as a switchable mode.
      </p>
      <p>
        Your data runs entirely on your machine. There is no analytics, and no code path that
        uploads a loaded recording — it never leaves the browser tab. The one exception on this
        page is the contact form at the bottom, which sends only what you type into it.
      </p>

      <h2 id="prepare">Preparing a file to upload</h2>
      <p>
        The quickest way to see the expected shape is to open the example:{" "}
        <button className="linkish" onClick={() => downloadText(TEMPLATE_CSV, TEMPLATE_NAME)}>
          download a sample CSV
        </button>
        . Every dataset in the <strong>Sample data</strong> menu is a file in the same format, so
        loading one and exporting the results is another way to see it.
      </p>
      <p className="note">
        <strong>The bundled datasets are simulated.</strong> They are generated from a seeded
        random number generator and resemble real recordings only in sampling rate, baseline level,
        pulse amplitude range, and assay CV — they correspond to no animal, experiment, or
        measurement. Real laboratory recordings are not distributed with this app. Anything loaded
        from the Sample data menu is tagged <em>simulated</em> next to its name, and the flat
        control is included deliberately: a detector should find nothing in it.
      </p>
      <p>
        A file is plain text with one sample per line. Commas, tabs, semicolons, or spaces all
        work, and a header row is optional — it is detected and skipped automatically. Three
        layouts are accepted:
      </p>
      <ul>
        <li>
          <strong>One column — <code>value</code>.</strong> Just concentrations, in order. Times
          are generated from the <em>Sampling interval</em> field, which appears in the settings
          when a file has no time column.
          <span className="cite">0.42 ⏎ 0.38 ⏎ 0.45 ⏎ …</span>
        </li>
        <li>
          <strong>Two columns — <code>time,value</code>.</strong> Use this when you have real
          sample times. Times should be evenly spaced: the algorithm compares fixed-width windows
          of <em>points</em>, and widths and areas are computed from the first interval.
          <span className="cite">10,0.42 ⏎ 20,0.38 ⏎ 30,0.45 ⏎ …</span>
        </li>
        <li>
          <strong>Three columns — <code>time,value,error</code>.</strong> The best option if your
          assay reports per-sample precision. The third column is the measurement error (SD or SEM)
          for that sample, and selecting the &quot;Error Wave&quot; model uses it directly instead
          of estimating error from the data.
          <span className="cite">10,0.42,0.03 ⏎ 20,0.38,0.03 ⏎ …</span>
        </li>
      </ul>
      <p>
        You can also select <strong>two files at once</strong> — a data file and a separate error
        file — and they will be paired, provided they have the same number of rows. The error file
        is recognised by its name containing <code>err</code>, <code>sd</code>, <code>sem</code>,
        or <code>stdev</code>. Either way, the app asks before switching to your errors, because
        scaling the test by measurement error changes which pulses are detected.
      </p>
      <h3>Things that will trip you up</h3>
      <ul>
        <li>
          <strong>Every row must be numeric.</strong> There is no support for blanks, gaps, or
          missing-value markers like <code>NA</code>, <code>ND</code>, or <code>-</code>; loading
          stops with the offending line number. Interpolate or trim before uploading, and say which
          you did in your methods.
        </li>
        <li>
          <strong>Rows must all have the same number of columns.</strong> A stray trailing comma on
          one line is the usual culprit.
        </li>
        <li>
          <strong>Export as CSV, not .xlsx.</strong> From Excel: File ▸ Save As ▸ CSV. From Igor:
          Data ▸ Save Waves ▸ Save Delimited Text.
        </li>
        <li>
          <strong>Decimal commas are not supported.</strong> In locales that write
          <code>0,42</code>, the comma is read as a column separator. Save with a period.
        </li>
        <li>
          <strong>Errors of zero break the t-test</strong> — a zero-error sample makes the pooled
          variance vanish. If your assay reports zeros, use one of the estimated error models
          instead.
        </li>
        <li>
          Lines starting with <code>#</code> or <code>//</code> are ignored, so you can keep notes
          at the top of the file.
        </li>
      </ul>

      <h2>How CLUSTER works</h2>
      <p>
        CLUSTER asks one local question, repeatedly. At every sample it compares the mean of the
        next <em>n</em>
        <sub>peak</sub> points against the mean of the preceding <em>n</em>
        <sub>nadir</sub> points using a pooled t-test, scaled by the measurement error at each
        point. When that t-statistic exceeds the user&apos;s threshold, the sample is flagged as a
        significant increase (an <em>up</em>) or, scanning for the opposite sign, a significant
        decrease (a <em>down</em>). A second pass assembles those flags into pulse regions, and a
        third tabulates the resulting peaks and valleys.
      </p>
      <p>
        What makes this approach durable is what it does <em>not</em> assume. There is no pulse
        shape, no secretion-and-clearance kinetic model, no baseline function, and no assumption
        that pulses are regularly spaced. The only model is the measurement error: because the test
        is scaled by each point&apos;s error, a large jump in a noisy stretch of the record may not
        register, while a modest, well-measured rise can. That is deliberate — it keeps the
        detector honest about assay precision rather than about biology.
      </p>
      <p>
        The price of that simplicity is that the detection parameters — the two window widths, the
        two t-score thresholds, and the minimum value a pulse must reach — <em>are</em> the model.
        Different settings give different answers, so publications using CLUSTER should report all
        five along with the error model,
        and it is worth checking that your conclusions survive a sweep of nearby values. CLUSTER
        also identifies <em>when</em> pulses occur; it does not estimate secretion rates, hormone
        half-life, or pulse mass. Those are the province of deconvolution methods, several of which
        are linked below.
      </p>
      <p>
        CLUSTER is forty years old, and newer methods do detect more pulses. In the validation of
        AutoDecon on synthetic LH data, AutoDecon reached about 96% sensitivity against
        CLUSTER&apos;s 80% — but CLUSTER produced markedly fewer false positives, roughly 1%
        against 6%. That trade is the honest summary of why the algorithm is still in use: it is
        conservative, its assumptions are few and inspectable, and it fails in predictable ways.
        One caveat on that 1%, from testing this port against simulated data with known answers:
        it holds for records packed with pulses, which is what those benchmarks used. On sparser
        records the same code produces materially more false positives, so treat the figure as a
        property of the benchmark as much as of the algorithm.
        Whether that is the right trade depends on whether missing a pulse or inventing one is
        worse for your question.
      </p>

      <h3>Error models</h3>
      <p>
        The per-point error can be estimated from the spread of the data values themselves —
        over a sliding window, or across the whole record, as an SD or a standard error; from a square-root model for
        count-like data; from a fixed value; or from a user-supplied error column in your file
        (the &quot;Error Wave&quot; option), which is what you want when your assay reports its own
        per-sample precision.
      </p>

      <h2>Provenance of this port</h2>
      <p>
        Three implementations sit behind this app, and the differences between them are documented
        rather than smoothed over:
      </p>
      <ul>
        <li>
          <strong>CLUST5.MPF</strong> — the original Fortran 77 console program (version 6.01),
          built for VAX, PC, Macintosh, and Unix from a single source with preprocessor switches.
          It printed line-printer reports and drew its plots as columns of asterisks.
        </li>
        <li>
          <strong>do_cluster.mpf</strong> — a later Fortran 90 rewrite (&quot;CLUSTER8&quot;,
          version 8.00) wrapped in a Winteracter GUI, adding outlier detection, residual runs
          tests, and secretion summary statistics.
        </li>
        <li>
          <strong>ClusterMasterV4-1.ipf</strong> — the Igor Pro port, and the validation oracle for
          this project. Its numbers are the ones no_peak is tested against.
        </li>
      </ul>
      <p>
        The Igor port and the original Fortran genuinely disagree in a few places, so the{" "}
        <strong>Implementation</strong> selector switches between them rather than picking a
        winner. The pooled variance term differs (Igor sums the standard deviations, the Fortran
        squares them first), and the pulse-assembly pass marks a different number of points per
        up-flag. Selecting the Fortran mode also switches the interface to the green-phosphor
        terminal look the program originally ran under, which is either a useful signal that
        you&apos;ve left the validated path or simply a nice bit of history, depending on your
        mood.
      </p>
      <p>
        One deliberate departure from both: when a pulse is still in progress at the end of the
        record, the original code silently dropped it, because the statistics that need a
        following baseline cannot be computed. no_peak counts that pulse by default and marks the
        affected statistics as unavailable, since a detected pulse that vanishes from the table is
        more confusing than one with missing columns. The original behavior is one checkbox away.
      </p>

      <h2>Credit</h2>
      <p>
        CLUSTER is the work of <strong>Michael L. Johnson</strong> and{" "}
        <strong>Johannes D. Veldhuis</strong>. Johnson, a biophysicist and Professor Emeritus of
        Pharmacology at the University of Virginia, spent a career building the numerical methods
        and freely distributed software that much of the endocrine pulsatility literature rests on
        — CLUSTER, the deconvolution family, AutoDecon, and a long run of methodological writing on
        parameter estimation and confidence intervals in biological data, including his editorship
        of the <em>Numerical Computer Methods</em> volumes of{" "}
        <em>Methods in Enzymology</em>. There was never a separate software paper for CLUSTER; the
        program was distributed directly by the authors, and the field cites the 1986 paper below
        as the citation for the program itself. This port is made with Michael Johnson&apos;s
        approval, and exists because that software was shared openly and kept working for four
        decades. Any errors in the translation are ours, not theirs.
      </p>

      <h2>Key references</h2>
      <p className="note">
        Every citation on this page was checked against PubMed or publisher records. If you spot an
        error, please report it — a wrong citation in a tool other people cite is worth fixing
        quickly.
      </p>

      <h3>The algorithm</h3>
      <ul>
        <li>
          <a href="https://doi.org/10.1152/ajpendo.1986.250.4.E486" target="_blank" rel="noreferrer">
            Cluster analysis: a simple, versatile, and robust algorithm for endocrine pulse
            detection
          </a>{" "}
          — the original CLUSTER paper, and the correct citation to use for this software.
          <span className="cite">
            Veldhuis JD, Johnson ML. <em>Am J Physiol.</em> 1986 Apr;250(4 Pt 1):E486–93. PMID
            3008572.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1203/00006450-198607000-00011" target="_blank" rel="noreferrer">
            Appraising endocrine pulse signals at low circulating hormone concentrations
          </a>{" "}
          — the regional coefficient-of-variation approach behind the error models.
          <span className="cite">
            Veldhuis JD, Weiss J, Mauras N, Rogol AD, Evans WS, Johnson ML.{" "}
            <em>Pediatr Res.</em> 1986 Jul;20(7):632–7. PMID 3725460.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1210/endo-124-5-2541" target="_blank" rel="noreferrer">
            In vivo biological validation and biophysical modeling of the sensitivity and positive
            accuracy of endocrine peak detection. I. The LH pulse signal
          </a>{" "}
          — how well the detector actually recovers known pulses.
          <span className="cite">
            Urban RJ, Johnson ML, Veldhuis JD. <em>Endocrinology.</em> 1989 May;124(5):2541–7. PMID
            2707166.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1016/S0076-6879(94)40056-3" target="_blank" rel="noreferrer">
            Testing pulse detection algorithms with simulations of episodically pulsatile
            substrate, metabolite, or hormone release
          </a>{" "}
          — the simulation methodology for characterizing false-positive and false-negative rates.
          <span className="cite">
            Veldhuis JD, Johnson ML. <em>Methods Enzymol.</em> 1994;240:377–415. PMID 7823840.
          </span>
        </li>
        <li>
          <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2662597/" target="_blank" rel="noreferrer">
            Biomathematical modeling of pulsatile hormone secretion: a historical perspective
          </a>{" "}
          — the clearest account of where CLUSTER sits among pulse detectors, and a good starting
          point if you are choosing a method.
          <span className="cite">
            Evans WS, Farhy LS, Johnson ML. <em>Methods Enzymol.</em> 2009;454:345–66. PMID
            19216934.
          </span>
        </li>
      </ul>

      <h3>The Igor implementation, and work that used it</h3>
      <p>
        The Igor Pro port that no_peak is validated against was introduced in Vanacker et al.
        (2017), with Michael Johnson as a co-author; papers from the Moenter lab cite it as the
        software reference. The studies below give a sense of how the algorithm is used in
        practice, and the parameters they report are a reasonable starting point for similar data:
        cluster sizes of 2 points for both peak and nadir with t-scores of 2, which are also
        no_peak&apos;s defaults.
      </p>
      <ul>
        <li>
          <a href="https://doi.org/10.1210/en.2017-00382" target="_blank" rel="noreferrer">
            Long-term recordings of arcuate nucleus kisspeptin neurons reveal patterned activity
            that is modulated by gonadal steroids in male mice
          </a>{" "}
          — the source of the Igor implementation, verified against the native version.
          <span className="cite">
            Vanacker C, Moya MR, DeFazio RA, Johnson ML, Moenter SM. <em>Endocrinology.</em> 2017
            Oct;158(10):3553–64. PMID 28938398.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.7554/eLife.43999" target="_blank" rel="noreferrer">
            Genetic dissection of the different roles of hypothalamic kisspeptin neurons in
            regulating female reproduction
          </a>{" "}
          — LH pulse detection in serially sampled mice.
          <span className="cite">
            Wang L, Vanacker C, Burger LL, Barnes T, Shah YM, Myers MG, Moenter SM.{" "}
            <em>eLife.</em> 2019;8:e43999. PMID 30946012.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1523/JNEUROSCI.2428-17.2017" target="_blank" rel="noreferrer">
            Glutamatergic transmission to hypothalamic kisspeptin neurons is differentially
            regulated by estradiol through estrogen receptor α in adult female mice
          </a>
          <span className="cite">
            Wang L, Burger LL, Greenwald-Yarnell ML, Myers MG Jr, Moenter SM. <em>J Neurosci.</em>{" "}
            2018 Jan 31;38(5):1061–72. PMID 29114074.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1523/ENEURO.0223-20.2020" target="_blank" rel="noreferrer">
            Chemogenetic suppression of GnRH neurons during pubertal development can alter adult
            GnRH neuron firing rate and reproductive parameters in female mice
          </a>
          <span className="cite">
            Dulka EA, DeFazio RA, Moenter SM. <em>eNeuro.</em> 2020;7(3):ENEURO.0223-20.2020. PMID
            32513661.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1098/rsos.201040" target="_blank" rel="noreferrer">
            Firing patterns of gonadotropin-releasing hormone neurons are sculpted by their
            biologic state
          </a>{" "}
          — applies CLUSTER to firing rate rather than hormone concentration, and usefully reports
          a parameter-sensitivity check: cluster sizes of 1–5, t-scores of 1–3, and local versus
          global error models did not change the conclusions.
          <span className="cite">
            Penix J, DeFazio RA, Dulka EA, Schnell S, Moenter SM. <em>R Soc Open Sci.</em>{" "}
            2020;7(8):201040. PMID 32968535.
          </span>
        </li>
      </ul>
      <p>
        The serial tail-tip blood sampling protocol and ultrasensitive LH ELISA that make
        pulse-resolved sampling in mice practical come from a different group — Steyn and
        colleagues, with Herbison and Chen — and are worth citing separately if you use them:{" "}
        <a href="https://doi.org/10.1210/en.2013-1502" target="_blank" rel="noreferrer">
          Development of a methodology for and assessment of pulsatile luteinizing hormone
          secretion in juvenile and adult male mice
        </a>
        <span className="cite">
          Steyn FJ, Wan Y, Clarkson J, Veldhuis JD, Herbison AE, Chen C. <em>Endocrinology.</em>{" "}
          2013 Dec;154(12):4939–45. PMID 24092638.
        </span>
      </p>

      <h2>Other tools, and when to prefer them</h2>
      <p>
        CLUSTER is one option among several, and for many questions it is not the best one. If you
        need secretion rates, pulse mass, or half-life, you want deconvolution. If you need
        uncertainty on the number of pulses rather than a single answer, you want a Bayesian
        method. The tools below are real, findable, and — unless noted — still usable today.
      </p>

      <h3>Actively usable</h3>
      <ul>
        <li>
          <a href="https://pulsar.otago.ac.nz" target="_blank" rel="noreferrer">
            PULSAR Otago
          </a>{" "}
          — a modern R/Shiny reimplementation of the classic PULSAR detector, usable as a hosted
          web app or from{" "}
          <a href="https://github.com/phadenz/PulsarOtago" target="_blank" rel="noreferrer">
            source
          </a>
          . The closest thing to a directly comparable alternative to this app, and the most
          practical starting point if you want a second opinion on your data.
          <span className="cite">
            Porteous R, Haden P, Hackwell ECR, et al.{" "}
            <a href="https://doi.org/10.1210/endocr/bqab165" target="_blank" rel="noreferrer">
              <em>Endocrinology.</em> 2021;162(11):bqab165
            </a>
            . PMID 34383026.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1371/journal.pcbi.1011928" target="_blank" rel="noreferrer">
            hormoneBayes
          </a>{" "}
          — the most current approach in this space. Instead of counting discrete pulses, it fits a
          generative model of latent hypothalamic drive with sequential Monte Carlo and returns
          posterior uncertainty on inter-pulse interval, secretion, and clearance. C++ with a
          Python interface; the download link is given in the paper&apos;s data-availability
          statement.
          <span className="cite">
            Voliotis M, Abbara A, Prague JK, Veldhuis JD, Dhillo WS, Tsaneva-Atanasova K.{" "}
            <em>PLoS Comput Biol.</em> 2024;20(2):e1011928. PMID 38422116.
          </span>
        </li>
        <li>
          <a href="https://github.com/BayesPulse/pulsatile" target="_blank" rel="noreferrer">
            pulsatile (R)
          </a>{" "}
          — Bayesian deconvolution with birth–death MCMC, so pulse number is inferred jointly with
          everything else. Honest caveat: it is research code, not on CRAN, and unmaintained since
          2019 — installable from source, but expect to work for it.
          <span className="cite">
            Method: Johnson TD.{" "}
            <a href="https://doi.org/10.1111/1541-0420.00075" target="_blank" rel="noreferrer">
              <em>Biometrics.</em> 2003;59(3):650–60
            </a>
            . PMID 14601766.
          </span>
        </li>
        <li>
          <a href="https://atoms.scilab.org/toolboxes/Dynpeak" target="_blank" rel="noreferrer">
            DynPeak (Scilab)
          </a>{" "}
          — a shape- and duration-aware detector aimed at inter-pulse-interval estimation, with
          built-in outlier diagnosis.
          <span className="cite">
            Vidal A, Zhang Q, Médigue C, Fabre S, Clément F.{" "}
            <a href="https://doi.org/10.1371/journal.pone.0039001" target="_blank" rel="noreferrer">
              <em>PLoS ONE.</em> 2012;7(7):e39001
            </a>
            . PMID 22802933.
          </span>
        </li>
        <li>
          <a
            href="https://github.com/HRunvik/Impulsive-Time-Series-Modeling"
            target="_blank"
            rel="noreferrer"
          >
            Impulsive time-series modeling
          </a>{" "}
          — a control-theory take that models bursts as impulses driving a linear system and
          derives the fit-versus-sparsity trade-off analytically, so there is no threshold to tune
          by hand.
          <span className="cite">
            Runvik H, Medvedev A.{" "}
            <a href="https://doi.org/10.3389/fendo.2022.957993" target="_blank" rel="noreferrer">
              <em>Front Endocrinol.</em> 2022;13:957993
            </a>
            . PMID 36387902.
          </span>
        </li>
      </ul>

      <h3>Methods worth knowing, without current software</h3>
      <ul>
        <li>
          <a href="https://doi.org/10.1016/j.ab.2008.07.001" target="_blank" rel="noreferrer">
            AutoDecon
          </a>{" "}
          — the direct successor to CLUSTER from the same group: fully automated, with statistical
          testing of each candidate burst and simultaneous fitting of half-life and basal
          secretion. It is the standard against which CLUSTER&apos;s sensitivity is usually quoted.
          The original distribution site is gone and we could not find a maintained mirror, so
          treat it as a reference method rather than a tool you can run.
          <span className="cite">
            Johnson ML, Pipes L, Veldhuis PP, Farhy LS, Boyd DG, Evans WS. <em>Anal Biochem.</em>{" "}
            2008;381(1):8–17. PMID 18639514.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1073/pnas.84.21.7686" target="_blank" rel="noreferrer">
            Multi-parameter deconvolution
          </a>{" "}
          — the original deconvolution paper, which reframed the problem as secretion convolved
          with an elimination kernel rather than bumps in a concentration curve.
          <span className="cite">
            Veldhuis JD, Carlson ML, Johnson ML. <em>PNAS.</em> 1987;84(21):7686–90.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1152/ajpendo.1982.243.4.E310" target="_blank" rel="noreferrer">
            PULSAR
          </a>{" "}
          (Merriam &amp; Wachter, <em>Am J Physiol.</em> 1982;243(4):E310–8) and{" "}
          <a href="https://doi.org/10.1016/0010-4809(86)90014-5" target="_blank" rel="noreferrer">
            DETECT
          </a>{" "}
          (Oerter, Guardabasso &amp; Rodbard, <em>Comput Biomed Res.</em> 1986;19(2):170–91) —
          CLUSTER&apos;s contemporaries, useful for understanding why the field converged on
          error-scaled thresholds.
        </li>
      </ul>

      <h3>Choosing between them</h3>
      <ul>
        <li>
          <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4535452/" target="_blank" rel="noreferrer">
            A comparison of methods for analyzing time series of pulsatile hormone data
          </a>{" "}
          — the most useful head-to-head. Its warning generalizes: ignoring a changing (e.g.
          circadian) baseline biases every parameter, whichever method you use.
          <span className="cite">
            Carlson NE, Horton KW, Grunwald GK. <em>Stat Med.</em> 2013;32(26):4624–38. PMID
            23787487.
          </span>
        </li>
        <li>
          <a href="https://doi.org/10.1210/er.2008-0005" target="_blank" rel="noreferrer">
            Motivations and methods for analyzing pulsatile hormone secretion
          </a>{" "}
          — the standard review of what pulse analysis is actually trying to measure.
          <span className="cite">
            Veldhuis JD, Keenan DM, Pincus SM. <em>Endocr Rev.</em> 2008;29(7):823–64. PMID
            18940916.
          </span>
        </li>
      </ul>
      <p>
        One gap worth naming: despite the obvious appeal, there is no established deep-learning
        pulse detector for serial hormone assays. Adjacent machine-learning work exists on hormone
        trajectory prediction and cycle-phase classification, but nothing that identifies pulses in
        the way these tools do. If you were hoping to cite one, it does not yet exist.
      </p>

      <h2>This implementation</h2>
      <p>
        The source and test suite live in a private repository for now. The reference Fortran and
        Igor Pro sources are <em>not</em> redistributed with it — they are third-party code under a
        licence that forbids passing it on. If you find a case where no_peak disagrees with Igor or
        the original Fortran, that is a bug worth reporting: please get in touch with the data and
        parameters.
      </p>

      <h2>Get in touch</h2>
      <p>
        Questions about the algorithm, bug reports, requests for a dataset or feature, and
        corrections to anything on this page are all welcome.
      </p>
      <ContactForm />

      <p style={{ marginTop: 32 }}>
        <button onClick={onBack}>← Back to the app</button>
      </p>
    </div>
  );
}
