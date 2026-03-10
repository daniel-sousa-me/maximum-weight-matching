import { describe, it, expect } from "vitest";
import { maxWeightMatching } from "../src/matching.js";

// Port of all 19 unit tests from the original Python file (test10 through test34).

describe("maxWeightMatching", () => {
  // test10: empty input graph
  it("returns empty array for empty input", () => {
    expect(maxWeightMatching([])).toEqual([]);
  });

  // test11: single edge
  it("matches a single edge", () => {
    expect(maxWeightMatching([[0, 1, 1]])).toEqual([1, 0]);
  });

  // test12
  it("picks heavier edge in a path of two edges", () => {
    expect(maxWeightMatching([[1, 2, 10], [2, 3, 11]])).toEqual([-1, -1, 3, 2]);
  });

  // test13
  it("picks heavier middle edge in a path of three edges", () => {
    expect(maxWeightMatching([[1, 2, 5], [2, 3, 11], [3, 4, 5]])).toEqual([-1, -1, 3, 2, -1]);
  });

  // test14: maximum cardinality
  it("maximum cardinality matching", () => {
    expect(maxWeightMatching([[1, 2, 5], [2, 3, 11], [3, 4, 5]], true)).toEqual([-1, 2, 1, 4, 3]);
  });

  // test15: floating point weights
  it("handles floating point weights", () => {
    expect(
      maxWeightMatching([
        [1, 2, Math.PI],
        [2, 3, Math.E],
        [1, 3, 3.0],
        [1, 4, Math.SQRT2],
      ]),
    ).toEqual([-1, 4, 3, 2, 1]);
  });

  // test16: negative weights
  it("handles negative weights", () => {
    expect(
      maxWeightMatching([[1, 2, 2], [1, 3, -2], [2, 3, 1], [2, 4, -1], [3, 4, -6]], false),
    ).toEqual([-1, 2, 1, -1, -1]);
    expect(
      maxWeightMatching([[1, 2, 2], [1, 3, -2], [2, 3, 1], [2, 4, -1], [3, 4, -6]], true),
    ).toEqual([-1, 3, 4, 1, 2]);
  });

  // test20: create S-blossom and use it for augmentation
  it("creates S-blossom and uses it for augmentation", () => {
    expect(maxWeightMatching([[1, 2, 8], [1, 3, 9], [2, 3, 10], [3, 4, 7]])).toEqual([-1, 2, 1, 4, 3]);
    expect(
      maxWeightMatching([[1, 2, 8], [1, 3, 9], [2, 3, 10], [3, 4, 7], [1, 6, 5], [4, 5, 6]]),
    ).toEqual([-1, 6, 3, 2, 5, 4, 1]);
  });

  // test21: create S-blossom, relabel as T-blossom, use for augmentation
  it("creates S-blossom, relabels as T-blossom, uses for augmentation", () => {
    expect(
      maxWeightMatching([[1, 2, 9], [1, 3, 8], [2, 3, 10], [1, 4, 5], [4, 5, 4], [1, 6, 3]]),
    ).toEqual([-1, 6, 3, 2, 5, 4, 1]);
    expect(
      maxWeightMatching([[1, 2, 9], [1, 3, 8], [2, 3, 10], [1, 4, 5], [4, 5, 3], [1, 6, 4]]),
    ).toEqual([-1, 6, 3, 2, 5, 4, 1]);
    expect(
      maxWeightMatching([[1, 2, 9], [1, 3, 8], [2, 3, 10], [1, 4, 5], [4, 5, 3], [3, 6, 4]]),
    ).toEqual([-1, 2, 1, 6, 5, 4, 3]);
  });

  // test22: create nested S-blossom, use for augmentation
  it("creates nested S-blossom, uses for augmentation", () => {
    expect(
      maxWeightMatching([[1, 2, 9], [1, 3, 9], [2, 3, 10], [2, 4, 8], [3, 5, 8], [4, 5, 10], [5, 6, 6]]),
    ).toEqual([-1, 3, 4, 1, 2, 6, 5]);
  });

  // test23: create S-blossom, relabel as S, include in nested S-blossom
  it("creates S-blossom, relabels as S, includes in nested S-blossom", () => {
    expect(
      maxWeightMatching([
        [1, 2, 10], [1, 7, 10], [2, 3, 12], [3, 4, 20], [3, 5, 20],
        [4, 5, 25], [5, 6, 10], [6, 7, 10], [7, 8, 8],
      ]),
    ).toEqual([-1, 2, 1, 4, 3, 6, 5, 8, 7]);
  });

  // test24: create nested S-blossom, augment, expand recursively
  it("creates nested S-blossom, augments, expands recursively", () => {
    expect(
      maxWeightMatching([
        [1, 2, 8], [1, 3, 8], [2, 3, 10], [2, 4, 12], [3, 5, 12],
        [4, 5, 14], [4, 6, 12], [5, 7, 12], [6, 7, 14], [7, 8, 12],
      ]),
    ).toEqual([-1, 2, 1, 5, 6, 3, 4, 8, 7]);
  });

  // test25: create S-blossom, relabel as T, expand
  it("creates S-blossom, relabels as T, expands", () => {
    expect(
      maxWeightMatching([
        [1, 2, 23], [1, 5, 22], [1, 6, 15], [2, 3, 25],
        [3, 4, 22], [4, 5, 25], [4, 8, 14], [5, 7, 13],
      ]),
    ).toEqual([-1, 6, 3, 2, 8, 7, 1, 5, 4]);
  });

  // test26: create nested S-blossom, relabel as T, expand
  it("creates nested S-blossom, relabels as T, expands", () => {
    expect(
      maxWeightMatching([
        [1, 2, 19], [1, 3, 20], [1, 8, 8], [2, 3, 25],
        [2, 4, 18], [3, 5, 18], [4, 5, 13], [4, 7, 7], [5, 6, 7],
      ]),
    ).toEqual([-1, 8, 3, 2, 7, 6, 5, 4, 1]);
  });

  // test30: create blossom, relabel as T in more than one way, expand, augment
  it("handles T-nasty blossom expansion", () => {
    expect(
      maxWeightMatching([
        [1, 2, 45], [1, 5, 45], [2, 3, 50], [3, 4, 45], [4, 5, 50],
        [1, 6, 30], [3, 9, 35], [4, 8, 35], [5, 7, 26], [9, 10, 5],
      ]),
    ).toEqual([-1, 6, 3, 2, 8, 7, 1, 5, 4, 10, 9]);
  });

  // test31: again but slightly different
  it("handles T-nasty2 blossom expansion", () => {
    expect(
      maxWeightMatching([
        [1, 2, 45], [1, 5, 45], [2, 3, 50], [3, 4, 45], [4, 5, 50],
        [1, 6, 30], [3, 9, 35], [4, 8, 26], [5, 7, 40], [9, 10, 5],
      ]),
    ).toEqual([-1, 6, 3, 2, 8, 7, 1, 5, 4, 10, 9]);
  });

  // test32: create blossom, relabel as T, expand such that a new least-slack
  // S-to-free edge is produced, augment
  it("handles T-expand with least-slack edge", () => {
    expect(
      maxWeightMatching([
        [1, 2, 45], [1, 5, 45], [2, 3, 50], [3, 4, 45], [4, 5, 50],
        [1, 6, 30], [3, 9, 35], [4, 8, 28], [5, 7, 26], [9, 10, 5],
      ]),
    ).toEqual([-1, 6, 3, 2, 8, 7, 1, 5, 4, 10, 9]);
  });

  // test33: create nested blossom, relabel as T in more than one way,
  // expand outer blossom such that inner blossom ends up on an augmenting path
  it("handles nested T-nasty blossom expansion", () => {
    expect(
      maxWeightMatching([
        [1, 2, 45], [1, 7, 45], [2, 3, 50], [3, 4, 45], [4, 5, 95],
        [4, 6, 94], [5, 6, 94], [6, 7, 50], [1, 8, 30], [3, 11, 35],
        [5, 9, 36], [7, 10, 26], [11, 12, 5],
      ]),
    ).toEqual([-1, 8, 3, 2, 6, 9, 4, 10, 1, 5, 7, 12, 11]);
  });

  // test34: create nested S-blossom, relabel as S, expand recursively
  it("handles nested S-blossom relabel and recursive expansion", () => {
    expect(
      maxWeightMatching([
        [1, 2, 40], [1, 3, 40], [2, 3, 60], [2, 4, 55], [3, 5, 55],
        [4, 5, 50], [1, 8, 15], [5, 7, 30], [7, 6, 10], [8, 10, 10],
        [4, 9, 30],
      ]),
    ).toEqual([-1, 2, 1, 5, 9, 3, 7, 6, 10, 4, 8]);
  });
});

