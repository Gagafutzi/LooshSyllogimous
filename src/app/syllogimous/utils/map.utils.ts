/**
 * The coordinates of an item, arranged for drawing.
 *
 * Ported in spirit from Syllogimous v3's `explanation.js`, which took a
 * word→coordinate map and laid it out as a grid: two dimensions as a table,
 * three as stacked planes, four as a row of those. That picture is the thing v3
 * had and this did not — a derivation tells you *how* the answer follows, and a
 * map shows you *where everything was*, which is the part people reconstruct on
 * paper when they get one wrong.
 *
 * Two departures from the original.
 *
 * It returns data rather than an HTML string, so the drawing is a template and
 * this is testable without a browser. And it does not stop at four dimensions:
 * v3 hardcoded "Time N" for the fourth axis, while the composed spaces here go
 * to six, so any axis past the third becomes a labelled slice using the axis's
 * own name.
 */

/** A cell holds every word at that coordinate — two can share one. */
export type MapCell = string[];

export interface MapPlane {
    /** Empty for a flat map; the third axis's value otherwise. */
    label: string;
    /** Row-major, bottom row last: higher coordinates are drawn higher up. */
    rows: MapCell[][];
}

export interface MapSlice {
    /** Empty when the map has three dimensions or fewer. */
    label: string;
    planes: MapPlane[];
}

/**
 * Every object's position, one row each, one column per axis.
 *
 * What a map above three axes has to be. The grid form draws the fourth axis
 * and beyond as *slices* — one small picture per combination of the remaining
 * axes — which is sixteen pictures at five axes and a few dozen at six, before
 * the reader has found the one that matters. That is not a rendering bug to
 * tidy: small multiples over three free axes is a Cartesian product, and
 * fixing the label collisions would produce a legible version of a picture that
 * should not be drawn.
 *
 * A table is readable at any dimensionality, and it is what people reconstruct
 * on paper when an item beats them.
 */
export interface MapTable {
    axes: string[];
    /**
     * The object everything else is measured from.
     *
     * Coordinates are stated relative to it, because that is all the premises
     * determine: they chain offsets, so the arrangement is fixed only up to
     * where the chain is pinned. Transformation's derivation already states
     * coordinates this way and records why it is safe.
     */
    origin: string;
    rows: Array<{ word: string; coords: number[] }>;
}

export interface QuestionMap {
    dims: number;
    /** Names for the drawn axes: across, up, through. */
    across: string;
    up: string;
    slices: MapSlice[];
    /**
     * Set instead of `slices` above three axes, where the grid stops working.
     *
     * Both are never populated: a screen showing a table *and* thirty unreadable
     * grids has not replaced anything.
     */
    table: MapTable | null;
}

/** Coordinates keyed by word, one entry per axis. */
export type CoordMap = Record<string, number[]>;

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Which object the frame is pinned to.
 *
 * The one already at the origin if there is one — the generators put the first
 * object there — and otherwise the first listed, so the choice is stable rather
 * than arbitrary. It only shifts the whole frame, which is safe: every relation
 * the premises state is between two objects and moves with them.
 */
function pickOrigin(list: Array<[string, number[]]>): string {
    const zeroed = list.find(([, c]) => c.every(v => v === 0));
    return (zeroed ?? list[0])[0];
}

const entries = (map: CoordMap) =>
    Object.entries(map).filter(([, c]) => Array.isArray(c) && c.length);

/**
 * One frame wide enough for all of them.
 *
 * The whole point of drawing several structures together is that they can be
 * read against each other, and that only works if the grid means the same thing
 * in every picture.
 */
export function sharedExtent(maps: CoordMap[]): Array<[number, number]> {
    const all = maps.flatMap(m => entries(m).map(([, c]) => c));
    return all.length ? extent(all) : [];
}

/**
 * Bounds per axis.
 *
 * Computed rather than assumed, because a layout is only ever a handful of
 * points in a much larger space and drawing the whole space would be mostly
 * empty cells.
 */
