/**
 * Run the suite across several processes.
 *
 * The suite is the thing this repo is run on most, and it had grown to five and
 * a half minutes — paid after every edit, which is how a suite stops being run
 * after every edit. Nothing about it is slow *per case*; there are simply a lot
 * of modes now, and the broad checks walk every one of them.
 *
 * ── Split by file, not by case ──
 *
 * Round-robin over cases would balance better, and it would also split a file's
 * cases across processes. The harness has no setup or teardown, so a file whose
 * cases share state — a storage shim written by one and read by the next — would
 * break in a way that looked like a real failure and would not reproduce serially.
 * Whole files keep every case in the order and the process it was written for.
 *
 * Round-robin over *files* rather than contiguous blocks, because the slow ones
 * cluster: the generator-wide checks sit together in the import list, and a
 * contiguous split would put them all in one shard and leave the others idle.
 *
 * ── What it does not change ──
 *
 * `TEST_FILTER` still works and still runs in one process, because a filtered run
 * is already seconds and splitting it would cost more in startup than it saved.
 * The exit code is still non-zero if anything failed, and every shard's output is
 * printed whole rather than interleaved, so a failure reads the same as it always
 * did.
 */

import { spawn } from "child_process";
import { readFileSync } from "fs";
import { cpus } from "os";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}.tmp-tests/tests`;

/** The test files, in the order `tests/index.ts` imports them. */
function files() {
    const index = readFileSync(`${ROOT}tests/index.ts`, "utf8");
    const named = [...index.matchAll(/^import\s+"\.\/([\w.-]+)";/gm)].map(m => m[1]);
    /*
     * Deduplicated, and not as tidiness.
     *
     * A file imported twice is loaded once serially — the module cache sees to
     * that — so a duplicate is invisible until the suite is split, at which point
     * the two copies land in different processes and its cases run twice. The
     * first sharded run reported forty-seven more cases than the serial one for
     * exactly that reason. `tests/index.test.ts` now stops the duplicates at
     * source; this stops them mattering.
     */
    return [...new Set(named)];
}

/** One shard's share, taking every `count`th file from `at`. */
const share = (all, at, count) => all.filter((_, i) => i % count === at);

function runShard(group, at) {
    /*
     * Required rather than imported: the compiled tests are CommonJS, and the
     * harness collects cases as a side effect of loading them, so the order they
     * are required in is the order they run in.
     */
    const script = [
        ...group.map(f => `require(${JSON.stringify(`${OUT}/${f}.js`)});`),
        `require(${JSON.stringify(`${OUT}/harness.js`)}).run();`,
    ].join("\n");

    return new Promise(resolve => {
        const child = spawn(process.execPath, ["-e", script], {
            env: { ...process.env, NODE_PATH: `${ROOT}.tmp-tests` },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "";
        child.stdout.on("data", d => { out += d; });
        child.stderr.on("data", d => { out += d; });
        child.on("close", code => resolve({ at, out, code }));
    });
}

/*
 * A filtered run stays in one process.
 *
 * `TEST_FILTER` is for iterating on one thing and already takes seconds, so
 * splitting it would spend more on starting processes than it saved — and the
 * per-shard "N of M cases" lines would each report a different M, which reads as
 * though the filter had matched different things in different places.
 */
if (process.env.TEST_FILTER) {
    const one = spawn(process.execPath, [`${OUT}/index.js`], {
        env: { ...process.env, NODE_PATH: `${ROOT}.tmp-tests` },
        stdio: "inherit",
    });
    one.on("close", code => process.exit(code ?? 1));
} else {
    await shardedRun();
}

async function shardedRun() {
const all = files();
if (!all.length) {
    console.error("no test files found in tests/index.ts");
    process.exit(1);
}

/*
 * Half again as many processes as cores.
 *
 * One per core assumes the files cost about the same, and they do not — the checks
 * that walk every mode sit in four files at thirty seconds each, so a four-way
 * split put two of them in one shard and left another idle: 212s against 344s
 * serial. More groups make that mistake smaller and let the scheduler do the
 * balancing.
 *
 * Measured on four cores: six shards 132s, twelve 133s, eight 158s. The spread is
 * noise rather than a curve — eight being worse than twelve cannot be anything
 * else — so this takes the fewest processes that reached the floor, which also
 * costs the least memory. Overridable, because the right number is a fact about
 * the machine and not about the suite.
 */
const count = Math.max(1, Math.min(
    Number(process.env.TEST_SHARDS) || Math.ceil(cpus().length * 1.5), all.length));
const started = Date.now();

const results = await Promise.all(
    [...Array(count).keys()].map(at => runShard(share(all, at, count), at)));

let passed = 0, ran = 0, failed = 0;
for (const r of results.sort((a, b) => a.at - b.at)) {
    /* Each shard's own summary line is dropped and the totals re-added at the
       end: four "180/180 passed" lines read like four separate suites. */
    for (const line of r.out.split("\n")) {
        const summary = line.match(/^(\d+)\/(\d+) passed in/);
        if (summary) {
            passed += Number(summary[1]);
            ran += Number(summary[2]);
            continue;
        }
        if (/^\s*slowest:/.test(line)) break;
        if (line.trim()) console.log(line);
    }
    if (r.code !== 0) failed = 1;
}

const wall = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${passed}/${ran} passed in ${wall}s across ${count} processes`);
process.exit(failed);
}
