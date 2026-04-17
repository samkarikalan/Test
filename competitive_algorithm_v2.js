/* ============================================================
   COMPETITIVE ALGORITHM V2
   File: competitive_algorithm_v2.js

   Globals exported:
     AischedulerNextRound(schedulerState)
       Dispatcher — routes by getPlayMode():
         "competitive" → RatingAischedulerNextRound
         "random"      → OriginalAischedulerNextRound (competitive_algorithm.js)

     RatingAischedulerNextRound(schedulerState)
       New balanced competitive scheduler.

   All internal helpers are prefixed _cb_ (competitive-balanced)
   to avoid any collision with existing globals.

   Input / output contract is IDENTICAL to OriginalAischedulerNextRound:
     IN  → schedulerState  (same object, same fields)
     OUT → { round, resting: ["name#N",...], playing: [...],
             games: [{ court, pair1:[a,b], pair2:[c,d] }, ...] }

   ── Priority order ────────────────────────────────────────────
     1. Balanced courts
        Each court has equal combined strength.
        Achieved by pairing one strong player with one weak player
        on each side (cross-half pairing).

     2. No repeat pair (within balanced options)
        Never reuse a partnership that has played together before,
        unless no balanced alternative exists.

     3. No repeat match (within repeat-pair options)
        Avoid the same two pairs facing each other again,
        unless forced.

   ── How it works ─────────────────────────────────────────────
     Players are split into a STRONG half and WEAK half by rating.
     A "cross-half" pair (one strong + one weak) has a naturally
     balanced average, so any two cross-half pairs form a balanced court.

     For <= 3 free courts (<=12 players at full capacity):
       DFS explores all disjoint pair combinations, scoring each
       COMPLETE CONFIGURATION so court balance is evaluated at
       selection time. Upper-bound pruning keeps branches manageable.

     For > 3 free courts (> 12 players):
       Greedy construction: each strong player is matched to the
       best available weak player (fresh first, then balance).
       Then optimal court assignment is applied.

     Court assignment (all sizes):
       All perfect matchings of pairs into courts are tried.
       The matching with the lowest total avg-rating diff wins;
       match freshness breaks ties.
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
  } catch (e) { /* fall through */ }
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

  // ── REST SELECTION (identical to OriginalAischedulerNextRound) ──────────
  let resting = [];
  let playing = [];

  if (fixedPairs.length > 0 && numResting >= 2) {
    let needed = numResting;
    const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a);
    }
    for (const p of schedulerState.restQueue) {
      if (resting.includes(p)) continue;
      const partner = fixedMap.get(p);
      if (partner) {
        if (needed >= 2) { resting.push(p, partner); needed -= 2; }
      } else if (needed > 0) {
        resting.push(p); needed -= 1;
      }
      if (needed <= 0) break;
    }
    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    const sortedPlayers = [...schedulerState.restQueue];
    resting = sortedPlayers.slice(0, numResting);
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
  }

  // ── FIXED PAIRS (identical to OriginalAischedulerNextRound) ────────────
  const playingSet = new Set(playing);
  const fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  const freePlayers = playing.filter(p => !fixedPairPlayersThisRound.has(p));

  // ── ALL-FIXED SHORTCUT (identical to OriginalAischedulerNextRound) ──────
  const allFixed =
    freePlayers.length === 0 &&
    fixedPairs.length >= numCourts * 2;

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

  // ── FREE COURT SELECTION ──────────────────────────────────────────────────
  // Each court needs 2 pairs. Fixed pairs already account for some pairs.
  const totalPairsNeeded = numCourts * 2;
  const neededFreePairs  = totalPairsNeeded - fixedPairsThisRound.length;

  const freeGames = _cb_selectGames(
    freePlayers,
    neededFreePairs,
    pairPlayedSet,
    gamesMap
  );

  // Merge fixed pairs into courts alongside free games
  const allGames = _cb_mergeFixedAndFree(
    fixedPairsThisRound,
    freeGames,
    gamesMap
  );

  allGames.forEach((g, i) => { g.court = i + 1; });

  // ── OUTPUT ────────────────────────────────────────────────────────────────
  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round:   schedulerState.roundIndex,
    resting: resting.map(p => `${p}#${(restCount.get(p) || 0) + 1}`),
    playing,
    games:   allGames,
  };
}


