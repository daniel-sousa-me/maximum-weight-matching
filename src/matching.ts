/**
 * Weighted maximum matching in general graphs.
 *
 * The algorithm is taken from "Efficient Algorithms for Finding Maximum
 * Matching in Graphs" by Zvi Galil, ACM Computing Surveys, 1986.
 * It is based on the "blossom" method for finding augmenting paths and
 * the "primal-dual" method for finding a matching of maximum weight, both
 * due to Jack Edmonds.
 * Some ideas came from "Implementation of algorithms for maximum matching
 * on non-bipartite graphs" by H.J. Gabow, Standford Ph.D. thesis, 1973.
 *
 * A C program for maximum weight matching by Ed Rothberg was used extensively
 * to validate this new code.
 *
 * Ported from the Python implementation by Joris van Rantwijk.
 */

/** Access array with Python-style negative indexing. */
function at<T>(arr: readonly T[], i: number): T {
  return i >= 0 ? arr[i] : arr[arr.length + i];
}

/**
 * Compute a maximum-weighted matching in the general undirected
 * weighted graph given by "edges".  If "maxCardinality" is true,
 * only maximum-cardinality matchings are considered as solutions.
 *
 * Edges is a sequence of tuples (i, j, wt) describing an undirected
 * edge between vertex i and vertex j with weight wt.  There is at most
 * one edge between any two vertices; no vertex has an edge to itself.
 * Vertices are identified by consecutive, non-negative integers.
 *
 * Return a list "mate", such that mate[i] == j if vertex i is
 * matched to vertex j, and mate[i] == -1 if vertex i is not matched.
 *
 * This function takes time O(n ** 3).
 *
 * @param edges - Array of [i, j, weight] tuples describing edges.
 * @param maxCardinality - If true, only maximum-cardinality matchings
 *   are considered (prefer more matched pairs even if total weight is lower).
 * @param checkOptimum - If true, verify optimality of the solution before
 *   returning. Only works on integer weights.
 * @returns mate - Array where mate[i] is the vertex matched to i, or -1.
 */
