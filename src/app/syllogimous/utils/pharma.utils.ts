/**
 * Pharmacy stimuli — names, formulas and vocabulary, as tokens.
 *
 * The rules stay arbitrary. Nothing here makes a premise *mean* anything: an
 * item saying one molecule is above another is as invented as it was with
 * nonsense triples, and that is the point — the app measures relational
 * reasoning, and a real relation between real drugs would turn an item into a
 * knowledge question the ability model cannot price.
 *
 * What changes is only what the tokens are, so the names go past your eyes a
 * few hundred times a session. Passive exposure is a weak effect and a real
 * one; it is worth a word list and no more than that.
 *
 * **Correctness matters more here than anywhere else in the stimulus code.** A
 * junk shape cannot be wrong. A molecular formula can, and a wrong one shown
 * three hundred times is worse than no formula at all — so this list is short
 * and checkable rather than long and impressive, every formula is one anybody
 * can verify, and `tests/stimuli.test.ts` holds them to being distinct from
 * each other.
 *
 * **HTML, not SVG.** Stimuli reach the DOM through an `[innerHTML]` binding and
 * Angular's sanitiser drops any element outside its allowlist. `sub` is on it,
 * so a subscripted formula survives; `svg` is not, which is why structural
 * formulas are not here — see the note at the end of the file.
 */

/**
 * One molecule, in the representations a test asks you to move between.
 *
 * `condensed` is filled in only where it is short enough to read as a token
 * and unambiguous enough to be worth learning. A ring drawn as text is
 * neither, so benzene has a formula and a name and nothing else.
 */
interface Molecule {
    name: string;
    /** Sum formula, in element-count pairs. Rendered with real subscripts. */
    formula: Array<[string, number]>;
    condensed?: string;
}

const sub = (n: number) => (n === 1 ? "" : `<sub>${n}</sub>`);

const formulaHtml = (parts: Array<[string, number]>) =>
    parts.map(([el, n]) => el + sub(n)).join("");

/**
 * Thirty-odd, all of them checkable.
 *
 * Chosen for being the ones a pharmacy course actually names — the analgesics,
 * the neurotransmitters, a few solvents and sugars — rather than for covering
 * chemistry evenly.
 */
export const MOLECULES: Molecule[] = [
    { name: "Ethanol", formula: [["C", 2], ["H", 6], ["O", 1]], condensed: "CH₃–CH₂–OH" },
    { name: "Essigsäure", formula: [["C", 2], ["H", 4], ["O", 2]], condensed: "CH₃–COOH" },
    { name: "Aceton", formula: [["C", 3], ["H", 6], ["O", 1]], condensed: "CH₃–CO–CH₃" },
    { name: "Chloroform", formula: [["C", 1], ["H", 1], ["Cl", 3]] },
    { name: "Harnstoff", formula: [["C", 1], ["H", 4], ["N", 2], ["O", 1]], condensed: "(NH₂)₂CO" },
    { name: "Glycerol", formula: [["C", 3], ["H", 8], ["O", 3]] },
    { name: "Benzol", formula: [["C", 6], ["H", 6]] },
    { name: "Phenol", formula: [["C", 6], ["H", 6], ["O", 1]] },
    { name: "Glucose", formula: [["C", 6], ["H", 12], ["O", 6]] },
    { name: "Saccharose", formula: [["C", 12], ["H", 22], ["O", 11]] },
    { name: "Harnsäure", formula: [["C", 5], ["H", 4], ["N", 4], ["O", 3]] },
    { name: "Salicylsäure", formula: [["C", 7], ["H", 6], ["O", 3]] },
    { name: "Aspirin", formula: [["C", 9], ["H", 8], ["O", 4]] },
    { name: "Paracetamol", formula: [["C", 8], ["H", 9], ["N", 1], ["O", 2]] },
    { name: "Ibuprofen", formula: [["C", 13], ["H", 18], ["O", 2]] },
    { name: "Naproxen", formula: [["C", 14], ["H", 14], ["O", 3]] },
    { name: "Diclofenac", formula: [["C", 14], ["H", 11], ["Cl", 2], ["N", 1], ["O", 2]] },
    { name: "Coffein", formula: [["C", 8], ["H", 10], ["N", 4], ["O", 2]] },
    { name: "Theophyllin", formula: [["C", 7], ["H", 8], ["N", 4], ["O", 2]] },
    { name: "Nicotin", formula: [["C", 10], ["H", 14], ["N", 2]] },
    { name: "Ascorbinsäure", formula: [["C", 6], ["H", 8], ["O", 6]] },
    { name: "Dopamin", formula: [["C", 8], ["H", 11], ["N", 1], ["O", 2]] },
    { name: "Adrenalin", formula: [["C", 9], ["H", 13], ["N", 1], ["O", 3]] },
    { name: "Serotonin", formula: [["C", 10], ["H", 12], ["N", 2], ["O", 1]] },
    { name: "Histamin", formula: [["C", 5], ["H", 9], ["N", 3]] },
    { name: "Levodopa", formula: [["C", 9], ["H", 11], ["N", 1], ["O", 4]] },
    { name: "Ephedrin", formula: [["C", 10], ["H", 15], ["N", 1], ["O", 1]] },
    { name: "Atropin", formula: [["C", 17], ["H", 23], ["N", 1], ["O", 3]] },
    { name: "Morphin", formula: [["C", 17], ["H", 19], ["N", 1], ["O", 3]] },
    { name: "Codein", formula: [["C", 18], ["H", 21], ["N", 1], ["O", 3]] },
    { name: "Lidocain", formula: [["C", 14], ["H", 22], ["N", 2], ["O", 1]] },
    { name: "Tramadol", formula: [["C", 16], ["H", 25], ["N", 1], ["O", 2]] },
    { name: "Diazepam", formula: [["C", 16], ["H", 13], ["Cl", 1], ["N", 2], ["O", 1]] },
    { name: "Metformin", formula: [["C", 4], ["H", 11], ["N", 5]] },
    { name: "Warfarin", formula: [["C", 19], ["H", 16], ["O", 4]] },
    { name: "Cholesterol", formula: [["C", 27], ["H", 46], ["O", 1]] },
    { name: "Testosteron", formula: [["C", 19], ["H", 28], ["O", 2]] },
    { name: "Estradiol", formula: [["C", 18], ["H", 24], ["O", 2]] },
    { name: "Cortisol", formula: [["C", 21], ["H", 30], ["O", 5]] },
    { name: "Prednisolon", formula: [["C", 21], ["H", 28], ["O", 5]] },
];

