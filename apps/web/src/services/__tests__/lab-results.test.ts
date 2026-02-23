/**
 * Unit tests for lab-results extraction.
 *
 * The fixture text below mirrors what pdfjs actually emits for a
 * multi-column French lab report (BIOLAB33 format): values and units are
 * concatenated on one line, the reference range is on the next line (inside
 * parentheses), and the test name appears on the line after that.
 *
 * Deliberate quirks reproduced from the real PDF:
 *   - value+unit with no space (e.g. "5,78T/L")
 *   - comma decimal separator (European format)
 *   - test name AFTER the value+range block
 *   - section headers / footer noise interspersed between rows
 *   - one-sided reference ranges ("< 50", "> 1,03")
 *   - trailing " #" on French lab names
 */

import { describe, expect, it } from "vitest";
import { extractStructuredValues } from "../lab-results";

const BIOLAB33_EXCERPT = `
HEMATOCYTOLOGIE
Valeurs de référencesAntériorité
5,78T/L
( 4,60 - 6,20 )
Hématies
17,1g/dL
( 13,0 - 18,0 )
Hémoglobine
49,5%
( 37,0 - 50,0 )
Hématocrite
86fL
( 79 - 97 )
V.G.M.
29,6pg
( 27,0 - 32,0 )
T.C.M.H.
34,5g/dL
( 31,0 - 36,0 )
C.C.M.H.
6,6G/L
( 4,0 - 11,0 )
Leucocytes
248G/L
( 150 - 400 )
Plaquettes
BIOCHIMIE SANGUINE
140mmol/L
( 137 - 148 )
SODIUM #
4,2mmol/L
( 3,5 - 5,1 )
POTASSIUM #
5,46mmol/L
( 4,10 - 5,90 )
GLYCEMIE A JEUN #
4,7mmol/L
( 3,2 - 7,1 )
UREE #
84µmol/L
( 58 - 110 )
CREATININE #
5,20mmol/L
( 3,60 - 5,31 )
CHOLESTEROL TOTAL #
1,12mmol/L
( > 1,03 )
CHOLESTEROL HDL #
3,40mmol/L
CHOLESTEROL LDL
1,50mmol/L
( 0,57 - 1,71 )
TRIGLYCERIDES #
36U/L
( 17 - 59 )
ASAT - TRANSAMINASES SGOT #
64U/L
( < 50 )
ALAT - TRANSAMINASES SGPT #
83U/L
( 15 - 73 )
GGT - GAMMA-GLUTAMYL-TRANSFERASE #
90U/L
( 38 - 126 )
PAL - PHOSPHATASES ALCALINES #
378µg/L
FERRITINE (§) #
81g/L
( 63 - 82 )
PROTEINES TOTALES #
HORMONOLOGIE
1,647mUI/L
( 0,400 - 4,049 )
TSH #
`;

