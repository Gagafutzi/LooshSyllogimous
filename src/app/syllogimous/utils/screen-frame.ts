/**
 * The compass rewritten as the screen: up, down, left, right.
 *
 * `direction.ts` writes "North", "South", "East" and "West" as literals in
 * eight places, so this converts the finished item rather than threading a
 * frame through the generator. Same trade `symboliseStatement` makes, and for
 * the same reason: the strings are what everything downstream reads, and
 * converting them once cannot miss a site the way eight edits can.
 *
 * Object names are protected. Everything inside a `subject` span is left alone,
 * so an object called North is never rewritten into a direction.
 */

const FRAME: Record<string, string> = {
    north: "up", south: "down", east: "right", west: "left",
};

const WORDS = new RegExp("\\b(" + Object.keys(FRAME).join("|") + ")\\b", "gi");

/** Keeps the casing the card was written in. */
function swap(word: string): string {
    const to = FRAME[word.toLowerCase()];
    if (!to) return word;
    if (word[0] === word[0].toUpperCase()) return to[0].toUpperCase() + to.slice(1);
    return to;
}

export function toScreenFrame(text: string): string {
    if (!text) return text;
    return text
        .split(/(<span class="subject">[\s\S]*?<\/span>)/)
        .map((part, i) => (i % 2 ? part : part.replace(WORDS, swap)))
        .join("");
}
