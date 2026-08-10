# Run PULSAR Otago (Porteous et al. 2021) headlessly on one input file and
# print the detected peak times, so it can be scored on the same footing as
# this port. PULSAR is GPL-3 and not vendored here.
#
#   PULSAR_SRC=/path/to/PulsarOtago Rscript tools/pulsar/pulsar_run.R \
#       input.csv 3.98,2.4,1.68,1.24,0.93 1 0,4,0
#
# args: file, comma-separated G values, smoothing fraction, sdr_coef (a,b,c
# in PERCENT: sd = (a*x^2 + b*x + c) * 0.01).
# Input format is PULSAR's own: line 1 experiment name, line 2 column names
# (sample,time,conc), then rows.

suppressWarnings(suppressMessages({
  # Point PULSAR_SRC at a clone of https://github.com/phadenz/PulsarOtago
  src <- file.path(Sys.getenv("PULSAR_SRC"), "pulsar_otago_shiny_v1.0.1/pulsaR/R")
  for (f in c("pulsar_constants.R","pulsar_utilities.R","pulsar_computation.R","pulsar_main.R")) source(file.path(src,f))
}))
a <- commandArgs(trailingOnly=TRUE)
pl <- list(smoothing_fraction=as.numeric(a[3]), g_values=as.numeric(strsplit(a[2],",")[[1]]),
           extinction_threshold=0, peak_split_depth=0,
           sdr_coef=as.numeric(strsplit(a[4],",")[[1]]),
           nearest_nadir_distance=3, n_steps=6, sdr_assay=NULL)
res <- tryCatch(run_pulsar(a[1], param_list=pl, make_outfiles=FALSE), error=function(e) NULL)
if (is.null(res) || length(res)==0) { cat("PEAKS:\n"); quit() }
inner <- res[[1]]
df <- NULL
for (el in inner) if (is.data.frame(el) && nrow(el)>0) { df <- el; break }
if (is.null(df)) { cat("PEAKS:\n"); quit() }
tc <- grep("time", colnames(df), ignore.case=TRUE, value=TRUE)
cat("PEAKS:", if(length(tc)>0) paste(df[[tc[1]]], collapse=",") else "", "\n")
