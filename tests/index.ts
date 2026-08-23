/**
 * Every test, in one process.
 *
 * Each file registers its cases on import; this file exists so adding a suite
 * is one line and running them is one command.
 */

import { run } from "./harness";

import "./phrasing.test";
import "./ndspace.test";
import "./progression.test";
import "./generators.test";
import "./induction.test";
import "./derivation.test";
import "./fatigue.test";
import "./profiles.test";
import "./keybind.test";
import "./customise.test";
import "./map.test";
import "./web.test";
import "./coldstart.test";
import "./indeterminacy.test";
import "./transform-match.test";
import "./rungfit.test";
import "./facing.test";
import "./knaves.test";
import "./nested.test";
import "./graphdist.test";
import "./depth.test";
import "./construct.test";
import "./combinations.test";
import "./width.test";
import "./display.test";
import "./timer.test";
import "./ungated.test";
import "./hierarchy-syllogism.test";
import "./testimony.test";

run();
