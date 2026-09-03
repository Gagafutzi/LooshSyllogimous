import { Injectable } from "@angular/core";
import { GameService } from "./game.service";
import { jsonCopy } from "src/app/utils/json";
import { TypeBasedStats } from "../models/stats.models";
import { EnumQuestionType } from "../constants/question.constants";
import { itemTally } from "../utils/answer.utils";

@Injectable({
    providedIn: "root"
})
export class StatsService {
    constructor(
        public game: GameService
    ) { }

    calcStats = (timerType?: "0" | "1" | "2") => {
        // Practice answers are excluded by definition — not counting towards
        // stats is what "practice" means.
        const questions = this.game.questions.filter(q => !q.playgroundMode);
        const types = Object.values(EnumQuestionType).filter(qt => Object.values(EnumQuestionType).includes(qt));
        const typeBasedStats = new TypeBasedStats();

        for (let type of types) {
            const tbs = typeBasedStats[type];
            const questionsByType = questions.filter(q =>
                q.type === type && (timerType == null || q.timerTypeOnAnswer === timerType)
            );
            
            tbs.type = type;
            tbs.completed = questionsByType.length;
            /*
             * Accuracy is over conclusions, not items.
             *
             * `userAnswer === isValid` compared against the *last* conclusion
             * of a multi-conclusion item, so two of three right scored the same
             * as three of three, and one of three the same as none. The ability
             * model has always taken each conclusion as its own evidence; this
             * is the screen catching up with it.
             */
            const totals = questionsByType.reduce((acc, q) => {
                const { asked, right, timedOut } = itemTally(q);
                return timedOut ? acc : { asked: acc.asked + asked, right: acc.right + right };
            }, { asked: 0, right: 0 });
            tbs.accuracy = totals.right / (totals.asked || 1);

            for (const q of questionsByType) {
                /*
                 * Clamped, because the buckets are 2 to 5 and "6 or more" and
                 * a premise count is not obliged to land in them.
                 *
                 * Relational Web states nothing in words — its premises *are*
                 * the picture — so its items carry a premise list of length
                 * zero, and `stats["0"]` is undefined. Reading `.sum` off it
                 * threw, which took the whole stats page down for anyone whose
                 * history contained a single web answer. The drawn modes have
                 * no meaningful premise count at all, so the smallest bucket is
                 * as good a home as any; what matters is that the page renders.
                 */
                const n = Math.max(2, Math.min(6, q.premises.length));
                const ps = (n < 6 ? String(n) : "6+") as "2" | "3" | "4" | "5" | "6+";
    
                const dt = q.answeredAt - q.createdAt;
    
                tbs.stats[ps].sum += dt;
                tbs.stats[ps].count++;

                // Conclusions, for the same reason as the accuracy above.
                const t = itemTally(q);
                if (t.timedOut) {
                    tbs.stats[ps].timeout++;
                } else {
                    tbs.stats[ps].correct += t.right;
                    tbs.stats[ps].incorrect += t.asked - t.right;
                }
    
                if (q.userAnswer !== undefined) {
                    if (tbs.stats[ps].fastest === 0 || dt < tbs.stats[ps].fastest) {
                        tbs.stats[ps].fastest = dt;
                    }
                    if (tbs.stats[ps].slowest === 0 || dt > tbs.stats[ps].slowest) {
                        tbs.stats[ps].slowest = dt;
                    }
                }

                // Calculate last 10 questions stats
                if (tbs.stats[ps].last10Count < 10) {
                    tbs.stats[ps].last10Sum += dt;
                    tbs.stats[ps].last10Count++;

                    if (t.timedOut) {
                        tbs.stats[ps].last10Timeout++;
                    } else {
                        tbs.stats[ps].last10Correct += t.right;
                        tbs.stats[ps].last10Incorrect += t.asked - t.right;
                    }
        
                    if (q.userAnswer !== undefined) {
                        if (tbs.stats[ps].last10Fastest === 0 || dt < tbs.stats[ps].last10Fastest) {
                            tbs.stats[ps].last10Fastest = dt;
                        }
                        if (tbs.stats[ps].last10Slowest === 0 || dt > tbs.stats[ps].last10Slowest) {
                            tbs.stats[ps].last10Slowest = dt;
                        }
                    }
                }
            };
        }

        console.log("Stats", { types, typeBasedStats });

        return { types, questions, typeBasedStats: jsonCopy(typeBasedStats) as TypeBasedStats};
    }
}