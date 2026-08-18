/**
 * A test runner in thirty lines, because that is all this needs.
 *
 * No jasmine, no karma, no browser. Tests register themselves by calling
 * `test()` at module load; `run()` executes them and exits non-zero on the
 * first failure count above zero, which is all CI or a human needs to know.
 *
 * Deliberately dependency-free: the value of these tests is that they cost one
 * command and a couple of seconds, and every dependency added is a reason for
 * them to stop working on a machine that has not run `npm install` lately.
 */

/*
 * A localStorage, for the services that persist settings.
 *
 * No *generator* needs it any more — the last one that reached past its
 * context for the syllogism algorithm now takes it as a member — but
 * ProgressionService, SettingsOverrideService and KeybindService are all
 * storage-backed by design, and they are tested directly.
 */
if (typeof (globalThis as any).localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => store.has(k) ? store.get(k)! : null,
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
    };
}

type Case = { name: string; fn: () => void };

const cases: Case[] = [];

export function test(name: string, fn: () => void) {
    cases.push({ name, fn });
}

export function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message);
}

export function equal<T>(actual: T, expected: T, message = "") {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${message}\n  expected: ${e}\n  actual:   ${a}`);
}

/** Deterministic Math.random, so a generator test cannot flake. */
export function seeded<T>(seed: number, fn: () => T): T {
    const original = Math.random;
    let state = seed >>> 0;
    Math.random = () => {
        // xorshift32 — small, fast, and good enough to drive a generator.
        state ^= state << 13; state >>>= 0;
        state ^= state >> 17;
        state ^= state << 5; state >>>= 0;
        return state / 0x100000000;
    };
    try { return fn(); } finally { Math.random = original; }
}

export function run() {
    let failed = 0;
    for (const c of cases) {
        try {
            c.fn();
            console.log(`  ok   ${c.name}`);
        } catch (e) {
            failed++;
            console.log(`  FAIL ${c.name}`);
            console.log(`       ${(e as Error).message.split("\n").join("\n       ")}`);
        }
    }
    console.log(`\n${cases.length - failed}/${cases.length} passed`);
    if (failed) process.exit(1);
}
