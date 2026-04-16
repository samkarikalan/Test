/* ============================================================
   ALGORITHM V2 -- Rating-Aware Competitive Scheduler
   
   Functions:
   - AischedulerNextRound         : dispatcher — routes by getPlayMode()
                                    "competitive" → RatingAischedulerNextRound
                                    "random"      → OriginalAischedulerNextRound
   - RatingAischedulerNextRound   : competitive entry — balances teams by rating
   - _v2_findRatingPairs          : DFS pair picker, weights freshness + rating balance
   - _v2_getMatchupScores         : scores matchups by freshness + court balance
   - _v2_ratingOf                 : safe rating reader (falls back to 1.0)

   All helpers are prefixed _v2_ to avoid any collision with existing globals.

   Input / output contract is IDENTICAL to OriginalAischedulerNextRound:
     IN  → schedulerState (same object, same fields)
     OUT → { round, resting: ["name#N",...], playing: [...], games: [{court,pair1,pair2},...] }

   Scoring weights:
     Pair formation:
       +100  fresh partnership (never paired before)   ← same strong priority as original
       +0–20 rating balance bonus  (20 = perfectly matched, 0 = gap ≥ 1.0)

     Court matchup:
       freshness (0–4 unseen cross-matchups) × 10     ← primary, same as original
       +0–10 court balance bonus (10 = avg ratings equal, 0 = gap ≥ 1.0)
       totalScore ASC tie-break                        ← same as original
   ============================================================ */


// ── Dispatcher: replaces the original AischedulerNextRound entry point ──
function AischedulerNextRound(schedulerState) {
  if (typeof getPlayMode === 'function' && getPlayMode() === 'competitive') {
    return RatingAischedulerNextRound(schedulerState);
  }
  return OriginalAischedulerNextRound(schedulerState);
}


// ── Safe rating reader ──
function _v2_ratingOf(name) {
  try {
    if (typeof getActiveRating === 'function') return getActiveRating(name);
    if (typeof getRating       === 'function') return getRating(name);
  } catch (e) { /* fall through */ }
  return 1.0;
}


// ── Main entry for competitive mode ──
function RatingAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
    lastRound,
  } = schedulerState;

  const totalPlayers      = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting        = Math.max(totalPlayers - numPlayersPerRound, 0);

  // ================= REST SELECTION (identical to original) =================
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
        if (needed >= 2) {
          resting.push(p, partner);
          needed -= 2;
        }
      } else if (needed > 0) {
        resting.push(p);
        needed -= 1;
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

  // ================= PAIR PREP (identical to original) =================
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(
    p => !fixedPairPlayersThisRound.has(p)
  );

  // reorderFreePlayersByLastRound is defined in competitive_algorithm.js
  freePlayersThisRound = reorderFreePlayersByLastRound(
    freePlayersThisRound,
    lastRound,
    numCourts
  );

  // ================= ALL FIXED DETECTION (identical to original) =================
  const allFixed =
    freePlayersThisRound.length === 0 &&
    fixedPairs.length >= numCourts * 2;

  if (allFixed) {
    // getNextFixedPairGames is defined in games.js
    const games = getNextFixedPairGames(schedulerState, fixedPairs, numCourts);

    const playingPlayers = new Set(
      games.flatMap(g => [...g.pair1, ...g.pair2])
    );

    resting = activeplayers.filter(p => !playingPlayers.has(p));
    playing = [...playingPlayers];

    schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

    return {
      round: schedulerState.roundIndex,
      resting: resting.map(p => {
        const c = restCount.get(p) || 0;
        return `${p}#${c + 1}`;
      }),
      playing,
      games,
    };
  }

  // ================= RATING-AWARE FREE PAIR LOGIC =================
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  const neededFreePairs    = requiredPairsCount - fixedPairsThisRound.length;

  let selectedPairs = _v2_findRatingPairs(
    freePlayersThisRound,
    schedulerState.pairPlayedSet,
    neededFreePairs,
    opponentMap
  );

  let finalFreePairs = selectedPairs || [];

  // Fallback: fill any gaps greedily (same as original)
  if (finalFreePairs.length < neededFreePairs) {
    const free       = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());

    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;

      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;

        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }

      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  // ================= RATING-AWARE COURT MATCHUP =================
  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  // shuffle defined in competitive_algorithm.js
  allPairs = shuffle(allPairs);

  const matchupScores = _v2_getMatchupScores(allPairs, opponentMap);
  const games         = [];
  const usedPairs     = new Set();

  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join('&');
    const p2Key = pair2.join('&');

    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;

    games.push({
      court: games.length + 1,
      pair1: [...pair1],
      pair2: [...pair2],
    });

    usedPairs.add(p1Key);
    usedPairs.add(p2Key);

    if (games.length >= numCourts) break;
  }

  const restingWithNumber = resting.map(p => {
    const c = restCount.get(p) || 0;
    return `${p}#${c + 1}`;
  });

  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };
}


