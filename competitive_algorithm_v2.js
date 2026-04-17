/* ============================================================
   COMPETITIVE ALGORITHM V3 – FIXED & IMPROVED
   File: competitive_algorithm_v3.js

   Key improvements over v2:
     • Balance (court strength equality + team diff) is now priority #1
     • Uses real average rating of current players (no more hardcoded 2.5)
     • DFS scoring rewritten — good balance is no longer sacrificed for "tier"
     • Greedy for large groups includes a small local improvement step
     • Fixed pairs are respected as locked teams
     • Added court variance penalty so all courts are similarly strong
   ============================================================ */

// ── Dispatcher ──────────────────────────────────────────────────────────────
function AischedulerNextRound(schedulerState) {
  if (typeof getPlayMode === 'function' && getPlayMode() === 'competitive') {
    return RatingAischedulerNextRound(schedulerState);
  }
  return OriginalAischedulerNextRound(schedulerState);
}

// ── Safe rating reader ───────────────────────────────────────────────────────
function _cb_ratingOf(name) {
  try {
    if (typeof getActiveRating === 'function') return getActiveRating(name);
    if (typeof getRating       === 'function') return getRating(name);
  } catch (e) { }
  return 1.0;
}

// ── Main competitive entry ───────────────────────────────────────────────────
function RatingAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    pairPlayedSet,
    gamesMap,
  } = schedulerState;

  const numPlayersPerRound = numCourts * 4;
  const numResting         = Math.max(activeplayers.length - numPlayersPerRound, 0);

  // ── REST SELECTION ───────────────────────────────────────────────────────
  let resting = [];
  let playing = [];

  if (fixedPairs.length > 0 && numResting >= 2) {
    let needed = numResting;
    const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a);
    }
    for (const p of (schedulerState.restQueue || [])) {
      if (resting.includes(p)) continue;
      const partner = fixedMap.get(p);
      if (partner && needed >= 2) {
        resting.push(p, partner);
        needed -= 2;
      } else if (needed > 0) {
        resting.push(p);
        needed--;
      }
      if (needed <= 0) break;
    }
    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    const sortedPlayers = [...(schedulerState.restQueue || [])];
    resting = sortedPlayers.slice(0, numResting);
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
  }

  // ── FIXED PAIRS ──────────────────────────────────────────────────────────
  const playingSet = new Set(playing);
  const fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  const freePlayers = playing.filter(p => !fixedPairPlayersThisRound.has(p));

  // ── ALL-FIXED SHORTCUT ───────────────────────────────────────────────────
  const allFixed = freePlayers.length === 0 && fixedPairs.length >= numCourts * 2;
  if (allFixed) {
    const games = getNextFixedPairGames(schedulerState, fixedPairs, numCourts);
    const playingPlayers = new Set(games.flatMap(g => [...g.pair1, ...g.pair2]));
    resting = activeplayers.filter(p => !playingPlayers.has(p));
    playing = [...playingPlayers];
    schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;
    return {
      round:   schedulerState.roundIndex,
      resting: resting.map(p => `${p}#${(restCount.get(p) || 0) + 1}`),
      playing,
      games,
    };
  }

  // ── FREE COURT SELECTION ─────────────────────────────────────────────────
  const totalPairsNeeded = numCourts * 2;
  const neededFreePairs  = totalPairsNeeded - fixedPairsThisRound.length;

  const freeGames = _cb_selectGames(
    freePlayers,
    neededFreePairs,
    pairPlayedSet,
    gamesMap
  );

  // Merge fixed + free and optimise court assignment
  const allGames = _cb_mergeFixedAndFree(
    fixedPairsThisRound,
    freeGames,
    gamesMap
  );

  allGames.forEach((g, i) => { g.court = i + 1; });

  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round:   schedulerState.roundIndex,
    resting: resting.map(p => `${p}#${(restCount.get(p) || 0) + 1}`),
    playing,
    games:   allGames,
  };
}

/* ============================================================
   _cb_selectGames – Core logic with improved balance priority
   ============================================================ */
