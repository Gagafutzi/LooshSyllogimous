/**
 * Every mode, and the smallest call that builds one.
 *
 * One table, imported by the suites that need to sweep every mode. There were
 * three copies of this before, and they had drifted from each other and from
 * the mode list — which is how three modes came to be shipping without any test
 * ever building them.
 */

import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createComparison, createLinear } from "../src/app/syllogimous/generators/linear";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { createHierarchy } from "../src/app/syllogimous/generators/hierarchy";
import { createAnchorSpace, createAnchorSpaceV2 } from "../src/app/syllogimous/generators/anchor";
import { createTransformation } from "../src/app/syllogimous/generators/transformation";
import { createDeictic } from "../src/app/syllogimous/generators/deictic";
import { createArrangement } from "../src/app/syllogimous/generators/arrangement";
import { createDirection, createDirection3D } from "../src/app/syllogimous/generators/direction";
import { createGraphMatching } from "../src/app/syllogimous/generators/graph-matching";
import { createAnalogy } from "../src/app/syllogimous/generators/analogy";
import { createBinary } from "../src/app/syllogimous/generators/binary";
import { createSyllogism } from "../src/app/syllogimous/generators/syllogism";
import { createInferRelation } from "../src/app/syllogimous/generators/infer-relation";
import { createOddestRelation } from "../src/app/syllogimous/generators/oddest-relation";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { createStimulusFunction } from "../src/app/syllogimous/generators/stimulus-function";
import { createAxisMap } from "../src/app/syllogimous/generators/axis-map";
import { createTransformMatch } from "../src/app/syllogimous/generators/transform-match";
import { createKnaves } from "../src/app/syllogimous/generators/knaves";
import { createNested } from "../src/app/syllogimous/generators/nested";

export type Build = (ctx: GeneratorContext, n: number) => Question;

export const BUILD: Record<string, Build> = {
    [EnumQuestionType.Distinction]: createDistinction,
    [EnumQuestionType.ComparisonNumerical]: (c, n) => createComparison(c, n, EnumQuestionType.ComparisonNumerical),
    [EnumQuestionType.ComparisonChronological]: (c, n) => createComparison(c, n, EnumQuestionType.ComparisonChronological),
    [EnumQuestionType.LinearVertical]: (c, n) => createLinear(c, n, EnumQuestionType.LinearVertical),
    [EnumQuestionType.LinearHorizontal]: (c, n) => createLinear(c, n, EnumQuestionType.LinearHorizontal),
    [EnumQuestionType.LinearContains]: (c, n) => createLinear(c, n, EnumQuestionType.LinearContains),
    [EnumQuestionType.Syllogism]: createSyllogism,
    [EnumQuestionType.LinearArrangement]: (c, n) => createArrangement(c, n, EnumQuestionType.LinearArrangement),
    [EnumQuestionType.CircularArrangement]: (c, n) => createArrangement(c, n, EnumQuestionType.CircularArrangement),
    [EnumQuestionType.Direction]: createDirection,
    [EnumQuestionType.Direction3DSpatial]: (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DSpatial),
    [EnumQuestionType.Direction3DTemporal]: (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DTemporal),
    [EnumQuestionType.Space3D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space3D),
    [EnumQuestionType.Space4D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space4D),
    [EnumQuestionType.Space5D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space5D),
    [EnumQuestionType.Space6D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space6D),
    [EnumQuestionType.Space7D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space7D),
    [EnumQuestionType.GraphMatching]: createGraphMatching,
    [EnumQuestionType.Hierarchy]: createHierarchy,
    [EnumQuestionType.Analogy]: createAnalogy,
    [EnumQuestionType.Deictic]: createDeictic,
    [EnumQuestionType.Transformation]: createTransformation,
    [EnumQuestionType.AnchorSpace]: createAnchorSpace,
    [EnumQuestionType.AnchorSpaceV2]: createAnchorSpaceV2,
    [EnumQuestionType.Binary]: createBinary,
    [EnumQuestionType.InferRelation]: createInferRelation,
    [EnumQuestionType.OddestRelation]: createOddestRelation,
    [EnumQuestionType.ShapeRotation]: createShapeRotation,
    [EnumQuestionType.RelationalWeb]: createRelationalWeb,
    [EnumQuestionType.StimulusFunction]: createStimulusFunction,
    [EnumQuestionType.TransformMatching]: createTransformMatch,
    [EnumQuestionType.AxisMap]: createAxisMap,
    [EnumQuestionType.Knaves]: createKnaves,
    [EnumQuestionType.NestedSpaces]: createNested,
};
