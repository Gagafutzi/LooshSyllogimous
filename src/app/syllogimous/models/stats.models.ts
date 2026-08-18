import { EnumQuestionType } from "../constants/question.constants";

export class TypeBasedStats {
    [EnumQuestionType.Syllogism] = new TypeBasedStatsInner(EnumQuestionType.Syllogism);
    [EnumQuestionType.Distinction] = new TypeBasedStatsInner(EnumQuestionType.Distinction);
    [EnumQuestionType.ComparisonNumerical] = new TypeBasedStatsInner(EnumQuestionType.ComparisonNumerical);
    [EnumQuestionType.ComparisonChronological] = new TypeBasedStatsInner(EnumQuestionType.ComparisonChronological);
    [EnumQuestionType.LinearVertical] = new TypeBasedStatsInner(EnumQuestionType.LinearVertical);
    [EnumQuestionType.LinearHorizontal] = new TypeBasedStatsInner(EnumQuestionType.LinearHorizontal);
    [EnumQuestionType.LinearContains] = new TypeBasedStatsInner(EnumQuestionType.LinearContains);
    [EnumQuestionType.LinearArrangement] = new TypeBasedStatsInner(EnumQuestionType.LinearArrangement);
    [EnumQuestionType.CircularArrangement] = new TypeBasedStatsInner(EnumQuestionType.CircularArrangement);
    [EnumQuestionType.Direction] = new TypeBasedStatsInner(EnumQuestionType.Direction);
    [EnumQuestionType.Direction3DSpatial] = new TypeBasedStatsInner(EnumQuestionType.Direction3DSpatial);
    [EnumQuestionType.Direction3DTemporal] = new TypeBasedStatsInner(EnumQuestionType.Direction3DTemporal);
    [EnumQuestionType.Space4D] = new TypeBasedStatsInner(EnumQuestionType.Space4D);
    [EnumQuestionType.Space3D] = new TypeBasedStatsInner(EnumQuestionType.Space3D);
    [EnumQuestionType.Space5D] = new TypeBasedStatsInner(EnumQuestionType.Space5D);
    [EnumQuestionType.Space6D] = new TypeBasedStatsInner(EnumQuestionType.Space6D);
    [EnumQuestionType.Space7D] = new TypeBasedStatsInner(EnumQuestionType.Space7D);
    [EnumQuestionType.GraphMatching] = new TypeBasedStatsInner(EnumQuestionType.GraphMatching);
    [EnumQuestionType.Hierarchy] = new TypeBasedStatsInner(EnumQuestionType.Hierarchy);
    [EnumQuestionType.Analogy] = new TypeBasedStatsInner(EnumQuestionType.Analogy);
    [EnumQuestionType.Binary] = new TypeBasedStatsInner(EnumQuestionType.Binary);
    [EnumQuestionType.Deictic] = new TypeBasedStatsInner(EnumQuestionType.Deictic);
    [EnumQuestionType.Transformation] = new TypeBasedStatsInner(EnumQuestionType.Transformation);
    [EnumQuestionType.AnchorSpace] = new TypeBasedStatsInner(EnumQuestionType.AnchorSpace);
    [EnumQuestionType.AnchorSpaceV2] = new TypeBasedStatsInner(EnumQuestionType.AnchorSpaceV2);
    [EnumQuestionType.InferRelation] = new TypeBasedStatsInner(EnumQuestionType.InferRelation);
    [EnumQuestionType.OddestRelation] = new TypeBasedStatsInner(EnumQuestionType.OddestRelation);
    [EnumQuestionType.ShapeRotation] = new TypeBasedStatsInner(EnumQuestionType.ShapeRotation);
    [EnumQuestionType.RelationalWeb] = new TypeBasedStatsInner(EnumQuestionType.RelationalWeb);
    [EnumQuestionType.StimulusFunction] = new TypeBasedStatsInner(EnumQuestionType.StimulusFunction);
    [EnumQuestionType.TransformMatching] = new TypeBasedStatsInner(EnumQuestionType.TransformMatching);
    [EnumQuestionType.Knaves] = new TypeBasedStatsInner(EnumQuestionType.Knaves);
}

export class TypeBasedStatsInner {
    type: EnumQuestionType;
    completed = 0;
    accuracy = 0;
    stats = {
        "2": new TypeBasedStatsInner2(),
        "3": new TypeBasedStatsInner2(),
        "4": new TypeBasedStatsInner2(),
        "5": new TypeBasedStatsInner2(),
        "6+": new TypeBasedStatsInner2(),
    };
    
    constructor(type: EnumQuestionType) {
        this.type = type;
    }
}

export class TypeBasedStatsInner2 {
    sum = 0;
    count = 0;
    fastest = 0;
    slowest = 0;
    correct = 0;
    incorrect = 0;
    timeout = 0;
    last10Sum = 0;
    last10Count = 0;
    last10Fastest = 0;
    last10Slowest = 0;
    last10Correct = 0;
    last10Incorrect = 0;
    last10Timeout = 0;
}