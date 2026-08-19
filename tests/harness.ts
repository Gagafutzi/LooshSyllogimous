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

/*
 * A document, for the one service that writes to it.
 *
 * ThemeService resolves a theme into custom properties and sets them on
 * <html>. What is worth testing is the *values* it resolves — a dimension
 * colour that is a plain hex rather than an expression the stylesheet might
 * drop — so the write target is stubbed rather than the resolution mocked.
 */
if (typeof (globalThis as any).document === "undefined") {
    const props = new Map<string, string>();
    (globalThis as any).document = {
        documentElement: {
            style: {
                setProperty: (k: string, v: string) => { props.set(k, v); },
                getPropertyValue: (k: string) => props.get(k) ?? "",
            },
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        },
    };
}

/**
 * A test may be async.
 *
 * Anything that settles a promise needs one microtask before the result is
 * visible, and the timer service is exactly that: whether the clock ran out or
 * was stopped arrives through a promise, which is the distinction under test.
 */
type Case = { name: string; fn: () => void | Promise<void> };

const cases: Case[] = [];

export function test(name: string, fn: () => void | Promise<void>) {
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

export async function run() {
    let failed = 0;
    for (const c of cases) {
        try {
            await c.fn();
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

/** Let pending promise callbacks run, for tests that settle one. */
export const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