function extent(coords: number[][]): Array<[number, number]> {
    const dims = Math.max(...coords.map(c => c.length));
    return Array.from({ length: dims }, (_, i) => {
        const values = coords.map(c => c[i] ?? 0);
        return [Math.min(...values), Math.max(...values)] as [number, number];
    });
}

/**
 * Lay a coordinate map out for drawing.
 *
 * Axis 0 runs across, axis 1 runs up, axis 2 becomes a stack of planes, and
 * anything further becomes slices labelled with the axis name and value —
 * "later 2", "wider 1" — since there is no fourth spatial direction to borrow.
 */
export function buildQuestionMap(
    map: CoordMap,
    axisNames: string[] = [],
    /**
     * A frame to draw inside, instead of one fitted to this map alone.
     *
     * Needed whenever two maps are to be *compared*. Fitted separately, a
     * structure and the same structure shifted two east both fill their own
     * grid corner to corner and look identical — the change is in where they
     * sit, and a grid that moves with them cannot show it.
     */
    bounds = extent(entries(map).map(([, c]) => c)),
): QuestionMap | null {
    const list = entries(map);
    if (!list.length) return null;
    const dims = bounds.length;
    const name = (i: number) => axisNames[i] ?? `axis ${i + 1}`;

    /*
     * Above three axes the grid becomes a Cartesian product of slices, so the
     * table replaces it rather than joining it. Three and below keep the grid,
     * which is genuinely better than a table when the axes can be *seen* — that
     * is what it is for, and it stops being true the moment they cannot be.
     */
    if (dims > 3) {
        const origin = pickOrigin(list);
        const base = map[origin] ?? [];
        return {
            dims,
            across: name(0),
            up: dims > 1 ? name(1) : "",
            slices: [],
            table: {
                axes: bounds.map((_, i) => name(i)),
                origin,
                // Origin first: a frame with nothing marking it is a column of
                // numbers measured from somewhere the reader has to work out.
                rows: [origin, ...list.map(([w]) => w).filter(w => w !== origin)]
                    .map(word => ({
                        word,
                        coords: bounds.map((_, i) => (map[word][i] ?? 0) - (base[i] ?? 0)),
                    })),
            },
        };
    }

    const [ax, ay, az] = bounds;
    const columns = range(ax[0], ax[1]);
    // Drawn top-down, so the highest coordinate is the first row.
    const rows = dims > 1 ? range(ay[0], ay[1]).reverse() : [0];
    const planes = dims > 2 ? range(az[0], az[1]) : [0];

    /** Every combination of the axes past the third, as slices. */
    const outer = bounds.slice(3);
    const combos: number[][] = outer.reduce<number[][]>(
        (acc, [lo, hi]) => acc.flatMap(prefix => range(lo, hi).map(v => [...prefix, v])),
        [[]]);

    const at = (want: number[]) => list
        .filter(([, c]) => want.every((v, i) => (c[i] ?? 0) === v))
        .map(([word]) => word);

    const slices: MapSlice[] = combos.map(combo => ({
        label: combo
            .map((v, i) => `${name(i + 3)} ${v}`)
            .join(" · "),
        planes: planes.map(z => ({
            label: dims > 2 ? `${name(2)} ${z}` : "",
            rows: rows.map(y => columns.map(x => {
                const want = dims > 2 ? [x, y, z, ...combo] : dims > 1 ? [x, y] : [x];
                return at(want);
            })),
        })),
    }));

    return { dims, across: name(0), up: dims > 1 ? name(1) : "", slices, table: null };
}

/**
 * A one-axis layout, as a coordinate map.
 *
 * The linear family stores a single position per word; the map machinery wants
 * a vector, and a one-element one draws as a single row.
 */
export function coordMapFromPositions(pos: Record<string, number>): CoordMap {
    return Object.fromEntries(Object.entries(pos).map(([w, p]) => [w, [p]]));
}

/** The v3-era tuple form: [word, x, y] or [word, x, y, t]. */
export function coordMapFromTuples(tuples: Array<[string, ...number[]]>): CoordMap {
    return Object.fromEntries(tuples.map(([word, ...coord]) => [word, coord]));
}