describe("extractStructuredValues", () => {
  const result = extractStructuredValues(BIOLAB33_EXCERPT);

  // --- Haematology --------------------------------------------------------

  it("extracts Hématies (RBC)", () => {
    const entry = result["Hématies"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(5.78);
    expect(entry.unit).toMatch(/T\/L/i);
    expect(entry.referenceRange).toMatch(/4[.,]60/);
    expect(entry.flag).toBe("normal");
  });

  it("extracts Hémoglobine", () => {
    const entry = result["Hémoglobine"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(17.1);
    expect(entry.unit).toMatch(/g\/dL/i);
    expect(entry.loincCode).toBe("718-7");
  });

  it("extracts Hématocrite", () => {
    const entry = result["Hématocrite"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(49.5);
    expect(entry.unit).toBe("%");
    expect(entry.flag).toBe("normal");
  });

  it("extracts V.G.M. (MCV) — dotted abbreviation", () => {
    const entry = result["V.G.M."];
    expect(entry).toBeDefined();
    expect(entry.value).toBe(86);
    expect(entry.unit).toMatch(/fL/i);
    expect(entry.loincCode).toBe("787-2");
  });

  it("extracts T.C.M.H. (MCH) — dotted abbreviation", () => {
    const entry = result["T.C.M.H."];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(29.6);
    expect(entry.loincCode).toBe("785-6");
  });

  it("extracts C.C.M.H. (MCHC) — dotted abbreviation", () => {
    const entry = result["C.C.M.H."];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(34.5);
    expect(entry.loincCode).toBe("786-4");
  });

  it("extracts Leucocytes (WBC)", () => {
    const entry = result["Leucocytes"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(6.6);
    expect(entry.unit).toMatch(/G\/L/i);
    expect(entry.loincCode).toBe("6690-2");
    expect(entry.flag).toBe("normal");
  });

  it("extracts Plaquettes (platelets)", () => {
    const entry = result["Plaquettes"];
    expect(entry).toBeDefined();
    expect(entry.value).toBe(248);
    expect(entry.loincCode).toBe("777-3");
  });

  // --- Biochemistry -------------------------------------------------------

  it("extracts SODIUM (strips trailing #)", () => {
    const entry = result["SODIUM"];
    expect(entry).toBeDefined();
    expect(entry.value).toBe(140);
    expect(entry.unit).toMatch(/mmol\/L/i);
    expect(entry.loincCode).toBe("2951-2");
    expect(entry.flag).toBe("normal");
  });

  it("extracts POTASSIUM", () => {
    const entry = result["POTASSIUM"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(4.2);
    expect(entry.flag).toBe("normal");
  });

  it("extracts GLYCEMIE A JEUN (fasting glucose)", () => {
    const entry = result["GLYCEMIE A JEUN"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(5.46);
    expect(entry.loincCode).toBe("1558-6");
  });

  it("extracts UREE", () => {
    const entry = result["UREE"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(4.7);
    expect(entry.loincCode).toBe("3094-0");
  });

  it("extracts CREATININE", () => {
    const entry = result["CREATININE"];
    expect(entry).toBeDefined();
    expect(entry.value).toBe(84);
    expect(entry.loincCode).toBe("2160-0");
    expect(entry.flag).toBe("normal");
  });

  // --- Lipid panel --------------------------------------------------------

  it("extracts CHOLESTEROL TOTAL", () => {
    const entry = result["CHOLESTEROL TOTAL"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(5.2);
    expect(entry.loincCode).toBe("2093-3");
  });

  it("extracts CHOLESTEROL HDL — one-sided lower-bound range", () => {
    const entry = result["CHOLESTEROL HDL"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(1.12);
    expect(entry.loincCode).toBe("2085-9");
    // > 1,03 — value 1.12 is above the lower bound → normal
    expect(entry.flag).toBe("normal");
  });

  it("extracts CHOLESTEROL LDL (no ref range)", () => {
    const entry = result["CHOLESTEROL LDL"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(3.4);
    expect(entry.loincCode).toBe("2089-1");
    expect(entry.flag).toBeUndefined();
  });

  it("extracts TRIGLYCERIDES", () => {
    const entry = result["TRIGLYCERIDES"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(1.5);
    expect(entry.loincCode).toBe("2571-8");
    expect(entry.flag).toBe("normal");
  });

  // --- Liver enzymes ------------------------------------------------------

  it("extracts ASAT (normal)", () => {
    const key = Object.keys(result).find((k) => /^asat/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(36);
    expect(result[key!].loincCode).toBe("1920-8");
    expect(result[key!].flag).toBe("normal");
  });

  it("extracts ALAT — one-sided upper-bound range, flagged high", () => {
    const key = Object.keys(result).find((k) => /^alat/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(64);
    expect(result[key!].loincCode).toBe("1742-6");
    // ( < 50 ) — value 64 exceeds upper bound → high
    expect(result[key!].flag).toBe("high");
  });

  it("extracts GGT (flagged high)", () => {
    const key = Object.keys(result).find((k) => /^ggt/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(83);
    expect(result[key!].loincCode).toBe("2324-2");
    // range 15–73, value 83 → high
    expect(result[key!].flag).toBe("high");
  });

  it("extracts PAL (alkaline phosphatase)", () => {
    const key = Object.keys(result).find((k) => /^pal/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(90);
    expect(result[key!].loincCode).toBe("6768-6");
    expect(result[key!].flag).toBe("normal");
  });

  it("extracts FERRITINE (no ref range in this fixture)", () => {
    const key = Object.keys(result).find((k) => /ferrit/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(378);
    expect(result[key!].unit).toMatch(/µg\/L|μg\/L/i);
    expect(result[key!].loincCode).toBe("2276-4");
  });

  it("extracts PROTEINES TOTALES", () => {
    const key = Object.keys(result).find((k) => /prot.*totales/i.test(k));
    expect(key).toBeDefined();
    expect(result[key!].value).toBe(81);
    expect(result[key!].loincCode).toBe("2885-2");
  });

  // --- Thyroid ------------------------------------------------------------

  it("extracts TSH", () => {
    const entry = result["TSH"];
    expect(entry).toBeDefined();
    expect(entry.value).toBeCloseTo(1.647);
    expect(entry.unit).toMatch(/mUI\/L/i);
    expect(entry.loincCode).toBe("3016-3");
    expect(entry.flag).toBe("normal");
  });

  // --- determineFlag edge cases -------------------------------------------

  it("flags value below two-sided range as low", () => {
    // Hématocrite 49.5%, range 37–50 → normal (just inside)
    expect(result["Hématocrite"].flag).toBe("normal");
    // Hémoglobine 17.1 g/dL, range 13–18 → normal
    expect(result["Hémoglobine"].flag).toBe("normal");
  });

  it("handles one-sided lower bound (> X) correctly", () => {
    // CHOLESTEROL HDL: > 1,03 — value 1.12 is above → normal
    expect(result["CHOLESTEROL HDL"].flag).toBe("normal");
  });

  it("handles one-sided upper bound (< X) correctly", () => {
    // ALAT: < 50 — value 64 is above → high
    const key = Object.keys(result).find((k) => /^alat/i.test(k));
    expect(result[key!].flag).toBe("high");
  });

  // --- Noise rejection ----------------------------------------------------

  it("does not capture section headers as test names", () => {
    const keys = Object.keys(result);
    expect(keys).not.toContain("HEMATOCYTOLOGIE");
    expect(keys).not.toContain("BIOCHIMIE SANGUINE");
    expect(keys).not.toContain("HORMONOLOGIE");
  });

  it("does not capture the column header line as a test name", () => {
    const keys = Object.keys(result);
    // "Valeurs de référencesAntériorité" must not appear
    expect(keys.some((k) => /valeurs/i.test(k))).toBe(false);
  });
});
