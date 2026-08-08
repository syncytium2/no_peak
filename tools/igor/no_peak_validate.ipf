#pragma TextEncoding = "UTF-8"
#pragma rtGlobals = 3

// no_peak validation exporter.
//
// Runs ClusterMain over a fixed matrix of parameter sets and writes one CSV per
// run containing Igor's own output waves. Those CSVs are the oracle that
// src/core/igor-oracle.test.ts diffs the TypeScript port against.
//
// Usage, with "cluster td- just data.pxp" open and ClusterMasterV4-1.ipf loaded:
//
//     np_ValidateAll()
//
// It asks once for an output folder, then writes every file into it. Copy that
// folder to the repo as data/oracle_igor/ and run `npm test`.
//
// NOTE: this file has never been run by its author (written from reading
// ClusterMasterV4-1.ipf). If Igor complains, the likely spots are the file I/O
// and the exact ClusterMain argument list — both are flagged below.

// ClusterMain's full (non-optional) argument list, from ClusterMasterV4-1.ipf:
//   ClusterMain(wn, nPeak, nNadir, tScoreUp, tScoreDn, minPeak, HalfLife,
//               outScore, errType, errVal, zero, zeroTerminate, errwn, minnadir)
// halfLife/outScore/minnadir are unused by the detection path; passed as 0.
Function np_Run(String tag, String wn, Variable nPeak, Variable nNadir, Variable tUp, Variable tDn, Variable minPeak, String errType, Variable errVal, Variable zero, Variable zeroTerm, String errwn)

	String res = ClusterMain(wn, nPeak, nNadir, tUp, tDn, minPeak, 0, 0, errType, errVal, zero, zeroTerm, errwn, 0)

	WAVE w   = $wn
	WAVE ups = $("ups_" + wn)
	WAVE dns = $("downs_" + wn)
	WAVE pul = $("pulse_" + wn)
	WAVE msu = $("Mscore_ups_" + wn)
	WAVE msd = $("Mscore_downs_" + wn)

	// ts_error names its output err_<wave>; a user-supplied error wave is used as-is
	String ewn = errwn
	if (strlen(ewn) == 0)
		ewn = "err_" + wn
	endif
	WAVE errw = $ewn

	Variable n = numpnts(w), i
	Variable refNum
	Open/P=npOut refNum as tag + ".csv"

	fprintf refNum, "# no_peak Igor oracle — ClusterMasterV4-1\n"
	fprintf refNum, "# wave=%s nPeak=%g nNadir=%g tUp=%g tDn=%g minPeak=%g errType=\"%s\" errVal=%g zero=%g zeroTerminate=%g errwn=\"%s\"\n", wn, nPeak, nNadir, tUp, tDn, minPeak, errType, errVal, zero, zeroTerm, errwn
	fprintf refNum, "i,value,err,up,down,pulse,mscore_up,mscore_dn\n"
	for (i = 0; i < n; i += 1)
		fprintf refNum, "%d,%.17g,%.17g,%g,%g,%g,%.17g,%.17g\n", i, w[i], errw[i], ups[i], dns[i], pul[i], msu[i], msd[i]
	endfor

	Close refNum
	Print "wrote " + tag + ".csv"
End

// Interactive entry point: asks for a folder.
Function np_ValidateAll()
	NewPath/O/Q/M="Choose an EMPTY folder for the no_peak oracle CSVs" npOut
	if (V_flag != 0)
		Print "np_ValidateAll: cancelled"
		return -1
	endif
	return np_RunMatrix()
End

// Non-interactive entry point. Takes a folder path and NEVER shows a dialog,
// so it is safe to drive over AppleScript — a dialog would block Igor and the
// Apple Event would time out. Accepts a POSIX path ("/Users/you/out") or an
// HFS path ("Macintosh HD:Users:you:out").
Function np_ValidateAllTo(String outDir)
	// /Z suppresses the folder-picker if the path does not parse
	NewPath/O/Q/Z npOut, outDir
	if (V_flag != 0)
		// try converting POSIX -> HFS, which older path handling requires
		String hfs = ParseFilePath(5, outDir, ":", 0, 0)
		NewPath/O/Q/Z npOut, hfs
		if (V_flag != 0)
			Print "np_ValidateAllTo: could not open folder: " + outDir
			return -1
		endif
	endif
	return np_RunMatrix()