export function maxWeightMatching(
  edges: [number, number, number][],
  maxCardinality: boolean = false,
  checkOptimum: boolean = false,
): number[] {
  //
  // Vertices are numbered 0 .. (nvertex-1).
  // Non-trivial blossoms are numbered nvertex .. (2*nvertex-1)
  //
  // Edges are numbered 0 .. (nedge-1).
  // Edge endpoints are numbered 0 .. (2*nedge-1), such that endpoints
  // (2*k) and (2*k+1) both belong to edge k.
  //
  // Many terms used in the comments (sub-blossom, T-vertex) come from
  // the paper by Galil; read the paper before reading this code.
  //

  // Deal swiftly with empty graphs.
  if (edges.length === 0) {
    return [];
  }

  // Count vertices.
  const nedge = edges.length;
  let nvertex = 0;
  for (const [i, j] of edges) {
    if (i >= nvertex) nvertex = i + 1;
    if (j >= nvertex) nvertex = j + 1;
  }

  // Find the maximum edge weight.
  let maxweight = 0;
  for (const [, , wt] of edges) {
    if (wt > maxweight) maxweight = wt;
  }

  // If p is an edge endpoint,
  // endpoint[p] is the vertex to which endpoint p is attached.
  // Not modified by the algorithm.
  const endpoint: number[] = new Array(2 * nedge);
  for (let p = 0; p < 2 * nedge; p++) {
    endpoint[p] = edges[p >> 1][p & 1];
  }

  // If v is a vertex,
  // neighbend[v] is the list of remote endpoints of the edges attached to v.
  // Not modified by the algorithm.
  const neighbend: number[][] = Array.from({ length: nvertex }, () => []);
  for (let k = 0; k < nedge; k++) {
    const [i, j] = edges[k];
    neighbend[i].push(2 * k + 1);
    neighbend[j].push(2 * k);
  }

  // If v is a vertex,
  // mate[v] is the remote endpoint of its matched edge, or -1 if it is single
  // (i.e. endpoint[mate[v]] is v's partner vertex).
  // Initially all vertices are single; updated during augmentation.
  const mate: number[] = new Array(nvertex).fill(-1);

  // If b is a top-level blossom,
  // label[b] is 0 if b is unlabeled (free);
  //             1 if b is an S-vertex/blossom;
  //             2 if b is a T-vertex/blossom.
  // The label of a vertex is found by looking at the label of its
  // top-level containing blossom.
  // If v is a vertex inside a T-blossom,
  // label[v] is 2 iff v is reachable from an S-vertex outside the blossom.
  // Labels are assigned during a stage and reset after each augmentation.
  const label: number[] = new Array(2 * nvertex).fill(0);

  // If b is a labeled top-level blossom,
  // labelend[b] is the remote endpoint of the edge through which b obtained
  // its label, or -1 if b's base vertex is single.
  // If v is a vertex inside a T-blossom and label[v] == 2,
  // labelend[v] is the remote endpoint of the edge through which v is
  // reachable from outside the blossom.
  const labelend: number[] = new Array(2 * nvertex).fill(-1);

  // If v is a vertex,
  // inblossom[v] is the top-level blossom to which v belongs.
  // If v is a top-level vertex, v is itself a blossom (a trivial blossom)
  // and inblossom[v] == v.
  // Initially all vertices are top-level trivial blossoms.
  const inblossom: number[] = Array.from({ length: nvertex }, (_, i) => i);

  // If b is a sub-blossom,
  // blossomparent[b] is its immediate parent (sub-)blossom.
  // If b is a top-level blossom, blossomparent[b] is -1.
  const blossomparent: number[] = new Array(2 * nvertex).fill(-1);

  // If b is a non-trivial (sub-)blossom,
  // blossomchilds[b] is an ordered list of its sub-blossoms, starting with
  // the base and going round the blossom.
  const blossomchilds: (number[] | null)[] = new Array(2 * nvertex).fill(null);

  // If b is a (sub-)blossom,
  // blossombase[b] is its base VERTEX (i.e. recursive sub-blossom).
  const blossombase: number[] = new Array(2 * nvertex);
  for (let i = 0; i < nvertex; i++) blossombase[i] = i;
  for (let i = nvertex; i < 2 * nvertex; i++) blossombase[i] = -1;

  // If b is a non-trivial (sub-)blossom,
  // blossomendps[b] is a list of endpoints on its connecting edges,
  // such that blossomendps[b][i] is the local endpoint of blossomchilds[b][i]
  // on the edge that connects it to blossomchilds[b][wrap(i+1)].
  const blossomendps: (number[] | null)[] = new Array(2 * nvertex).fill(null);

  // If v is a free vertex (or an unreached vertex inside a T-blossom),
  // bestedge[v] is the edge to an S-vertex with least slack,
  // or -1 if there is no such edge.
  // If b is a (possibly trivial) top-level S-blossom,
  // bestedge[b] is the least-slack edge to a different S-blossom,
  // or -1 if there is no such edge.
  // This is used for efficient computation of delta2 and delta3.
  const bestedge: number[] = new Array(2 * nvertex).fill(-1);

  // If b is a non-trivial top-level S-blossom,
  // blossombestedges[b] is a list of least-slack edges to neighbouring
  // S-blossoms, or None if no such list has been computed yet.
  // This is used for efficient computation of delta3.
  const blossombestedges: (number[] | null)[] = new Array(2 * nvertex).fill(
    null,
  );

  // List of currently unused blossom numbers.
  const unusedblossoms: number[] = Array.from(
    { length: nvertex },
    (_, i) => i + nvertex,
  );

  // If v is a vertex,
  // dualvar[v] = 2 * u(v) where u(v) is the v's variable in the dual
  // optimization problem (multiplication by two ensures integer values
  // throughout the algorithm if all edge weights are integers).
  // If b is a non-trivial blossom,
  // dualvar[b] = z(b) where z(b) is b's variable in the dual optimization
  // problem.
  const dualvar: number[] = new Array(2 * nvertex);
  for (let i = 0; i < nvertex; i++) dualvar[i] = maxweight;
  for (let i = nvertex; i < 2 * nvertex; i++) dualvar[i] = 0;

  // If allowedge[k] is true, edge k has zero slack in the optimization
  // problem; if allowedge[k] is false, the edge's slack may or may not
  // be zero.
  const allowedge: boolean[] = new Array(nedge).fill(false);

  // Queue of newly discovered S-vertices.
  const queue: number[] = [];

  // Return 2 * slack of edge k (does not work inside blossoms).
  function slack(k: number): number {
    const [i, j, wt] = edges[k];
    return dualvar[i] + dualvar[j] - 2 * wt;
  }

  // Generate the leaf vertices of a blossom.
  function* blossomLeaves(b: number): Generator<number> {
    if (b < nvertex) {
      yield b;
    } else {
      for (const t of blossomchilds[b]!) {
        if (t < nvertex) {
          yield t;
        } else {
          yield* blossomLeaves(t);
        }
      }
    }
  }

  // Assign label t to the top-level blossom containing vertex w
  // and record the fact that w was reached through the edge with
  // remote endpoint p.
  function assignLabel(w: number, t: number, p: number): void {
    const b = inblossom[w];
    label[w] = label[b] = t;
    labelend[w] = labelend[b] = p;
    bestedge[w] = bestedge[b] = -1;
    if (t === 1) {
      // b became an S-vertex/blossom; add it(s vertices) to the queue.
      for (const v of blossomLeaves(b)) queue.push(v);
    } else if (t === 2) {
      // b became a T-vertex/blossom; assign label S to its mate.
      // (If b is a non-trivial blossom, its base is the only vertex
      // with an external mate.)
      const base = blossombase[b];
      assignLabel(endpoint[mate[base]], 1, mate[base] ^ 1);
    }
  }

  // Trace back from vertices v and w to discover either a new blossom
  // or an augmenting path. Return the base vertex of the new blossom or -1.
  function scanBlossom(v: number, w: number): number {
    // Trace back from v and w, placing breadcrumbs as we go.
    const path: number[] = [];
    let base = -1;
    while (v !== -1 || w !== -1) {
      // Look for a breadcrumb in v's blossom or put a new breadcrumb.
      let b = inblossom[v];
      if (label[b] & 4) {
        base = blossombase[b];
        break;
      }
      path.push(b);
      label[b] = 5;
      // Trace one step back.
      if (labelend[b] === -1) {
        // The base of blossom b is single; stop tracing this path.
        v = -1;
      } else {
        v = endpoint[labelend[b]];
        b = inblossom[v];
        // b is a T-blossom; trace one more step back.
        v = endpoint[labelend[b]];
      }
      // Swap v and w so that we alternate between both paths.
      if (w !== -1) {
        const tmp = v;
        v = w;
        w = tmp;
      }
    }
    // Remove breadcrumbs.
    for (const b of path) {
      label[b] = 1;
    }
    // Return base vertex, if we found one.
    return base;
  }

  // Construct a new blossom with given base, containing edge k which
  // connects a pair of S vertices. Label the new blossom as S; set its dual
  // variable to zero; relabel its T-vertices to S and add them to the queue.
  function addBlossom(base: number, k: number): void {
    let [v, w] = edges[k];
    const bb = inblossom[base];
    let bv = inblossom[v];
    let bw = inblossom[w];
    // Create blossom.
    const b = unusedblossoms.pop()!;
    blossombase[b] = base;
    blossomparent[b] = -1;
    blossomparent[bb] = b;
    // Make list of sub-blossoms and their interconnecting edge endpoints.
    const path: number[] = [];
    blossomchilds[b] = path;
    const endps: number[] = [];
    blossomendps[b] = endps;
    // Trace back from v to base.
    while (bv !== bb) {
      // Add bv to the new blossom.
      blossomparent[bv] = b;
      path.push(bv);
      endps.push(labelend[bv]);
      // Trace one step back.
      v = endpoint[labelend[bv]];
      bv = inblossom[v];
    }
    // Reverse lists, add endpoint that connects the pair of S vertices.
    path.push(bb);
    path.reverse();
    endps.reverse();
    endps.push(2 * k);
    // Trace back from w to base.
    while (bw !== bb) {
      // Add bw to the new blossom.
      blossomparent[bw] = b;
      path.push(bw);
      endps.push(labelend[bw] ^ 1);
      // Trace one step back.
      w = endpoint[labelend[bw]];
      bw = inblossom[w];
    }
    // Set label to S.
    label[b] = 1;
    labelend[b] = labelend[bb];
    // Set dual variable to zero.
    dualvar[b] = 0;
    // Relabel vertices.
    for (const v of blossomLeaves(b)) {
      if (label[inblossom[v]] === 2) {
        // This T-vertex now turns into an S-vertex because it becomes
        // part of an S-blossom; add it to the queue.
        queue.push(v);
      }
      inblossom[v] = b;
    }
    // Compute blossombestedges[b].
    const bestedgeto: number[] = new Array(2 * nvertex).fill(-1);
    const bestslackto: number[] = new Array(2 * nvertex);
    const touched: number[] = [];
    for (const bv of path) {
      let nblists: number[][];
      if (blossombestedges[bv] === null) {
        // This subblossom does not have a list of least-slack edges;
        // get the information from the vertices.
        nblists = [];
        for (const v of blossomLeaves(bv)) {
          nblists.push(neighbend[v].map((p) => p >> 1));
        }
      } else {
        // Walk this subblossom's least-slack edges.
        nblists = [blossombestedges[bv]!];
      }
      for (const nblist of nblists) {
        for (const k of nblist) {
          let [i, j] = edges[k];
          if (inblossom[j] === b) {
            const tmp = i;
            i = j;
            j = tmp;
          }
          const bj = inblossom[j];
          if (bj !== b && label[bj] === 1) {
            const kslack = slack(k);
            if (bestedgeto[bj] === -1 || kslack < bestslackto[bj]) {
              if (bestedgeto[bj] === -1) touched.push(bj);
              bestedgeto[bj] = k;
              bestslackto[bj] = kslack;
            }
          }
        }
      }
      // Forget about least-slack edges of the subblossom.
      blossombestedges[bv] = null;
      bestedge[bv] = -1;
    }
    const newbestedges: number[] = new Array(touched.length);
    bestedge[b] = -1;
    let bestSlack = 0;
    for (let idx = 0; idx < touched.length; idx++) {
      const bj = touched[idx];
      const k = bestedgeto[bj];
      newbestedges[idx] = k;
      if (bestedge[b] === -1 || bestslackto[bj] < bestSlack) {
        bestedge[b] = k;
        bestSlack = bestslackto[bj];
      }
      bestedgeto[bj] = -1; // reset for next use
    }
    blossombestedges[b] = newbestedges;
  }

  // Expand the given top-level blossom.
  function expandBlossom(b: number, endstage: boolean): void {
    // Convert sub-blossoms into top-level blossoms.
    for (const s of blossomchilds[b]!) {
      blossomparent[s] = -1;
      if (s < nvertex) {
        inblossom[s] = s;
      } else if (endstage && dualvar[s] === 0) {
        // Recursively expand this sub-blossom.
        expandBlossom(s, endstage);
      } else {
        for (const v of blossomLeaves(s)) {
          inblossom[v] = s;
        }
      }
    }
    // If we expand a T-blossom during a stage, its sub-blossoms must be
    // relabeled.
    if (!endstage && label[b] === 2) {
      // Start at the sub-blossom through which the expanding
      // blossom obtained its label, and relabel sub-blossoms until
      // we reach the base.
      // Figure out through which sub-blossom the expanding blossom
      // obtained its label initially.
      const entrychild = inblossom[endpoint[labelend[b] ^ 1]];
      // Decide in which direction we will go round the blossom.
      let j = blossomchilds[b]!.indexOf(entrychild);
      let jstep: number;
      let endptrick: number;
      if (j & 1) {
        // Start index is odd; go forward and wrap.
        j -= blossomchilds[b]!.length;
        jstep = 1;
        endptrick = 0;
      } else {
        // Start index is even; go backward.
        jstep = -1;
        endptrick = 1;
      }
      // Move along the blossom until we get to the base.
      let p = labelend[b];
      while (j !== 0) {
        // Relabel the T-sub-blossom.
        label[endpoint[p ^ 1]] = 0;
        label[
          endpoint[
            at(blossomendps[b]!, j - endptrick) ^ endptrick ^ 1
          ]
        ] = 0;
        assignLabel(endpoint[p ^ 1], 2, p);
        // Step to the next S-sub-blossom and note its forward endpoint.
        allowedge[at(blossomendps[b]!, j - endptrick) >> 1] = true;
        j += jstep;
        p = at(blossomendps[b]!, j - endptrick) ^ endptrick;
        // Step to the next T-sub-blossom.
        allowedge[p >> 1] = true;
        j += jstep;
      }
      // Relabel the base T-sub-blossom WITHOUT stepping through to
      // its mate (so don't call assignLabel).
      const bv = at(blossomchilds[b]!, j);
      label[endpoint[p ^ 1]] = label[bv] = 2;
      labelend[endpoint[p ^ 1]] = labelend[bv] = p;
      bestedge[bv] = -1;
      // Continue along the blossom until we get back to entrychild.
      j += jstep;
      while (at(blossomchilds[b]!, j) !== entrychild) {
        // Examine the vertices of the sub-blossom to see whether
        // it is reachable from a neighbouring S-vertex outside the
        // expanding blossom.
        const bv = at(blossomchilds[b]!, j);
        if (label[bv] === 1) {
          // This sub-blossom just got label S through one of its
          // neighbours; leave it.
          j += jstep;
          continue;
        }
        let v = -1;
        for (const leaf of blossomLeaves(bv)) {
          v = leaf;
          if (label[v] !== 0) break;
        }
        // If the sub-blossom contains a reachable vertex, assign
        // label T to the sub-blossom.
        if (label[v] !== 0) {
          label[v] = 0;
          label[endpoint[mate[blossombase[bv]]]] = 0;
          assignLabel(v, 2, labelend[v]);
        }
        j += jstep;
      }
    }
    // Recycle the blossom number.
    label[b] = labelend[b] = -1;
    blossomchilds[b] = blossomendps[b] = null;
    blossombase[b] = -1;
    blossombestedges[b] = null;
    bestedge[b] = -1;
    unusedblossoms.push(b);
  }

  // Swap matched/unmatched edges over an alternating path through blossom b
  // between vertex v and the base vertex. Keep blossom bookkeeping consistent.
  function augmentBlossom(b: number, v: number): void {
    // Bubble up through the blossom tree from vertex v to an immediate
    // sub-blossom of b.
    let t = v;
    while (blossomparent[t] !== b) {
      t = blossomparent[t];
    }
    // Recursively deal with the first sub-blossom.
    if (t >= nvertex) {
      augmentBlossom(t, v);
    }
    // Decide in which direction we will go round the blossom.
    const i = blossomchilds[b]!.indexOf(t);
    let j = i;
    let jstep: number;
    let endptrick: number;
    if (i & 1) {
      // Start index is odd; go forward and wrap.
      j -= blossomchilds[b]!.length;
      jstep = 1;
      endptrick = 0;
    } else {
      // Start index is even; go backward.
      jstep = -1;
      endptrick = 1;
    }
    // Move along the blossom until we get to the base.
    while (j !== 0) {
      // Step to the next sub-blossom and augment it recursively.
      j += jstep;
      t = at(blossomchilds[b]!, j);
      let p = at(blossomendps[b]!, j - endptrick) ^ endptrick;
      if (t >= nvertex) {
        augmentBlossom(t, endpoint[p]);
      }
      // Step to the next sub-blossom and augment it recursively.
      j += jstep;
      t = at(blossomchilds[b]!, j);
      if (t >= nvertex) {
        augmentBlossom(t, endpoint[p ^ 1]);
      }
      // Match the edge connecting those sub-blossoms.
      mate[endpoint[p]] = p ^ 1;
      mate[endpoint[p ^ 1]] = p;
    }
    // Rotate the list of sub-blossoms to put the new base at the front.
    blossomchilds[b] = [
      ...blossomchilds[b]!.slice(i),
      ...blossomchilds[b]!.slice(0, i),
    ];
    blossomendps[b] = [
      ...blossomendps[b]!.slice(i),
      ...blossomendps[b]!.slice(0, i),
    ];
    blossombase[b] = blossombase[blossomchilds[b]![0]];
  }

  // Swap matched/unmatched edges over an alternating path between two
  // single vertices. The augmenting path runs through edge k, which
  // connects a pair of S vertices.
  function augmentMatching(k: number): void {
    const [v, w] = edges[k];
    const pairs: [number, number][] = [
      [v, 2 * k + 1],
      [w, 2 * k],
    ];
    for (const [sInit, pInit] of pairs) {
      // Match vertex s to remote endpoint p. Then trace back from s
      // until we find a single vertex, swapping matched and unmatched
      // edges as we go.
      let s = sInit;
      let p = pInit;
      while (true) {
        const bs = inblossom[s];
        // Augment through the S-blossom from s to base.
        if (bs >= nvertex) {
          augmentBlossom(bs, s);
        }
        // Update mate[s]
        mate[s] = p;
        // Trace one step back.
        if (labelend[bs] === -1) {
          // Reached single vertex; stop.
          break;
        }
        const t = endpoint[labelend[bs]];
        const bt = inblossom[t];
        // Trace one step back.
        s = endpoint[labelend[bt]];
        const j = endpoint[labelend[bt] ^ 1];
        // Augment through the T-blossom from j to base.
        if (bt >= nvertex) {
          augmentBlossom(bt, j);
        }
        // Update mate[j]
        mate[j] = labelend[bt];
        // Keep the opposite endpoint;
        // it will be assigned to mate[s] in the next step.
        p = labelend[bt] ^ 1;
      }
    }
  }

  // Verify that the optimum solution has been reached.
  function verifyOptimum(): void {
    let vdualoffset: number;
    if (maxCardinality) {
      // Vertices may have negative dual;
      // find a constant non-negative number to add to all vertex duals.
      let minDual = dualvar[0];
      for (let i = 1; i < nvertex; i++) {
        if (dualvar[i] < minDual) minDual = dualvar[i];
      }
      vdualoffset = Math.max(0, -minDual);
    } else {
      vdualoffset = 0;
    }
    // 0. all dual variables are non-negative
    for (let i = 0; i < nvertex; i++) {
      if (dualvar[i] + vdualoffset < 0)
        throw new Error("Verification failed: negative vertex dual");
    }
    for (let i = nvertex; i < 2 * nvertex; i++) {
      if (dualvar[i] < 0)
        throw new Error("Verification failed: negative blossom dual");
    }
    // 0. all edges have non-negative slack and
    // 1. all matched edges have zero slack;
    for (let k = 0; k < nedge; k++) {
      const [i, j, wt] = edges[k];
      let s = dualvar[i] + dualvar[j] - 2 * wt;
      const iblossoms: number[] = [i];
      const jblossoms: number[] = [j];
      while (blossomparent[iblossoms[iblossoms.length - 1]] !== -1) {
        iblossoms.push(blossomparent[iblossoms[iblossoms.length - 1]]);
      }
      while (blossomparent[jblossoms[jblossoms.length - 1]] !== -1) {
        jblossoms.push(blossomparent[jblossoms[jblossoms.length - 1]]);
      }
      iblossoms.reverse();
      jblossoms.reverse();
      const minLen = Math.min(iblossoms.length, jblossoms.length);
      for (let idx = 0; idx < minLen; idx++) {
        const bi = iblossoms[idx];
        const bj = jblossoms[idx];
        if (bi !== bj) break;
        s += 2 * dualvar[bi];
      }
      if (s < 0)
        throw new Error("Verification failed: negative edge slack");
      if ((mate[i] >> 1) === k || (mate[j] >> 1) === k) {
        if ((mate[i] >> 1) !== k || (mate[j] >> 1) !== k)
          throw new Error("Verification failed: inconsistent matching");
        if (s !== 0)
          throw new Error(
            "Verification failed: matched edge has non-zero slack",
          );
      }
    }
    // 2. all single vertices have zero dual value;
    for (let v = 0; v < nvertex; v++) {
      if (mate[v] < 0 && dualvar[v] + vdualoffset !== 0)
        throw new Error(
          "Verification failed: unmatched vertex has non-zero dual",
        );
    }
    // 3. all blossoms with positive dual value are full.
    for (let b = nvertex; b < 2 * nvertex; b++) {
      if (blossombase[b] >= 0 && dualvar[b] > 0) {
        if (blossomendps[b]!.length % 2 !== 1)
          throw new Error("Verification failed: blossom not odd-sized");
        for (let idx = 1; idx < blossomendps[b]!.length; idx += 2) {
          const p = blossomendps[b]![idx];
          if (mate[endpoint[p]] !== (p ^ 1) || mate[endpoint[p ^ 1]] !== p)
            throw new Error("Verification failed: blossom not full");
        }
      }
    }
  }

  // Main loop: continue until no further improvement is possible.
  for (let t = 0; t < nvertex; t++) {
    // Each iteration of this loop is a "stage".
    // A stage finds an augmenting path and uses that to improve
    // the matching.

    // Remove labels from top-level blossoms/vertices.
    label.fill(0);

    // Forget all about least-slack edges.
    bestedge.fill(-1);
    blossombestedges.fill(null, nvertex);

    // Loss of labeling means that we can not be sure that currently
    // allowable edges remain allowable throughout this stage.
    allowedge.fill(false);

    // Make queue empty.
    queue.length = 0;

    // Label single blossoms/vertices with S and put them in the queue.
    for (let v = 0; v < nvertex; v++) {
      if (mate[v] === -1 && label[inblossom[v]] === 0) {
        assignLabel(v, 1, -1);
      }
    }

    // Loop until we succeed in augmenting the matching.
    let augmented = false;
    while (true) {
      // Each iteration of this loop is a "substage".
      // A substage tries to find an augmenting path;
      // if found, the path is used to improve the matching and
      // the stage ends. If there is no augmenting path, the
      // primal-dual method is used to pump some slack out of
      // the dual variables.

      // Continue labeling until all vertices which are reachable
      // through an alternating path have got a label.
      while (queue.length > 0 && !augmented) {
        // Take an S vertex from the queue.
        const v = queue.pop()!;

        // Scan its neighbours:
        for (const p of neighbend[v]) {
          const k = p >> 1;
          const w = endpoint[p];
          // w is a neighbour to v
          if (inblossom[v] === inblossom[w]) {
            // this edge is internal to a blossom; ignore it
            continue;
          }
          let kslack = 0;
          if (!allowedge[k]) {
            kslack = slack(k);
            if (kslack <= 0) {
              // edge k has zero slack => it is allowable
              allowedge[k] = true;
            }
          }
          if (allowedge[k]) {
            if (label[inblossom[w]] === 0) {
              // (C1) w is a free vertex;
              // label w with T and label its mate with S (R12).
              assignLabel(w, 2, p ^ 1);
            } else if (label[inblossom[w]] === 1) {
              // (C2) w is an S-vertex (not in the same blossom);
              // follow back-links to discover either an
              // augmenting path or a new blossom.
              const base = scanBlossom(v, w);
              if (base >= 0) {
                // Found a new blossom; add it to the blossom
                // bookkeeping and turn it into an S-blossom.
                addBlossom(base, k);
              } else {
                // Found an augmenting path; augment the
                // matching and end this stage.
                augmentMatching(k);
                augmented = true;
                break;
              }
            } else if (label[w] === 0) {
              // w is inside a T-blossom, but w itself has not
              // yet been reached from outside the blossom;
              // mark it as reached (we need this to relabel
              // during T-blossom expansion).
              label[w] = 2;
              labelend[w] = p ^ 1;
            }
          } else if (label[inblossom[w]] === 1) {
            // keep track of the least-slack non-allowable edge to
            // a different S-blossom.
            const b = inblossom[v];
            if (bestedge[b] === -1 || kslack < slack(bestedge[b])) {
              bestedge[b] = k;
            }
          } else if (label[w] === 0) {
            // w is a free vertex (or an unreached vertex inside
            // a T-blossom) but we can not reach it yet;
            // keep track of the least-slack edge that reaches w.
            if (bestedge[w] === -1 || kslack < slack(bestedge[w])) {
              bestedge[w] = k;
            }
          }
        }
      }

      if (augmented) break;

      // There is no augmenting path under these constraints;
      // compute delta and reduce slack in the optimization problem.
      // (Note that our vertex dual variables, edge slacks and delta's
      // are pre-multiplied by two.)
      let deltatype = -1;
      let delta = 0;
      let deltaedge = -1;
      let deltablossom = -1;

      // Compute delta1: the minimum value of any vertex dual.
      if (!maxCardinality) {
        deltatype = 1;
        delta = dualvar[0];
        for (let v = 1; v < nvertex; v++) {
          if (dualvar[v] < delta) delta = dualvar[v];
        }
      }

      // Compute delta2: the minimum slack on any edge between
      // an S-vertex and a free vertex.
      for (let v = 0; v < nvertex; v++) {
        if (label[inblossom[v]] === 0 && bestedge[v] !== -1) {
          const d = slack(bestedge[v]);
          if (deltatype === -1 || d < delta) {
            delta = d;
            deltatype = 2;
            deltaedge = bestedge[v];
          }
        }
      }

      // Compute delta3: half the minimum slack on any edge between
      // a pair of S-blossoms.
      for (let b = 0; b < 2 * nvertex; b++) {
        if (
          blossomparent[b] === -1 &&
          label[b] === 1 &&
          bestedge[b] !== -1
        ) {
          const kslack = slack(bestedge[b]);
          const d = kslack / 2;
          if (deltatype === -1 || d < delta) {
            delta = d;
            deltatype = 3;
            deltaedge = bestedge[b];
          }
        }
      }

      // Compute delta4: minimum z variable of any T-blossom.
      for (let b = nvertex; b < 2 * nvertex; b++) {
        if (
          blossombase[b] >= 0 &&
          blossomparent[b] === -1 &&
          label[b] === 2 &&
          (deltatype === -1 || dualvar[b] < delta)
        ) {
          delta = dualvar[b];
          deltatype = 4;
          deltablossom = b;
        }
      }

      if (deltatype === -1) {
        // No further improvement possible; max-cardinality optimum
        // reached. Do a final delta update to make the optimum
        // verifiable.
        deltatype = 1;
        delta = 0;
        for (let v = 0; v < nvertex; v++) {
          if (v === 0 || dualvar[v] < delta) delta = dualvar[v];
        }
        delta = Math.max(0, delta);
      }

      // Update dual variables according to delta.
      for (let v = 0; v < nvertex; v++) {
        if (label[inblossom[v]] === 1) {
          // S-vertex: 2*u = 2*u - 2*delta
          dualvar[v] -= delta;
        } else if (label[inblossom[v]] === 2) {
          // T-vertex: 2*u = 2*u + 2*delta
          dualvar[v] += delta;
        }
      }
      for (let b = nvertex; b < 2 * nvertex; b++) {
        if (blossombase[b] >= 0 && blossomparent[b] === -1) {
          if (label[b] === 1) {
            // top-level S-blossom: z = z + 2*delta
            dualvar[b] += delta;
          } else if (label[b] === 2) {
            // top-level T-blossom: z = z - 2*delta
            dualvar[b] -= delta;
          }
        }
      }

      // Take action at the point where minimum delta occurred.
      if (deltatype === 1) {
        // No further improvement possible; optimum reached.
        break;
      } else if (deltatype === 2) {
        // Use the least-slack edge to continue the search.
        allowedge[deltaedge] = true;
        let [i, j] = edges[deltaedge];
        if (label[inblossom[i]] === 0) {
          const tmp = i;
          i = j;
          j = tmp;
        }
        queue.push(i);
      } else if (deltatype === 3) {
        // Use the least-slack edge to continue the search.
        allowedge[deltaedge] = true;
        const [i] = edges[deltaedge];
        queue.push(i);
      } else if (deltatype === 4) {
        // Expand the least-z blossom.
        expandBlossom(deltablossom, false);
      }

      // End of this substage.
    }

    // Stop when no more augmenting path can be found.
    if (!augmented) break;

    // End of a stage; expand all S-blossoms which have dualvar = 0.
    for (let b = nvertex; b < 2 * nvertex; b++) {
      if (
        blossomparent[b] === -1 &&
        blossombase[b] >= 0 &&
        label[b] === 1 &&
        dualvar[b] === 0
      ) {
        expandBlossom(b, true);
      }
    }
  }

  // Verify that we reached the optimum solution.
  if (checkOptimum) {
    verifyOptimum();
  }

  // Transform mate[] such that mate[v] is the vertex to which v is paired.
  for (let v = 0; v < nvertex; v++) {
    if (mate[v] >= 0) {
      mate[v] = endpoint[mate[v]];
    }
  }

  return mate;
}
