/* ============================================================
   COMPETITIVE ALGORITHM — Tier calculation, point tracking, match fairness
   File: competitive_algorithm.js
   ============================================================ */

// ============================================================
//  COMPETITIVE ROUND ALGORITHM
//  Full implementation based on discussion
// ============================================================

// ============================================================
//  SECTION 1 — POINTS & STREAK HELPERS
// ============================================================

/**
 * Rebuild points and streaks fresh from allRounds every time.
 * Reads game.winner ("L" or "R") and game.pair1 / game.pair2
 * to determine who won and who lost.
 *
 * Returns:
 *   rankPoints  : Map<playerName, number>   (starts at 100)
 *   streakMap   : Map<playerName, number>   (+ = win streak, - = loss streak)
 */
function buildPointsAndStreaks(allRounds, activeplayers) {

  // Initialise every active player at 100 / streak 0
  const rankPoints = new Map();
  const streakMap  = new Map();

  for (const p of activeplayers) {
    rankPoints.set(p, 100);
    streakMap.set(p, 0);
  }

  // Replay every completed round in order
  for (const round of allRounds) {
    if (!round?.games) continue;

    for (const game of round.games) {

      // Skip unfinished games
      if (!game.winner || !game.pair1 || !game.pair2) continue;

      const winners = game.winner === 'L' ? game.pair1 : game.pair2;
      const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

      for (const p of winners) {
        applyResult(p, true,  rankPoints, streakMap);
      }

      for (const p of losers) {
        applyResult(p, false, rankPoints, streakMap);
      }
    }
  }

  return { rankPoints, streakMap };
}

/**
 * Apply one win or loss to a single player.
 *
 * Points rules (confirmed):
 *   Win                  → +2
 *   Consecutive win      → +1 bonus (flat, not increasing)
 *   Loss                 → -2
 *   Consecutive loss     → -1 penalty (flat, not increasing)
 *   Any loss resets win streak, any win resets loss streak.
 */
function applyResult(player, isWin, rankPoints, streakMap) {

  const currentStreak = streakMap.get(player) || 0;
  let delta = 0;

  if (isWin) {
    delta = 2;
    if (currentStreak > 0) delta += 1;          // consecutive win bonus
    streakMap.set(player, Math.max(currentStreak, 0) + 1);
  } else {
    delta = -2;
    if (currentStreak < 0) delta -= 1;          // consecutive loss penalty
    streakMap.set(player, Math.min(currentStreak, 0) - 1);
  }

  rankPoints.set(player, (rankPoints.get(player) || 100) + delta);
}


// ============================================================
//  SECTION 2 — TIER HELPERS
// ============================================================

/**
 * Split active players into Strong / Inter / Weak
 * using top / middle / bottom 33% of current rankPoints.
 *
 * Returns Map<playerName, "strong"|"inter"|"weak">
 */
function calculateTiers(activeplayers, rankPoints) {

  // Sort descending by points
  const sorted = [...activeplayers].sort(
    (a, b) => (rankPoints.get(b) || 100) - (rankPoints.get(a) || 100)
  );

  const total     = sorted.length;
  const topCut    = Math.ceil(total / 3);
  const bottomCut = Math.floor((total * 2) / 3);

  const tierMap = new Map();

  sorted.forEach((p, i) => {
    if (i < topCut)          tierMap.set(p, 'strong');
    else if (i < bottomCut)  tierMap.set(p, 'inter');
    else                     tierMap.set(p, 'weak');
  });

  return tierMap;
}

/**
 * Return tier string for one player.
 */
function getPlayerTier(player, tierMap) {
  return tierMap.get(player) || 'inter';
}


// ============================================================
//  SECTION 3 — TIER RULE CHECKER
// ============================================================

/**
 * Given two pairs and the tierMap, return which rule the
 * matchup satisfies:
 *
 *   Rule 1 — all 4 same tier          (best)
 *   Rule 2 — both pairs identical mix  (S+I vs S+I etc.)
 *   Rule 3 — S+W vs I+I               (compensated)
 *   Rule 0 — none of the above        (fallback)
 */
