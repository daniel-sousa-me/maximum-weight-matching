# maximum-weight-matching

Compute maximum-weight matchings in general undirected weighted graphs using
Edmonds' blossom algorithm with Galil's primal-dual approach. O(n³) time complexity.

Ported from the Python implementation by Joris van Rantwijk, based on:

> Zvi Galil, "Efficient Algorithms for Finding Maximum Matching in Graphs",
> ACM Computing Surveys, 1986.

## Install

```
npm install maximum-weight-matching
```

## Usage

```typescript
import { maxWeightMatching } from "maximum-weight-matching";

// Edges are [vertex_i, vertex_j, weight] tuples.
const edges: [number, number, number][] = [
  [0, 1, 10],
  [1, 2, 11],
];

const mate = maxWeightMatching(edges);
// mate[v] is the vertex matched to v, or -1 if unmatched.
// => [-1, 2, 1]
```

### Max-cardinality mode

```typescript
const mate = maxWeightMatching(edges, true);
// Prefer more matched pairs even if total weight is lower.
```

### Optimality verification (integer weights only)

```typescript
const mate = maxWeightMatching(edges, false, true);
// Throws if the solution is not provably optimal.
```

## API

```typescript
function maxWeightMatching(
  edges: [number, number, number][],
  maxCardinality?: boolean,
  checkOptimum?: boolean,
): number[];
```

- **edges** — Array of `[i, j, weight]` tuples. Vertices are non-negative integers. At most one edge per pair. No self-edges.
- **maxCardinality** — If `true`, only maximum-cardinality matchings are considered.
- **checkOptimum** — If `true`, verify optimality before returning (integer weights only).
- **Returns** `mate` — Array where `mate[i]` is the vertex matched to `i`, or `-1` if unmatched.

## License

GPL-3.0