End

Static Function np_RunMatrix()

	// Liberal wave names (parentheses) are awkward to pass around; work on
	// copies. WaveExists guards keep a missing wave from aborting the run.
	if (WaveExists($"set1C1(RD)"))
		Duplicate/O $"set1C1(RD)", np_set1
		Duplicate/O $"set1C2(STDEV)", np_set1_sd
	endif
	if (WaveExists($"LHInfusedC1(RD)"))
		Duplicate/O $"LHInfusedC1(RD)", np_lhinf
		Duplicate/O $"LHInfusedC2(STDEV)", np_lhinf_sd
	endif

	// ---- the defaults the app ships with, and the panel's recorded settings ----
	np_Run("A_gnrh_p2n2_errwave",  "gnrh", 2, 2, 2, 2, 0, "Error Wave", 0, 0, 0, "sem")
	np_Run("B_gnrh_p1n1_errwave",  "gnrh", 1, 1, 2, 2, 0, "Error Wave", 0, 0, 0, "sem")

	// ---- asymmetric windows: decides whether Igor swaps them on the downs pass ----
	np_Run("C_gnrh_p3n1_errwave",  "gnrh", 3, 1, 2, 2, 0, "Error Wave", 0, 0, 0, "sem")
	np_Run("D_gnrh_p1n3_errwave",  "gnrh", 1, 3, 2, 2, 0, "Error Wave", 0, 0, 0, "sem")

	// ---- every computed error model, on a wave that has a real error wave ----
	np_Run("E_gnrh_p2n2_localsd",  "gnrh", 2, 2, 2, 2, 0, "Local SD",  0, 0, 0, "")
	np_Run("F_gnrh_p2n2_localse",  "gnrh", 2, 2, 2, 2, 0, "Local SE",  0, 0, 0, "")
	np_Run("G_gnrh_p2n2_globalsd", "gnrh", 2, 2, 2, 2, 0, "Global SD", 0, 0, 0, "")
	np_Run("H_gnrh_p2n2_globalse", "gnrh", 2, 2, 2, 2, 0, "Global SE", 0, 0, 0, "")

	// ---- Fixed and SQRT, using the values stored in the panel globals ----
	np_Run("I_man3_p2n2_fixed",    "man3", 2, 2, 2, 2, 0, "Fixed", 0.1,  0, 0, "")
	np_Run("J_man3_p2n2_sqrt",     "man3", 2, 2, 2, 2, 0, "SQRT",  0.01, 0, 0, "")

	// ---- thresholds and the minimum-data-value (dvmp) branch ----
	np_Run("K_gnrh_tup3_tdn1p5",   "gnrh", 2, 2, 3, 1.5, 0, "Error Wave", 0, 0, 0, "sem")
	np_Run("L_gnrh_minpeak1",      "gnrh", 2, 2, 2, 2, 1, "Error Wave", 0, 0, 0, "sem")

	// ---- the zero-activity termination heuristic ----
	np_Run("M_null1_zeroterm",     "null1", 2, 2, 2, 2, 0, "Local SD", 0, 0, 1, "")

	// ---- the other two real datasets ----
	np_Run("N_set1_p2n2_errwave",  "np_set1",  2, 2, 2, 2, 0, "Error Wave", 0, 0, 0, "np_set1_sd")
	np_Run("O_lhinf_p2n2_errwave", "np_lhinf", 2, 2, 2, 2, 0, "Error Wave", 0, 0, 0, "np_lhinf_sd")

	Print "np_ValidateAll: done — copy the folder to the repo as data/oracle_igor/"
	return 0
End
