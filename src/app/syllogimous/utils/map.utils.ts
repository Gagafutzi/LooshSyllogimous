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

export interface QuestionMap {
    dims: number;
    /** Names for the drawn axes: across, up, through. */
    across: string;
    up: string;
    slices: MapSlice[];
}

/** Coordinates keyed by word, one entry per axis. */
export type CoordMap = Record<string, number[]>;

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

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

    return { dims, across: name(0), up: dims > 1 ? name(1) : "", slices };
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