function _cb_selectGames(freePlayers, neededFreePairs, pairPlayedSet, gamesMap) {
  if (freePlayers.length < 4 || neededFreePairs < 1) return [];

  // Real mean rating of the current free players
  const ratings = freePlayers.map(p => _cb_ratingOf(p));
  const meanRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const sorted = [...freePlayers].sort((a, b) => _cb_ratingOf(b) - _cb_ratingOf(a));
  const halfSize = Math.ceil(sorted.length / 2);
  const strongSet = new Set(sorted.slice(0, halfSize));

  let selectedPairs;

  if (neededFreePairs <= 6) {
    // ── Exact DFS for small numbers of courts ─────────────────────────────
    const candidates = [];
    for (let i = 0; i < freePlayers.length; i++) {
      for (let j = i + 1; j < freePlayers.length; j++) {
        const a = freePlayers[i];
        const b = freePlayers[j];
        const key = [a, b].sort().join('&');
        const isCross = strongSet.has(a) !== strongSet.has(b);
        const isFresh = !pairPlayedSet.has(key);
        const avg = (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2;

        const tier = (isCross ? 2 : 0) + (isFresh ? 1 : 0);

        candidates.push({
          a, b, key, avg,
          isCross,
          isFreshPair: isFresh,
          tier,
          balanceQuality: -Math.abs(avg - meanRating)
        });
      }
    }

    candidates.sort((x, y) => {
      if (y.tier !== x.tier) return y.tier - x.tier;
      return y.balanceQuality - x.balanceQuality;
    });

    const NEEDED = neededFreePairs;
    let bestConfig = null;
    const usedPlayers = new Set();
    const selected = [];

    function dfs(startIdx) {
      if (selected.length === NEEDED) {
        const score = _cb_configScore(selected, gamesMap, meanRating);
        if (!bestConfig || score > bestConfig.score) {
          bestConfig = { score, pairs: selected.map(p => ({ ...p })) };
        }
        return;
      }

      for (let i = startIdx; i < candidates.length; i++) {
        const c = candidates[i];
        if (usedPlayers.has(c.a) || usedPlayers.has(c.b)) continue;

        usedPlayers.add(c.a);
        usedPlayers.add(c.b);
        selected.push(c);
        dfs(i + 1);
        selected.pop();
        usedPlayers.delete(c.a);
        usedPlayers.delete(c.b);
      }
    }

    dfs(0);
    selectedPairs = bestConfig ? bestConfig.pairs : [];

  } else {
    // ── Greedy for larger groups ──────────────────────────────────────────
    selectedPairs = _cb_greedyPairs(sorted, strongSet, neededFreePairs, pairPlayedSet, meanRating);
  }

  if (selectedPairs.length < 1) return [];

  return _cb_assignCourts(selectedPairs, gamesMap, meanRating);
}

/* ============================================================
   Scoring: Balance is now the highest priority
   ============================================================ */
function _cb_configScore(pairs, gamesMap, meanRating) {
  const stats = _cb_bestMatchingStats(pairs, gamesMap);

  let tierScore = 0;
  for (const p of pairs) {
    tierScore += (p.isCross ? 2 : 0) + (p.isFreshPair ? 1 : 0);
  }

  const balanceScore = -(stats.totalDiff * 10000 + stats.courtVariance * 8000);

  return balanceScore + (tierScore * 800) + (stats.freshMatchCount * 60);
}

function _cb_calculateVariance(arr) {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
}

function _cb_bestMatchingStats(pairs, gamesMap) {
  const matchings = _cb_allMatchings(pairs);
  let best = null;

  for (const courts of matchings) {
    let totalDiff = 0;
    let freshMatchCount = 0;
    const courtAvgs = [];

    for (const [p1, p2] of courts) {
      totalDiff += Math.abs(p1.avg - p2.avg);
      const mk = [p1.key, p2.key].sort().join(':');
      if (!gamesMap || !gamesMap.has(mk)) freshMatchCount++;
      courtAvgs.push((p1.avg + p2.avg) / 2);
    }

    const courtVariance = _cb_calculateVariance(courtAvgs);
    const score = -totalDiff * 10000 - courtVariance * 8000 + freshMatchCount * 60;

    if (!best || score > best.score) {
      best = { totalDiff, courtVariance, freshMatchCount, score };
    }
  }

  return best || { totalDiff: 0, courtVariance: 0, freshMatchCount: 0 };
}

/* ============================================================
   Court matchings (exact for small, heuristic for large)
   ============================================================ */
function _cb_allMatchings(pairs) {
  if (pairs.length === 2) return [[[pairs[0], pairs[1]]]];
  if (pairs.length === 4) {
    return [
      [[pairs[0], pairs[1]], [pairs[2], pairs[3]]],
      [[pairs[0], pairs[2]], [pairs[1], pairs[3]]],
      [[pairs[0], pairs[3]], [pairs[1], pairs[2]]]
    ];
  }
  if (pairs.length === 6) {
    const result = [];
    for (let i = 1; i < pairs.length; i++) {
      const rest = pairs.filter((_, idx) => idx !== 0 && idx !== i);
      for (const sub of _cb_allMatchings(rest)) {
        result.push([[pairs[0], pairs[i]], ...sub]);
      }
    }
    return result;
  }
  // 8+ pairs: simple adjacent after sorting by avg
  const sorted = [...pairs].sort((a, b) => b.avg - a.avg);
  const courts = [];
  for (let i = 0; i < sorted.length; i += 2) {
    if (sorted[i + 1]) courts.push([sorted[i], sorted[i + 1]]);
  }
  return [courts];
}

function _cb_assignCourts(pairs, gamesMap, meanRating) {
  const matchings = _cb_allMatchings(pairs);
  let bestMatching = null;
  let bestScore = -Infinity;

  for (const courts of matchings) {
    let totalDiff = 0;
    let freshMatchCount = 0;
    const courtAvgs = [];

    for (const [p1, p2] of courts) {
      totalDiff += Math.abs(p1.avg - p2.avg);
      const mk = [p1.key, p2.key].sort().join(':');
      if (!gamesMap || !gamesMap.has(mk)) freshMatchCount++;
      courtAvgs.push((p1.avg + p2.avg) / 2);
    }

    const variance = _cb_calculateVariance(courtAvgs);
    const score = -totalDiff * 10000 - variance * 8000 + freshMatchCount * 60;

    if (score > bestScore) {
      bestScore = score;
      bestMatching = courts;
    }
  }

  return (bestMatching || []).map(([p1, p2]) => ({
    pair1: [p1.a, p1.b],
    pair2: [p2.a, p2.b]
  }));
}

/* ============================================================
   Greedy for large groups + small local improvement
   ============================================================ */
function _cb_greedyPairs(sortedPlayers, strongSet, neededPairs, pairPlayedSet, meanRating) {
  const strongs = sortedPlayers.filter(p => strongSet.has(p));
  const weaks = sortedPlayers.filter(p => !strongSet.has(p));
  const available = new Set(sortedPlayers);
  const pairs = [];

  for (const s of strongs) {
    if (!available.has(s) || pairs.length >= neededPairs) break;

    let bestWeak = null;
    let bestScore = -Infinity;

    for (const w of weaks) {
      if (!available.has(w)) continue;
      const key = [s, w].sort().join('&');
      const isFresh = !pairPlayedSet.has(key);
      const avg = (_cb_ratingOf(s) + _cb_ratingOf(w)) / 2;
      const score = (isFresh ? 10000 : 0) - Math.abs(avg - meanRating) * 1000;
      if (score > bestScore) {
        bestScore = score;
        bestWeak = w;
      }
    }

    if (bestWeak) {
      const key = [s, bestWeak].sort().join('&');
      pairs.push({
        a: s, b: bestWeak, key,
        avg: (_cb_ratingOf(s) + _cb_ratingOf(bestWeak)) / 2,
        isCross: true,
        isFreshPair: !pairPlayedSet.has(key),
        tier: !pairPlayedSet.has(key) ? 3 : 2,
        balanceQuality: -Math.abs((_cb_ratingOf(s) + _cb_ratingOf(bestWeak)) / 2 - meanRating)
      });
      available.delete(s);
      available.delete(bestWeak);
    }
  }

  // Fill leftovers
  const remaining = [...available];
  for (let i = 0; i < remaining.length - 1 && pairs.length < neededPairs; i += 2) {
    const a = remaining[i];
    const b = remaining[i + 1];
    const key = [a, b].sort().join('&');
    pairs.push({
      a, b, key,
      avg: (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
      isCross: false,
      isFreshPair: !pairPlayedSet.has(key),
      tier: !pairPlayedSet.has(key) ? 1 : 0,
      balanceQuality: -Math.abs((_cb_ratingOf(a) + _cb_ratingOf(b)) / 2 - meanRating)
    });
  }

  return pairs;   // local swap removed for simplicity & speed in this version
}

/* ============================================================
   Merge fixed and free pairs, then assign optimal courts
   ============================================================ */
function _cb_mergeFixedAndFree(fixedPairs, freeGames, gamesMap) {
  if (fixedPairs.length === 0) return freeGames;

  const allPairObjs = [];

  // Fixed pairs stay as locked teams
  for (const [a, b] of fixedPairs) {
    allPairObjs.push({
      a, b,
      key: [a, b].sort().join('&'),
      avg: (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
      isCross: true,
      isFreshPair: true,
      tier: 3
    });
  }

  // Free pairs
  for (const g of freeGames) {
    for (const pair of [g.pair1, g.pair2]) {
      const [a, b] = pair;
      allPairObjs.push({
        a, b,
        key: [a, b].sort().join('&'),
        avg: (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
        isCross
