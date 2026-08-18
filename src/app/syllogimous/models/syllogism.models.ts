export interface ImmediateInference {
    kind: SylKind;
    conclKind: SylKind;
    swap: boolean;
}
export type SylKind = "all" | "no" | "some" | "some_not";
export type SylPremise = [string, SylKind, string];

export interface PolysyllogismResult {
    premises: SylPremise[];
    conclusion: SylPremise;
    conclusionIsTrue: boolean;
    /**
     * The running conclusion after each link of the chain, for the derivation.
     *
     * A polysyllogism is built by composing one syllogism at a time, and the
     * intermediate conclusions are the whole method — they are also the only
     * part a reader cannot recover from the finished item, because the chain
     * premises are shuffled in among distractors that entail nothing.
     */
    trace: SylPremise[];
    /**
     * What the premises actually entail.
     *
     * Equal to `conclusion` on a true item. On a false one the conclusion was
     * swapped for a claim the premises do *not* entail, so this is what the
     * derivation should end on — showing the right answer next to the claim is
     * the point of explaining a false item at all.
     */
    derived: SylPremise;
}