/* ============================================================
   _cb_selectGames

   Selects neededFreePairs disjoint pairs from freePlayers,
   then assigns them to courts optimally.

   Uses DFS (exact) for <= 6 pairs, greedy for larger.
   Returns: [{ pair1:[a,b], pair2:[c,d] }, ...]  (no court number)
   ============================================================ */
function _cb_selectGames(freePlayers, neededFreePairs, pairPlayedSet, gamesMap) {
  if (freePlayers.length < 4 || neededFreePairs < 2) return [];

  // Split players into strong (top half) and weak (bottom half) by rating
  const sorted    = [...freePlayers].sort((a, b) => _cb_ratingOf(b) - _cb_ratingOf(a));
  const halfSize  = Math.ceil(sorted.length / 2);
  const strongSet = new Set(sorted.slice(0, halfSize));

  let selectedPairs;

  if (neededFreePairs <= 6) {
    // ── DFS with upper-bound pruning ──────────────────────────────────────
    const candidates = [];
    for (let i = 0; i < freePlayers.length; i++) {
      for (let j = i + 1; j < freePlayers.length; j++) {
        const a        = freePlayers[i];
        const b        = freePlayers[j];
        const key      = [a, b].sort().join('&');
        const isCross  = strongSet.has(a) !== strongSet.has(b);
        const isFresh  = !pairPlayedSet.has(key);
        const tier     = isCross ? (isFresh ? 3 : 2) : (isFresh ? 1 : 0);
        candidates.push({
          a, b, key,
          avg: (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
          isCross,
          isFreshPair: isFresh,
          tier,
        });
      }
    }
    // Sort highest tier first → good solutions found early → better pruning
    candidates.sort((a, b) => b.tier - a.tier);

    const NEEDED      = neededFreePairs;
    const MAX_TIER    = 3;
    const usedPlayers = new Set();
    const selected    = [];
    let   bestConfig  = null;

    function dfs(startIdx, tierSum) {
      if (selected.length === NEEDED) {
        const score = _cb_configScore(selected, gamesMap);
        if (bestConfig === null || score > bestConfig.score) {
          bestConfig = { score, pairs: selected.map(p => ({ ...p })) };
        }
        return;
      }

      const slotsLeft = NEEDED - selected.length;
      if (candidates.length - startIdx < slotsLeft) return;

      // Upper-bound pruning
      if (bestConfig !== null) {
        const maxAdditional = slotsLeft * MAX_TIER * 10000 + NEEDED * 10;
        if (tierSum * 10000 + maxAdditional <= bestConfig.score) return;
      }

      for (let i = startIdx; i < candidates.length; i++) {
        const c = candidates[i];
        if (usedPlayers.has(c.a) || usedPlayers.has(c.b)) continue;
        usedPlayers.add(c.a);
        usedPlayers.add(c.b);
        selected.push(c);
        dfs(i + 1, tierSum + c.tier);
        selected.pop();
        usedPlayers.delete(c.a);
        usedPlayers.delete(c.b);
      }
    }

    dfs(0, 0);
    selectedPairs = bestConfig ? bestConfig.pairs : [];

  } else {
    // ── Greedy construction for large player counts ───────────────────────
    selectedPairs = _cb_greedyPairs(sorted, strongSet, neededFreePairs, pairPlayedSet);
  }

  if (selectedPairs.length < 2) return [];

  return _cb_assignCourts(selectedPairs, gamesMap);
}


/* ============================================================
   _cb_configScore

   Scores a complete set of pairs for a round.

   Tier (dominant — enforces priority order):
     Cross-half + fresh pair  → 3 per pair
     Cross-half + repeat pair → 2 per pair
     Same-half  + fresh pair  → 1 per pair
     Same-half  + repeat pair → 0 per pair
   tierScore = sum × 10000

   Within same tier total, best possible court balance wins:
     balancePenalty = bestTotalDiff × 1000  (lower diff = higher score)

   Within same balance, match freshness wins:
     freshBonus = freshMatchCount × 10
   ============================================================ */
function _cb_configScore(pairs, gamesMap) {
  let tierScore = 0;
  for (const p of pairs) {
    if      ( p.isCross &&  p.isFreshPair) tierScore += 3;
    else if ( p.isCross && !p.isFreshPair) tierScore += 2;
    else if (!p.isCross &&  p.isFreshPair) tierScore += 1;
    // same-half repeat: +0
  }
  tierScore *= 10000;

  const { totalDiff, freshMatchCount } = _cb_bestMatchingStats(pairs, gamesMap);
  return tierScore - (totalDiff * 1000) + (freshMatchCount * 10);
}


/* ============================================================
   _cb_bestMatchingStats

   Tries all perfect matchings of pairs into courts and returns
   the stats (totalDiff, freshMatchCount) of the best one.
   ============================================================ */
function _cb_bestMatchingStats(pairs, gamesMap) {
  const matchings = _cb_allMatchings(pairs);
  let best = null;

  for (const courts of matchings) {
    let totalDiff = 0;
    let freshMatchCount = 0;
    for (const [p1, p2] of courts) {
      totalDiff += Math.abs(p1.avg - p2.avg);
      const mk = [p1.key, p2.key].sort().join(':');
      if (!gamesMap || !gamesMap.has(mk)) freshMatchCount++;
    }
    if (
      best === null ||
      totalDiff < best.totalDiff ||
      (totalDiff === best.totalDiff && freshMatchCount > best.freshMatchCount)
    ) {
      best = { totalDiff, freshMatchCount };
    }
  }

  return best || { totalDiff: 0, freshMatchCount: 0 };
}


/* ============================================================
   _cb_allMatchings

   Returns all perfect matchings of an array of pair objects
   into courts (each court = [pair, pair]).

   2 pairs  →  1 matching
   4 pairs  →  3 matchings
   6 pairs  → 15 matchings
   8+ pairs →  greedy adjacent (avoids combinatorial explosion)
   ============================================================ */
function _cb_allMatchings(pairs) {
  if (pairs.length === 2) {
    return [[[pairs[0], pairs[1]]]];
  }

  if (pairs.length === 4) {
    return [
      [[pairs[0], pairs[1]], [pairs[2], pairs[3]]],
      [[pairs[0], pairs[2]], [pairs[1], pairs[3]]],
      [[pairs[0], pairs[3]], [pairs[1], pairs[2]]],
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

  // 8+ pairs: sort by avg descending, match adjacent pairs into courts
  const sorted = [...pairs].sort((a, b) => b.avg - a.avg);
  const courts = [];
  for (let i = 0; i < sorted.length; i += 2) {
    if (sorted[i + 1]) courts.push([sorted[i], sorted[i + 1]]);
  }
  return [courts];
}


/* ============================================================
   _cb_assignCourts

   Given a set of pair objects, picks the court matching that
   minimises total avg-rating diff across all courts, using
   match freshness as a tie-breaker.

   Returns: [{ pair1:[a,b], pair2:[c,d] }, ...]
   ============================================================ */
function _cb_assignCourts(pairs, gamesMap) {
  const matchings  = _cb_allMatchings(pairs);
  let bestMatching = null;
  let bestScore    = -Infinity;

  for (const courts of matchings) {
    let score = 0;
    for (const [p1, p2] of courts) {
      const diff = Math.abs(p1.avg - p2.avg);
      const mk   = [p1.key, p2.key].sort().join(':');
      score += -(diff * 1000) + (!gamesMap || !gamesMap.has(mk) ? 10 : 0);
    }
    if (score > bestScore) {
      bestScore    = score;
      bestMatching = courts;
    }
  }

  return (bestMatching || []).map(([p1, p2]) => ({
    pair1: [p1.a, p1.b],
    pair2: [p2.a, p2.b],
  }));
}


/* ============================================================
   _cb_greedyPairs

   Used when neededFreePairs > 6 (more than 3 free courts).

   Each strong player is matched to the best available weak player:
     — fresh partner strongly preferred
     — among fresh options, prefer the partner whose combined avg
       lands closest to the overall field midpoint

   Falls back to same-half pairing for any leftover players.
   Returns pair objects compatible with _cb_assignCourts.
   ============================================================ */
function _cb_greedyPairs(sortedPlayers, strongSet, neededPairs, pairPlayedSet) {
  const strongs   = sortedPlayers.filter(p =>  strongSet.has(p));
  const weaks     = sortedPlayers.filter(p => !strongSet.has(p)).reverse(); // weakest first
  const available = new Set(sortedPlayers);
  const pairs     = [];

  for (const s of strongs) {
    if (!available.has(s) || pairs.length >= neededPairs) break;

    let bestWeak  = null;
    let bestScore = -Infinity;

    for (const w of weaks) {
      if (!available.has(w)) continue;
      const key     = [s, w].sort().join('&');
      const isFresh = !pairPlayedSet.has(key);
      // Prefer fresh; among fresh options, prefer partner that balances ratings
      const avg     = (_cb_ratingOf(s) + _cb_ratingOf(w)) / 2;
      const score   = (isFresh ? 1000 : 0) - Math.abs(avg - 2.5);
      if (score > bestScore) { bestScore = score; bestWeak = w; }
    }

    if (bestWeak) {
      const key = [s, bestWeak].sort().join('&');
      pairs.push({
        a: s, b: bestWeak, key,
        avg:         (_cb_ratingOf(s) + _cb_ratingOf(bestWeak)) / 2,
        isCross:     true,
        isFreshPair: !pairPlayedSet.has(key),
        tier:        !pairPlayedSet.has(key) ? 3 : 2,
      });
      available.delete(s);
      available.delete(bestWeak);
    }
  }

  // Fill remaining slots with same-half pairs if needed
  const remaining = [...available];
  for (let i = 0; i < remaining.length - 1 && pairs.length < neededPairs; i += 2) {
    const a   = remaining[i];
    const b   = remaining[i + 1];
    const key = [a, b].sort().join('&');
    pairs.push({
      a, b, key,
      avg:         (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
      isCross:     false,
      isFreshPair: !pairPlayedSet.has(key),
      tier:        !pairPlayedSet.has(key) ? 1 : 0,
    });
  }

  return pairs;
}


/* ============================================================
   _cb_mergeFixedAndFree

   Combines fixed-pair courts with free-player courts.
   Converts all pairs to pair objects and re-runs court assignment
   so overall balance is optimised across both sets.
   ============================================================ */
function _cb_mergeFixedAndFree(fixedPairs, freeGames, gamesMap) {
  if (fixedPairs.length === 0) return freeGames;

  const allPairObjs = [];

  // Fixed pairs → pair objects
  for (const [a, b] of fixedPairs) {
    allPairObjs.push({
      a, b,
      key:         [a, b].sort().join('&'),
      avg:         (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
      isCross:     true,
      isFreshPair: true,
      tier:        3,
    });
  }

  // Extract pair objects from free games
  for (const g of freeGames) {
    for (const [a, b] of [g.pair1, g.pair2]) {
      allPairObjs.push({
        a, b,
        key:         [a, b].sort().join('&'),
        avg:         (_cb_ratingOf(a) + _cb_ratingOf(b)) / 2,
        isCross:     true,
        isFreshPair: true,
        tier:        3,
      });
    }
  }

  // Safety: must be even
  if (allPairObjs.length % 2 !== 0) allPairObjs.pop();

  return _cb_assignCourts(allPairObjs, gamesMap);
}