function _v2_findRatingPairs(playing, usedPairsSet, requiredPairsCount, opponentMap) {
  const unusedPairs = [];
  const usedPairs   = [];
  const allPairs    = [];

  // Build all pair candidates
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a   = playing[i];
      const b   = playing[j];
      const key = [a, b].slice().sort().join('&');
      const isNew = !usedPairsSet || !usedPairsSet.has(key);

      const gap = Math.abs(_v2_ratingOf(a) - _v2_ratingOf(b));

      // 🔥 Improved balance bonus
      const balanceBonus = Math.max(0, 30 - gap * 30);

      const pairObj = { a, b, key, isNew, balanceBonus };
      allPairs.push(pairObj);

      if (isNew) unusedPairs.push(pairObj);
      else       usedPairs.push(pairObj);
    }
  }

  function pickBest(candidates) {

    // ✅ 1. SORT (very important)
    candidates.sort((a, b) => {
      if (b.isNew !== a.isNew) return b.isNew - a.isNew;
      return b.balanceBonus - a.balanceBonus;
    });

    const usedPlayers = new Set();
    const selected    = [];
    let   best        = null;

    // ✅ 2. Dynamic branch limit
    const MAX_BRANCHES = 8000 + playing.length * 1000;
    let branches = 0;

    // ✅ 3. Perfect score threshold
    const PERFECT_SCORE = requiredPairsCount * 130; // 100 + ~30

    function dfs(startIndex, baseScore) {

      if (branches++ > MAX_BRANCHES) return;

      // ✅ 4. Perfect solution early stop
      if (best && best.score >= PERFECT_SCORE) return;

      // ✅ 5. Upper bound pruning
      const maxRemaining =
        (requiredPairsCount - selected.length) * 130;

      if (best && baseScore + maxRemaining < best.score) return;

      // ✅ Completed selection
      if (selected.length === requiredPairsCount) {
        if (!best || baseScore > best.score) {
          best = { score: baseScore, pairs: selected.slice() };
        }
        return;
      }

      for (let i = startIndex; i < candidates.length; i++) {
        const { a, b, isNew, balanceBonus } = candidates[i];

        if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

        usedPlayers.add(a);
        usedPlayers.add(b);
        selected.push([a, b]);

        const gap = Math.abs(_v2_ratingOf(a) - _v2_ratingOf(b));

        // 🔥 6. Imbalance penalty
        const imbalancePenalty = gap > 1.5 ? -40 : 0;

        const newPairScore = isNew ? 100 : 0;

        dfs(
          i + 1,
          baseScore + newPairScore + balanceBonus + imbalancePenalty
        );

        selected.pop();
        usedPlayers.delete(a);
        usedPlayers.delete(b);
      }
    }

    dfs(0, 0);
    return best ? best.pairs : null;
  }

  // 1️⃣ Try new pairs only
  if (unusedPairs.length >= requiredPairsCount) {
    const best = pickBest(unusedPairs);
    if (best) return best;
  }

  // 2️⃣ Try mixed
  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const best = pickBest(combined);
    if (best) return best;
  }

  // 3️⃣ Fallback
  if (allPairs.length >= requiredPairsCount) {
    const best = pickBest(allPairs);
    if (best) return best;
  }

  return [];
}