/**
 * Vocabulary that is not a molecule.
 *
 * German forms, since the exam this is for is in German and half the value of
 * a stimulus list is recognising the word when it appears in a question stem.
 * Held short: a token has to read as a word inside a premise, and a six-axis
 * premise naming two fifteen-letter terms is a reading test.
 */
export const TERMS = [
    "Agonist", "Antagonist", "Ligand", "Rezeptor", "Substrat", "Enzym",
    "Katalysator", "Isomer", "Racemat", "Enantiomer", "Ester", "Amid",
    "Alkaloid", "Glykosid", "Puffer", "Titration", "Hydrolyse", "Oxidation",
    "Reduktion", "Diffusion", "Osmose", "Kolloid", "Emulsion", "Suspension",
    "Salbe", "Kapsel", "Ampulle", "Tinktur", "Extrakt", "Granulat",
    "Dragee", "Zäpfchen", "Aerosol", "Infusion", "Injektion", "Resorption",
    "Metabolit", "Prodrug", "Plazebo", "Antidot", "Toxin", "Vakzine",
    "Antibiotikum", "Analgetikum", "Sedativum", "Diuretikum", "Hormon",
    "Vitamin", "Elektrolyt", "Molarität", "Viskosität", "Sterilität",
];

/**
 * Which face each molecule wears, fixed for the run.
 *
 * A molecule must never appear twice in one item wearing two faces — "Ibuprofen
 * is above C₁₃H₁₈O₂" is not a premise, it is a contradiction the player has to
 * ignore. The pool is rebuilt per question and some generators draw from it
 * more than once per item, so picking a face per draw would eventually do
 * exactly that.
 *
 * Choosing once per run makes it impossible rather than unlikely. The mix still
 * varies across the list — some molecules are names this run, others formulas —
 * and reshuffles on reload, which is where the pairing gets learned.
 */
let faces: string[] | null = null;

/** For tests, which need to see more than one run's worth of assignment. */
export function resetPharmaFaces() { faces = null; }

function faceOf(m: Molecule): string {
    const forms = [m.name, formulaHtml(m.formula)];
    if (m.condensed) forms.push(m.condensed);
    return forms[Math.floor(Math.random() * forms.length)];
}

export function getPharmaSymbols(): string[] {
    if (!faces) faces = MOLECULES.map(faceOf);
    return [...faces, ...TERMS];
}