function getGameTierRule(pair1, pair2, tierMap) {

  const [t1a, t1b] = pair1.map(p => getPlayerTier(p, tierMap));
  const [t2a, t2b] = pair2.map(p => getPlayerTier(p, tierMap));

  const sig1 = [t1a, t1b].sort().join('+');
  const sig2 = [t2a, t2b].sort().join('+');

  // Rule 1 — all same tier
  const rule1Sigs = ['strong+strong', 'inter+inter', 'weak+weak'];
  if (rule1Sigs.includes(sig1) && sig1 === sig2) return 1;

  // Rule 2 — identical mixed composition both sides
  const rule2Sigs = ['inter+strong', 'strong+weak', 'inter+weak'];
  if (rule2Sigs.includes(sig1) && sig1 === sig2) return 2;

  // Rule 3 — S+W vs I+I  (either way around)
  const isSwPair   = s => s === 'strong+weak' || s === 'weak+strong';
  const isIIPair   = s => s === 'inter+inter';
  if ((isSwPair(sig1) && isIIPair(sig2)) ||
      (isIIPair(sig1) && isSwPair(sig2))) return 3;

  return 0;
}


// ============================================================
//  SECTION 4 — BEST COURT COMBINATION (global across courts)
// ============================================================

/**
 * Given a pool of players and the number of courts,
 * find the globally best assignment of players to courts
 * maximising the sum of tier-rule scores across all courts.
 *
 * Scoring per court:
 *   Rule 1 → 3 pts
 *   Rule 2 → 2 pts
 *   Rule 3 → 1 pt
 *   Random → 0 pts
 *
 * For each court we also respect:
 *   - pairPlayedSet  (prefer new partnerships)
 *   - opponentMap    (prefer fresh opponents)
 *   - isGameRepeated (if repeated → force random for that court)
 *
 * Returns array of games:
 *   [{ pair1, pair2, courtRule }]
 */
function findBestCourtCombination(playing, numCourts, tierMap, state) {

  const { pairPlayedSet, opponentMap } = state;

  // Generate all possible pairs from playing pool
  const allPossiblePairs = [];
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      allPossiblePairs.push([playing[i], playing[j]]);
    }
  }

  let bestScore  = -Infinity;
  let bestGames  = null;

  // Cap combinations to avoid explosion
  const MAX_ITERATIONS = 2000;
  let iterations = 0;

  /**
   * Recursive backtracking:
   * At each step pick a pair for the next team slot,
   * then pair it with an opponent, assign to a court.
   */
  function solve(remainingPlayers, currentGames, currentScore) {

    if (iterations++ > MAX_ITERATIONS) return;

    // All courts filled
    if (currentGames.length === numCourts) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestGames = currentGames.slice();
      }
      return;
    }

    // Not enough players left to fill remaining courts
    if (remainingPlayers.length < 4) return;

    const usedInStep = new Set();

    // Try every pair combination for team1
    for (let i = 0; i < remainingPlayers.length; i++) {
      for (let j = i + 1; j < remainingPlayers.length; j++) {

        const p1 = remainingPlayers[i];
        const p2 = remainingPlayers[j];
        const team1 = [p1, p2];

        // Try every pair combination for team2 from the rest
        const restAfterTeam1 = remainingPlayers.filter(
          p => p !== p1 && p !== p2
        );

        for (let k = 0; k < restAfterTeam1.length; k++) {
          for (let l = k + 1; l < restAfterTeam1.length; l++) {

            const p3 = restAfterTeam1[k];
            const p4 = restAfterTeam1[l];
            const team2 = [p3, p4];

            // Check if this game has been played before
            const gameObj = { pair1: team1, pair2: team2 };
            const repeated = isGameRepeated(gameObj);

            let courtScore = 0;
            let courtRule  = 0;

            if (repeated) {
              // Force random for this court — score 0
              courtScore = 0;
              courtRule  = -1; // marker for random
            } else {
              courtRule  = getGameTierRule(team1, team2, tierMap);
              courtScore = courtRule === 1 ? 3
                         : courtRule === 2 ? 2
                         : courtRule === 3 ? 1
                         : 0;

              // Bonus for new partnerships
              const key1 = createSortedKey(p1, p2);
              const key2 = createSortedKey(p3, p4);
              if (!pairPlayedSet.has(key1)) courtScore += 0.5;
              if (!pairPlayedSet.has(key2)) courtScore += 0.5;

              // Bonus for fresh opponents
              const oppFresh = getOpponentFreshness(team1, team2, opponentMap);
              courtScore += oppFresh * 0.1;
            }

            const nextRemaining = restAfterTeam1.filter(
              p => p !== p3 && p !== p4
            );

            currentGames.push({
              pair1: [...team1],
              pair2: [...team2],
              courtRule,
              repeated
            });

            solve(nextRemaining, currentGames, currentScore + courtScore);

            currentGames.pop();

            if (iterations > MAX_ITERATIONS) return;
          }
        }
      }
    }
  }

  solve([...playing], [], 0);

  // Search exhausted → your existing RandomRound() takes over
  if (!bestGames) {
    const randomResult = RandomRound(state);
    return randomResult.games.map(g => ({
      pair1:     g.pair1,
      pair2:     g.pair2,
      courtRule: 0,
      repeated:  false
    }));
  }

  return bestGames;
}

