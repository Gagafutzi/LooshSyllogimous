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
 * ── One file per process, handed out by a queue ──
 *
 * This dealt the files out round-robin at first, and that was a **guess about the
 * schedule dressed up as a policy**. Four files carry nearly the whole suite —
 * `combinations` at 73s and `registries` at 58s against a tenth of a second for
 * most — so the wall time is whichever shard happens to collect two of them, and
 * which shard that is depends on the *stride*. Adding one file anywhere in
 * `tests/index.ts` shifts every later file by one: a mode added at the end of the
 * list put 73s and 58s in the same shard and took the suite from 132s to 229s,
 * with nothing about the suite having changed.
 *
 * So nothing is dealt in advance. Each process takes one file, runs it, and the
 * next free process takes the next — so the wall time cannot be worse than the
 * longest single file plus one file's share of the rest, whatever order the index
 * is in. The 106 extra process startups cost about 150ms each and are spread over
 * every worker: a few seconds, against the tens the packing used to lose. Same
 * suite, same machine: 229s dealt in advance, 122s taken off a queue.
 *
 * What is left is the machine rather than the schedule. Four cores running six
 * processes means the two long files slow each other down, so 122s is near the
 * floor here and no arrangement of the same files beats it by much. The point of
 * the queue is not the seconds — it is that adding a file can no longer cost
 * ninety of them.
 *
 * Long files are handed out first where their cost is known, from a note the last
 * run left in `.tmp-tests`. That is an optimisation and not a requirement — with
 * no note at all the queue still cannot put two long files in one process, it can
 * only start a long one late.
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
import { readFileSync, writeFileSync } from "fs";
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

/** Where the last run's per-file times are kept. Ephemeral, and never required. */
const TIMINGS = `${ROOT}.tmp-tests/.shard-timings.json`;

/**
 * What each file cost last time, as far as anything knows.
 *
 * A missing or stale note is not a problem, only a smaller saving: an unknown file
 * is dealt in the middle of the order, and the queue below is what actually keeps
 * the shards even. Kept in `.tmp-tests` rather than committed — it is a fact about
 * this machine, and a file that changed on every test run would put a diff in
 * every commit.
 */
function knownCosts() {
    try { return JSON.parse(readFileSync(TIMINGS, "utf8")); } catch { return {}; }
}

function runFile(file) {
    /*
     * Required rather than imported: the compiled tests are CommonJS, and the
     * harness collects cases as a side effect of loading them, so the order they
     * are required in is the order they run in.
     */
    const script = [
        `require(${JSON.stringify(`${OUT}/${file}.js`)});`,
        `require(${JSON.stringify(`${OUT}/harness.js`)}).run();`,
    ].join("\n");

    const started = Date.now();
    return new Promise(resolve => {
        const child = spawn(process.execPath, ["-e", script], {
            env: { ...process.env, NODE_PATH: `${ROOT}.tmp-tests` },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let out = "";
        child.stdout.on("data", d => { out += d; });
        child.stderr.on("data", d => { out += d; });
        child.on("close", code =>
            resolve({ file, out, code, ms: Date.now() - started }));
    });
}

/** `count` workers, each taking the next file off the queue as it frees up. */
async function drain(queue, count) {
    const done = [];
    let next = 0;
    await Promise.all([...Array(count).keys()].map(async () => {
        while (next < queue.length) done.push(await runFile(queue[next++]));
    }));
    return done;
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

/* Dearest first, so a long file is never the one still running at the end. An
   unknown file sits between the known long and the known short. */
const costs = knownCosts();
const order = new Map(all.map((f, i) => [f, i]));
const queue = [...all].sort((a, b) =>
    (costs[b] ?? 1000) - (costs[a] ?? 1000) || order.get(a) - order.get(b));

const results = await drain(queue, count);
/* Printed in the order `tests/index.ts` names them, not the order they finished:
   a failure has to be findable in the same place every run. */
results.sort((a, b) => order.get(a.file) - order.get(b.file));

let passed = 0, ran = 0, failed = 0;
for (const r of results) {
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

/* What this run cost, for the next one to deal by. Best effort: a suite that
   cannot write here is a suite that packs slightly worse, not one that fails. */
try {
    writeFileSync(TIMINGS,
        JSON.stringify(Object.fromEntries(results.map(r => [r.file, r.ms]))));
} catch { /* nothing to do about it, and nothing depends on it */ }

const wall = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${passed}/${ran} passed in ${wall}s across ${count} processes`);
process.exit(failed);
}
