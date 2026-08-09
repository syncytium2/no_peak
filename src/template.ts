// A downloadable example file, so "what should my CSV look like?" has a
// concrete answer you can open in Excel rather than a paragraph to interpret.
// Deliberately tiny and obviously synthetic: two clear pulses on a low
// baseline, 10-minute sampling, with a plausible ~7% CV error column.

export const TEMPLATE_NAME = "no_peak_template.csv";

export const TEMPLATE_CSV = `time,value,error
10,0.42,0.03
20,0.38,0.03
30,0.45,0.03
40,2.90,0.20
50,6.40,0.45
60,3.10,0.22
70,1.05,0.08
80,0.51,0.04
90,0.44,0.03
100,0.40,0.03
110,0.47,0.03
120,3.60,0.25
130,7.80,0.55
140,4.20,0.29
150,1.40,0.10
160,0.60,0.04
170,0.46,0.03
180,0.41,0.03
`;