/**
 * Count how many of the 4 opponent sub-matchups are fresh (never seen).
 */
function getOpponentFreshness(team1, team2, opponentMap) {
  let fresh = 0;
  for (const a of team1) {
    for (const b of team2) {
      if ((opponentMap.get(a)?.get(b) || 0) === 0) fresh++;
    }
  }
  return fresh; // 0–4
}


// ============================================================
//  SECTION 5 — FROZEN COURT HANDLER
// ============================================================

/**
 * When a court is frozen (game repeated), delegate entirely
 * to your existing RandomRound() scoped to just these 4 players.
 */
function findFreshRandomMatchup(courtPlayers, state) {

  const tempState = {
    ...state,
    activeplayers: courtPlayers,
    courts: 1
  };

  const randomResult = RandomRound(tempState);

  if (randomResult?.games?.length > 0) {
    return {
      pair1: randomResult.games[0].pair1,
      pair2: randomResult.games[0].pair2
    };
  }

  return null;
}


// ============================================================
//  SECTION 6 — WARM UP CHECK
// ============================================================

/**
 * Returns true if enough rounds have been played to start
 * competitive mode. Uses state.minRounds set from user input.
 */
function isWarmupComplete(state) {
  const minRounds = state.minRounds || 6; // default 6
  return allRounds.length >= minRounds;
}


// ============================================================
//  SECTION 7 — MAIN CompetitiveRound
// ============================================================

/**
 * CompetitiveRound(state)
 *
 * Called when warm-up is complete and mode is "competitive".
 * Receives playing list already resolved by parent.
 *
 * Per court logic:
 *   1. Check if proposed game is a repetition
 *      YES → random matchup for that court
 *      NO  → Rule 1 → Rule 2 → Rule 3 → fallback random
 *
 * Global:
 *   - Tries to maximise rule quality ACROSS ALL courts together
 *   - Updates points and streaks AFTER winners are marked
 *     (called from toggleRound when returning to idle)
 */
function CompetitiveRound(state) {

  const { activeplayers, courts, opponentMap } = state;

  // ── 1. Rebuild points + streaks from allRounds ──────────
  const { rankPoints, streakMap } = buildPointsAndStreaks(
    allRounds,
    activeplayers
  );

  // Store on state so UI / other functions can read them
  state.rankPoints = rankPoints;
  state.streakMap  = streakMap;

  // ── 2. Recalculate tiers ─────────────────────────────────
  const tierMap = calculateTiers(activeplayers, rankPoints);
  state.tierMap = tierMap;

  // ── 3. Get playing list (resting already resolved) ───────
  const { playing, resting } = getPlayingAndResting(state);

  // ── 4. Update repetition history ────────────────────────
  updatePreviousHistory(allRounds.length);

  // ── 5. Find globally best court combination ──────────────
  const proposedGames = findBestCourtCombination(
    playing,
    courts,
    tierMap,
    state
  );

  // ── 6. Per-court: handle repeated games → random ─────────
  const finalGames = [];

  for (let c = 0; c < proposedGames.length; c++) {

    const proposed = proposedGames[c];

    if (proposed.repeated || proposed.courtRule === -1) {

      // Court is frozen → delegate to RandomRound()
      const courtPlayers = [...proposed.pair1, ...proposed.pair2];
      const fresh = findFreshRandomMatchup(courtPlayers, state);

      if (fresh) {
        finalGames.push({
          court:     c + 1,
          pair1:     [...fresh.pair1],
          pair2:     [...fresh.pair2],
          courtRule: 0,
          isRandom:  true
        });
      } else {
        // Absolute fallback — RandomRound() on full state
        const rr = RandomRound(state);
        const rrGame = rr.games[c] || rr.games[0];
        finalGames.push({
          court:     c + 1,
          pair1:     [...rrGame.pair1],
          pair2:     [...rrGame.pair2],
          courtRule: 0,
          isRandom:  true
        });
      }

    } else {

      // Court is clean — use tier-rule result
      finalGames.push({
        court:     c + 1,
        pair1:     [...proposed.pair1],
        pair2:     [...proposed.pair2],
        courtRule: proposed.courtRule,
        isRandom:  false
      });
    }
  }

  // ── 7. Update pair + opponent memory ─────────────────────
  updateAfterRound(state, finalGames.map(g => [g.pair1, g.pair2]));

  return {
    games:   finalGames,
    resting,
    tierMap  // expose for UI if needed
  };
}