/* ============================================================
   _v2_findRatingPairs
   
   DFS pair picker — extends original findDisjointPairs with rating balance.

   Scoring per pair candidate:
     freshnessBonus    = isNew ? 100 : 0
     ratingBalanceBonus = max(0, 20 - |ratingA - ratingB| * 20)
       → 20 pts for equal ratings, 0 pts for gap ≥ 1.0

   Fresh pair priority is preserved — a new unbalanced pair still beats
   a repeat pair. Balance only separates candidates within the same
   freshness tier.
   ============================================================ */


/* ============================================================
   _v2_getMatchupScores
   
   Scores every pair-vs-pair matchup.
   Primary sort: freshness DESC (same as original, 0–4 unseen cross-matchups)
   Secondary:    court balance bonus DESC (higher = more equal avg ratings)
   Tertiary:     totalScore ASC (fewer past encounters, same as original)

   Court balance bonus: 0–10
     10 = both pairs have equal avg rating
     0  = avg rating gap ≥ 1.0
   ============================================================ */
function _v2_getMatchupScores(allPairs, opponentMap) {
  const matchupScores = [];

  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      const [a1, a2] = allPairs[i];
      const [b1, b2] = allPairs[j];

      // Past encounter counts (identical to original)
      const ab11 = opponentMap.get(a1)?.get(b1) || 0;
      const ab12 = opponentMap.get(a1)?.get(b2) || 0;
      const ab21 = opponentMap.get(a2)?.get(b1) || 0;
      const ab22 = opponentMap.get(a2)?.get(b2) || 0;

      const totalScore = ab11 + ab12 + ab21 + ab22;

      const freshness =
        (ab11 === 0 ? 1 : 0) +
        (ab12 === 0 ? 1 : 0) +
        (ab21 === 0 ? 1 : 0) +
        (ab22 === 0 ? 1 : 0);

      // Individual freshness for tie-break (identical to original)
      const opponentFreshness = {
        a1: (ab11 === 0 ? 1 : 0) + (ab12 === 0 ? 1 : 0),
        a2: (ab21 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
        b1: (ab11 === 0 ? 1 : 0) + (ab21 === 0 ? 1 : 0),
        b2: (ab12 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
      };

      // Court balance: compare avg rating of each side
      const avgPair1 = (_v2_ratingOf(a1) + _v2_ratingOf(a2)) / 2;
      const avgPair2 = (_v2_ratingOf(b1) + _v2_ratingOf(b2)) / 2;
      const courtGap = Math.abs(avgPair1 - avgPair2);
      const courtBalanceBonus = Math.max(0, 10 - courtGap * 10);

      matchupScores.push({
        pair1: allPairs[i],
        pair2: allPairs[j],
        freshness,
        totalScore,
        opponentFreshness,
        courtBalanceBonus,
      });
    }
  }

  // Sort: freshness DESC → courtBalanceBonus DESC → totalScore ASC → opponentFreshness sum DESC
  matchupScores.sort((a, b) => {
    if (b.freshness !== a.freshness)
      return b.freshness - a.freshness;

    if (b.courtBalanceBonus !== a.courtBalanceBonus)
      return b.courtBalanceBonus - a.courtBalanceBonus;

    if (a.totalScore !== b.totalScore)
      return a.totalScore - b.totalScore;

    const aSum = a.opponentFreshness.a1 + a.opponentFreshness.a2 +
                 a.opponentFreshness.b1 + a.opponentFreshness.b2;
    const bSum = b.opponentFreshness.a1 + b.opponentFreshness.a2 +
                 b.opponentFreshness.b1 + b.opponentFreshness.b2;
    return bSum - aSum;
  });

  return matchupScores;
}