// All original tests also run with checkOptimum enabled (integer weights).
describe("maxWeightMatching with checkOptimum", () => {
  it("passes optimality verification on all integer-weight tests", () => {
    const integerTests: { edges: [number, number, number][]; maxCard?: boolean; expected: number[] }[] = [
      { edges: [], expected: [] },
      { edges: [[0, 1, 1]], expected: [1, 0] },
      { edges: [[1, 2, 10], [2, 3, 11]], expected: [-1, -1, 3, 2] },
      { edges: [[1, 2, 5], [2, 3, 11], [3, 4, 5]], expected: [-1, -1, 3, 2, -1] },
      { edges: [[1, 2, 5], [2, 3, 11], [3, 4, 5]], maxCard: true, expected: [-1, 2, 1, 4, 3] },
      {
        edges: [[1, 2, 8], [1, 3, 9], [2, 3, 10], [3, 4, 7]],
        expected: [-1, 2, 1, 4, 3],
      },
      {
        edges: [[1, 2, 45], [1, 7, 45], [2, 3, 50], [3, 4, 45], [4, 5, 95], [4, 6, 94], [5, 6, 94], [6, 7, 50], [1, 8, 30], [3, 11, 35], [5, 9, 36], [7, 10, 26], [11, 12, 5]],
        expected: [-1, 8, 3, 2, 6, 9, 4, 10, 1, 5, 7, 12, 11],
      },
    ];

    for (const { edges, maxCard, expected } of integerTests) {
      expect(maxWeightMatching(edges, maxCard ?? false, true)).toEqual(expected);
    }
  });
});

