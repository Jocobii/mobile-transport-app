const root = { name: "<root>", befores: [], afters: [], tests: [], children: [] };
let current = root;
let failures = 0;
let passed = 0;
export function describe(name, fn) {
  const node = { name, befores: [], afters: [], tests: [], children: [] };
  current.children.push(node);
  const parent = current;
  current = node;
  fn();
  current = parent;
}
export function beforeAll(fn) { current.befores.push(fn); }
export function afterAll(fn) { current.afters.push(fn); }
export function it(name, fn) { current.tests.push({ name, fn }); }
async function runNode(node, path) {
  for (const before of node.befores) await before();
  for (const test of node.tests) {
    const fullName = [...path, node.name, test.name].filter((p) => p && p !== "<root>").join(" > ");
    try {
      await test.fn();
      passed += 1;
      console.log(`  ok - ${fullName}`);
    } catch (err) {
      failures += 1;
      console.error(`  FAIL - ${fullName}`);
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    }
  }
  for (const child of node.children) await runNode(child, [...path, node.name]);
  for (const after of node.afters) await after();
}
export async function __run() {
  await runNode(root, []);
  console.log(`\n${passed} passed, ${failures} failed`);
  if (failures > 0) process.exitCode = 1;
}
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(a[k], b[k]));
}
export function expect(actual) {
  if (actual && typeof actual.then === "function") {
    return {
      rejects: {
        async toThrow(matcher) {
          let threw = false;
          let error;
          try { await actual; } catch (e) { threw = true; error = e; }
          if (!threw) throw new Error("expected promise to reject");
          if (matcher instanceof RegExp && !matcher.test(error instanceof Error ? error.message : String(error))) {
            throw new Error(`expected error message to match ${matcher}, got: ${error instanceof Error ? error.message : error}`);
          }
        },
      },
    };
  }
  return {
    toBe(expected) { if (!Object.is(actual, expected)) throw new Error(`expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); },
    toEqual(expected) { if (!deepEqual(actual, expected)) throw new Error(`expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
    toBeUndefined() { if (actual !== undefined) throw new Error(`expected ${JSON.stringify(actual)} to be undefined`); },
    toBeDefined() { if (actual === undefined) throw new Error("expected value to be defined"); },
    toBeNull() { if (actual !== null) throw new Error(`expected ${JSON.stringify(actual)} to be null`); },
    toBeTruthy() { if (!actual) throw new Error(`expected ${JSON.stringify(actual)} to be truthy`); },
    toBeFalsy() { if (actual) throw new Error(`expected ${JSON.stringify(actual)} to be falsy`); },
    toContain(item) { if (!actual.includes(item)) throw new Error(`expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`); },
    toBeGreaterThan(n) { if (!(actual > n)) throw new Error(`expected ${actual} to be > ${n}`); },
    toBeGreaterThanOrEqual(n) { if (!(actual >= n)) throw new Error(`expected ${actual} to be >= ${n}`); },
    toBeLessThan(n) { if (!(actual < n)) throw new Error(`expected ${actual} to be < ${n}`); },
    toBeLessThanOrEqual(n) { if (!(actual <= n)) throw new Error(`expected ${actual} to be <= ${n}`); },
    toHaveLength(n) { if (actual.length !== n) throw new Error(`expected length ${actual.length} to be ${n}`); },
    toBeInstanceOf(cls) { if (!(actual instanceof cls)) throw new Error(`expected value to be instance of ${cls.name}`); },
    toThrow(matcher) {
      let threw = false;
      let error;
      try { actual(); } catch (e) { threw = true; error = e; }
      if (!threw) throw new Error("expected function to throw");
      if (matcher instanceof RegExp && !matcher.test(error instanceof Error ? error.message : String(error))) {
        throw new Error(`expected error message to match ${matcher}, got: ${error instanceof Error ? error.message : error}`);
      }
    },
    not: { toBe(expected) { if (Object.is(actual, expected)) throw new Error(`expected ${JSON.stringify(actual)} not to be ${JSON.stringify(expected)}`); } },
  };
}

export const vi = {
  fn(impl) {
    const calls = [];
    function mockFn(...args) {
      calls.push(args);
      return impl ? impl(...args) : undefined;
    }
    mockFn.mock = { calls };
    return mockFn;
  },
};