// ============================================================
//  SECTION 8 — UPDATED PARENT FUNCTION
// ============================================================

/**
 * AischedulerNextRound(schedulerState)
 *
 * Parent decides:
 *   - Warm up not complete  → RandomRound()
 *   - Warm up complete      → CompetitiveRound()
 *
 * The per-court freeze logic now lives INSIDE CompetitiveRound.
 * No mode memory needed — fresh check every round.
 */
function AischedulerNextRound(schedulerState) {

  const { activeplayers } = schedulerState;
  const playmode = getPlayMode();
  const page2    = document.getElementById('roundsPage');

  // ── Warm up gate ─────────────────────────────────────────
  const warmupDone = isWarmupComplete(schedulerState);

  let result;

  if (playmode === 'random' || !warmupDone) {

    // Random phase
    result = RandomRound(schedulerState);

    page2.classList.remove('competitive-mode');
    page2.classList.add('random-mode');

    schedulerState._lastMode = 'random';

  } else {

    // Competitive phase
    // Reset competitive memory only once on first entry
    if (schedulerState._lastMode !== 'competitive') {
      resetForCompetitivePhase(schedulerState);
    }

    result = CompetitiveRound(schedulerState);

    page2.classList.remove('random-mode');
    page2.classList.add('competitive-mode');

    schedulerState._lastMode = 'competitive';
  }

  return result;
}


// ============================================================
//  SECTION 9 — POINTS UPDATE (called on round end)
// ============================================================

/**
 * Called when the round ends (user clicks End Round).
 * Reads winners from the latest completed round and updates
 * rankPoints + streakMap on schedulerState.
 *
 * NOTE: buildPointsAndStreaks() recalculates from scratch
 * at the START of each CompetitiveRound, so this function
 * is mainly for UI display between rounds.
 */
function updatePointsAfterRound(state) {

  const latestRound = allRounds[allRounds.length - 1];
  if (!latestRound?.games) return;

  for (const game of latestRound.games) {

    if (!game.winner || !game.pair1 || !game.pair2) continue;

    const winners = game.winner === 'L' ? game.pair1 : game.pair2;
    const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

    for (const p of winners) {
      applyResult(p, true,  state.rankPoints, state.streakMap);
    }
    for (const p of losers) {
      applyResult(p, false, state.rankPoints, state.streakMap);
    }
  }
}


// ============================================================
//  SECTION 10 — STATE INITIALISATION ADDITIONS
// ============================================================

/**
 * Add these fields to schedulerState when initialising your session.
 * Merge with your existing initialisation code.
 *
 *   state.minRounds  = parseInt(userInput) || 6;
 *   state.rankPoints = new Map();   // will be rebuilt each round
 *   state.streakMap  = new Map();   // will be rebuilt each round
 *   state.tierMap    = new Map();   // will be rebuilt each round
 *
 * All active players start at:
 *   rankPoints = 100
 *   streak     = 0
 */


// ============================================================
//  HELPER — createSortedKey (if not already in your codebase)
// ============================================================

/**
 * Canonical sorted key for a pair of players.
 * Use this everywhere instead of mixing getPairKey / createSortedKey.
 */
function createSortedKey(a, b) {
  return [a, b].sort().join('|');
}