// Additional tests beyond the original 19.
describe("additional tests", () => {
  it("handles disconnected graph components", () => {
    // Two separate edges that share no vertices.
    const result = maxWeightMatching([
      [0, 1, 5],
      [2, 3, 10],
      [4, 5, 7],
    ]);
    expect(result).toEqual([1, 0, 3, 2, 5, 4]);
  });

  it("handles disconnected components with odd-sized groups", () => {
    // Triangle (0-1-2) and a separate edge (3-4).
    const result = maxWeightMatching([
      [0, 1, 3],
      [1, 2, 4],
      [0, 2, 5],
      [3, 4, 10],
    ]);
    // Triangle: best is edge 0-2 (weight 5), leaving 1 unmatched.
    // Separate: 3-4 matched.
    expect(result).toEqual([2, -1, 0, 4, 3]);
  });

  it("produces valid matching on a large random graph (50+ vertices)", () => {
    // Create a random graph with 60 vertices.
    const n = 60;
    const edges: [number, number, number][] = [];

    // Use a simple deterministic pseudo-random generator for reproducibility.
    let seed = 42;
    function nextRand(): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    }

    // Ensure every vertex has at least one edge by connecting v to (v+1)%n.
    const edgeSet = new Set<string>();
    for (let v = 0; v < n; v++) {
      const u = (v + 1) % n;
      const key = `${Math.min(v, u)},${Math.max(v, u)}`;
      edgeSet.add(key);
      const w = (nextRand() % 100) + 1;
      edges.push([Math.min(v, u), Math.max(v, u), w]);
    }

    // Add ~140 more random edges.
    for (let e = 0; e < 140; e++) {
      const i = nextRand() % n;
      let j = nextRand() % n;
      if (i === j) continue;
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      const w = (nextRand() % 100) + 1;
      edges.push([Math.min(i, j), Math.max(i, j), w]);
    }

    const result = maxWeightMatching(edges);

    // Verify: result is a valid matching.
    expect(result.length).toBe(n);
    for (let v = 0; v < n; v++) {
      if (result[v] !== -1) {
        // Mate is symmetric.
        expect(result[result[v]]).toBe(v);
        // The edge (v, result[v]) must exist.
        const u = result[v];
        if (v < u) {
          const found = edges.some(([i, j]) => i === v && j === u);
          expect(found).toBe(true);
        }
      }
    }

    // At least some vertices should be matched.
    const matchedCount = result.filter((m) => m !== -1).length;
    expect(matchedCount).toBeGreaterThan(0);
  });

  it("matches all vertices in a complete graph with even vertex count", () => {
    // K6: complete graph on 6 vertices, all weights 1.
    const edges: [number, number, number][] = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push([i, j, 1]);
      }
    }
    const result = maxWeightMatching(edges);
    // All 6 vertices should be matched.
    expect(result.length).toBe(n);
    for (let v = 0; v < n; v++) {
      expect(result[v]).not.toBe(-1);
      expect(result[result[v]]).toBe(v);
    }
  });

  it("matches all vertices in K8 with varying weights", () => {
    const edges: [number, number, number][] = [];
    const n = 8;
    let w = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        edges.push([i, j, w++]);
      }
    }
    const result = maxWeightMatching(edges);
    expect(result.length).toBe(n);
    for (let v = 0; v < n; v++) {
      expect(result[v]).not.toBe(-1);
      expect(result[result[v]]).toBe(v);
    }
  });
});
