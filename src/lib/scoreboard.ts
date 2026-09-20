import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  GameScoreboard,
  ScoreboardSport,
  BaseballGameState,
  FootballGameState,
  FootballHalf,
  FootballCard,
  FootballGoal,
  InningScore,
} from '../types';

const SCOREBOARD_COLLECTION = 'gameScoreboards';

/**
 * Genera el estado inicial de béisbol con las 9 entradas base preparadas
 */
export function getInitialBaseballState(): BaseballGameState {
  const inningScores: InningScore[] = Array.from({ length: 9 }, (_, idx) => ({
    inning: idx + 1,
    home: null,
    away: null,
  }));

  return {
    currentInning: 1,
    isTopInning: true, // true = Alta (batea visitante), false = Baja (batea local)
    outs: 0,
    balls: 0,
    strikes: 0,
    inningScores,
    homeHits: 0,
    awayHits: 0,
    homeErrors: 0,
    awayErrors: 0,
  };
}

/**
 * Genera el estado inicial de fútbol
 */
export function getInitialFootballState(): FootballGameState {
  return {
    half: 'primer_tiempo',
    minute: 0,
    addedTime: 0,
    goals: [],
    cards: [],
  };
}

/**
 * Crea el documento inicial de marcador para un evento en estado 'programado'
 */
export async function createScoreboard(
  eventId: string,
  venueId: string,
  sport: ScoreboardSport,
  homeTeamName: string,
  awayTeamName: string
): Promise<GameScoreboard> {
  const docRef = doc(db, SCOREBOARD_COLLECTION, eventId);
  const now = new Date().toISOString();

  const newScoreboard: GameScoreboard = {
    id: eventId,
    eventId,
    venueId,
    sport,
    status: 'programado',
    homeTeamName: homeTeamName || 'Local',
    awayTeamName: awayTeamName || 'Visitante',
    homeScore: 0,
    awayScore: 0,
    updatedAt: now,
  };

  if (sport === 'baseball') {
    newScoreboard.baseballState = getInitialBaseballState();
  } else if (sport === 'football') {
    newScoreboard.footballState = getInitialFootballState();
  }

  await setDoc(docRef, newScoreboard);
  return newScoreboard;
}

/**
 * Obtiene un marcador por su eventId
 */
export async function getScoreboard(eventId: string): Promise<GameScoreboard | null> {
  try {
    const docRef = doc(db, SCOREBOARD_COLLECTION, eventId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as GameScoreboard;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener marcador:', error);
    return null;
  }
}

/**
 * Escucha un marcador en tiempo real por eventId
 */
export function subscribeScoreboard(
  eventId: string,
  callback: (scoreboard: GameScoreboard | null) => void
): () => void {
  const docRef = doc(db, SCOREBOARD_COLLECTION, eventId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as GameScoreboard);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`Error en subscribeScoreboard (${eventId}):`, error);
      callback(null);
    }
  );
}

/**
 * Escucha todos los marcadores en tiempo real (para Cartelera / Listados)
 */
export function subscribeAllScoreboards(
  callback: (scoreboards: Record<string, GameScoreboard>) => void
): () => void {
  const q = query(collection(db, SCOREBOARD_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const result: Record<string, GameScoreboard> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as GameScoreboard;
        result[data.eventId || docSnap.id] = data;
      });
      callback(result);
    },
    (error) => {
      console.error('Error en subscribeAllScoreboards:', error);
      callback({});
    }
  );
}

/**
 * Actualiza cualquier campo del marcador y registra updatedAt
 */
export async function updateGameState(
  eventId: string,
  changes: Partial<GameScoreboard>
): Promise<void> {
  const docRef = doc(db, SCOREBOARD_COLLECTION, eventId);
  await updateDoc(docRef, {
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Inicia el partido (pasa a 'en_vivo')
 */
export async function startGame(eventId: string): Promise<void> {
  const current = await getScoreboard(eventId);
  if (!current) return;

  const updates: Partial<GameScoreboard> = {
    status: 'en_vivo',
  };

  if (current.sport === 'football' && current.footballState) {
    updates.footballState = {
      ...current.footballState,
      half: current.footballState.half === 'finalizado' ? 'primer_tiempo' : current.footballState.half,
      minute: current.footballState.minute === 0 ? 1 : current.footballState.minute,
    };
  }

  await updateGameState(eventId, updates);
}

/**
 * Finaliza el partido (pasa a 'finalizado')
 */
export async function finalizeGame(eventId: string): Promise<void> {
  const current = await getScoreboard(eventId);
  if (!current) return;

  const updates: Partial<GameScoreboard> = {
    status: 'finalizado',
  };

  if (current.sport === 'football' && current.footballState) {
    updates.footballState = {
      ...current.footballState,
      half: 'finalizado',
    };
  }

  await updateGameState(eventId, updates);
}

/**
 * Elimina el marcador si el admin decide reiniciarlo por completo
 */
export async function deleteScoreboard(eventId: string): Promise<void> {
  const docRef = doc(db, SCOREBOARD_COLLECTION, eventId);
  await deleteDoc(docRef);
}

// ==========================================
// FUNCIONES ESPECÍFICAS DE BÉISBOL
// ==========================================

/**
 * Suma +1 carrera al equipo indicado y actualiza la entrada actual en inningScores
 */
export async function addRun(eventId: string, team: 'home' | 'away'): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  const curInning = bState.currentInning;

  // Actualizar carreras totales
  let newHomeScore = scoreboard.homeScore;
  let newAwayScore = scoreboard.awayScore;
  if (team === 'home') {
    newHomeScore += 1;
  } else {
    newAwayScore += 1;
  }

  // Actualizar tabla de entradas
  const newInningScores = [...bState.inningScores];
  let targetInningObj = newInningScores.find((item) => item.inning === curInning);

  if (!targetInningObj) {
    targetInningObj = {
      inning: curInning,
      home: null,
      away: null,
    };
    newInningScores.push(targetInningObj);
  }

  if (team === 'home') {
    targetInningObj.home = (targetInningObj.home ?? 0) + 1;
  } else {
    targetInningObj.away = (targetInningObj.away ?? 0) + 1;
  }

  bState.inningScores = newInningScores;

  await updateGameState(eventId, {
    homeScore: newHomeScore,
    awayScore: newAwayScore,
    baseballState: bState,
  });
}

/**
 * Resta -1 carrera (corrección de error de captura)
 */
export async function decrementRun(eventId: string, team: 'home' | 'away'): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  const curInning = bState.currentInning;

  let newHomeScore = scoreboard.homeScore;
  let newAwayScore = scoreboard.awayScore;

  if (team === 'home' && newHomeScore > 0) {
    newHomeScore -= 1;
  } else if (team === 'away' && newAwayScore > 0) {
    newAwayScore -= 1;
  } else {
    return;
  }

  const newInningScores = [...bState.inningScores];
  const targetInningObj = newInningScores.find((item) => item.inning === curInning);
  if (targetInningObj) {
    if (team === 'home' && (targetInningObj.home ?? 0) > 0) {
      targetInningObj.home = (targetInningObj.home ?? 0) - 1;
    } else if (team === 'away' && (targetInningObj.away ?? 0) > 0) {
      targetInningObj.away = (targetInningObj.away ?? 0) - 1;
    }
  }

  bState.inningScores = newInningScores;

  await updateGameState(eventId, {
    homeScore: newHomeScore,
    awayScore: newAwayScore,
    baseballState: bState,
  });
}

/**
 * Avanza la entrada: Alta -> Baja, o Baja -> Alta de la siguiente entrada.
 * Resetea outs, bolas y strikes a 0.
 */
export async function advanceInning(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };

  if (bState.isTopInning) {
    // Pasa de Alta (visitante) a Baja (local) de la misma entrada
    bState.isTopInning = false;
  } else {
    // Pasa de Baja (local) a Alta (visitante) de la SIGUIENTE entrada
    bState.isTopInning = true;
    bState.currentInning += 1;

    // Asegurar que la nueva entrada exista en la tabla
    const exists = bState.inningScores.some((item) => item.inning === bState.currentInning);
    if (!exists) {
      bState.inningScores.push({
        inning: bState.currentInning,
        home: null,
        away: null,
      });
    }
  }

  // Resetear cuenta y outs
  bState.outs = 0;
  bState.balls = 0;
  bState.strikes = 0;

  await updateGameState(eventId, {
    baseballState: bState,
  });
}

/**
 * Marca un Out. Si llega a 3, avanza automáticamente la entrada.
 */
export async function markOut(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  const nextOuts = bState.outs + 1;

  if (nextOuts >= 3) {
    // 3 outs -> cambiar de media entrada automáticamente
    await advanceInning(eventId);
  } else {
    bState.outs = nextOuts;
    // Resetea bolas y strikes para el siguiente bateador
    bState.balls = 0;
    bState.strikes = 0;
    await updateGameState(eventId, {
      baseballState: bState,
    });
  }
}

/**
 * Marca una Bola (0-3). Si llega a 4, se resetea la cuenta (Base por bolas).
 */
export async function markBall(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  const nextBalls = bState.balls + 1;

  if (nextBalls >= 4) {
    // Base por bolas (Walk) -> resetea cuenta
    bState.balls = 0;
    bState.strikes = 0;
  } else {
    bState.balls = nextBalls;
  }

  await updateGameState(eventId, {
    baseballState: bState,
  });
}

/**
 * Marca un Strike (0-2). Si llega a 3, es Ponche (Out automático).
 */
export async function markStrike(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  const nextStrikes = bState.strikes + 1;

  if (nextStrikes >= 3) {
    // Ponche (Strikeout) -> marca out
    await markOut(eventId);
  } else {
    bState.strikes = nextStrikes;
    await updateGameState(eventId, {
      baseballState: bState,
    });
  }
}

/**
 * Resetea la cuenta actual de bolas y strikes
 */
export async function resetCount(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };
  bState.balls = 0;
  bState.strikes = 0;

  await updateGameState(eventId, {
    baseballState: bState,
  });
}

/**
 * Actualiza Hits o Errores de local o visitante
 */
export async function updateHitsErrors(
  eventId: string,
  team: 'home' | 'away',
  type: 'hit' | 'error',
  delta: number
): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'baseball' || !scoreboard.baseballState) return;

  const bState = { ...scoreboard.baseballState };

  if (team === 'home') {
    if (type === 'hit') {
      bState.homeHits = Math.max(0, bState.homeHits + delta);
    } else {
      bState.homeErrors = Math.max(0, bState.homeErrors + delta);
    }
  } else {
    if (type === 'hit') {
      bState.awayHits = Math.max(0, bState.awayHits + delta);
    } else {
      bState.awayErrors = Math.max(0, bState.awayErrors + delta);
    }
  }

  await updateGameState(eventId, {
    baseballState: bState,
  });
}

// ==========================================
// FUNCIONES ESPECÍFICAS DE FÚTBOL
// ==========================================

/**
 * Suma un gol al marcador Y lo agrega al arreglo goals
 */
export async function addGoal(
  eventId: string,
  team: 'home' | 'away',
  playerName: string,
  minute: number
): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  const newGoal: FootballGoal = {
    team,
    playerName: playerName.trim() || (team === 'home' ? scoreboard.homeTeamName : scoreboard.awayTeamName),
    minute: Math.max(1, minute || fState.minute || 1),
  };

  const newGoals = [...fState.goals, newGoal].sort((a, b) => a.minute - b.minute);
  fState.goals = newGoals;

  const newHomeScore = team === 'home' ? scoreboard.homeScore + 1 : scoreboard.homeScore;
  const newAwayScore = team === 'away' ? scoreboard.awayScore + 1 : scoreboard.awayScore;

  await updateGameState(eventId, {
    homeScore: newHomeScore,
    awayScore: newAwayScore,
    footballState: fState,
  });
}

/**
 * Elimina un gol por índice (corrección en panel de admin)
 */
export async function removeGoal(eventId: string, goalIndex: number): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  if (goalIndex < 0 || goalIndex >= fState.goals.length) return;

  const removed = fState.goals[goalIndex];
  fState.goals = fState.goals.filter((_, idx) => idx !== goalIndex);

  const newHomeScore = removed.team === 'home' ? Math.max(0, scoreboard.homeScore - 1) : scoreboard.homeScore;
  const newAwayScore = removed.team === 'away' ? Math.max(0, scoreboard.awayScore - 1) : scoreboard.awayScore;

  await updateGameState(eventId, {
    homeScore: newHomeScore,
    awayScore: newAwayScore,
    footballState: fState,
  });
}

/**
 * Agrega una tarjeta a cards (no afecta el marcador)
 */
export async function addCard(
  eventId: string,
  team: 'home' | 'away',
  playerName: string,
  minute: number,
  type: 'amarilla' | 'roja'
): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  const newCard: FootballCard = {
    team,
    playerName: playerName.trim() || (team === 'home' ? scoreboard.homeTeamName : scoreboard.awayTeamName),
    minute: Math.max(1, minute || fState.minute || 1),
    type,
  };

  const newCards = [...fState.cards, newCard].sort((a, b) => a.minute - b.minute);
  fState.cards = newCards;

  await updateGameState(eventId, {
    footballState: fState,
  });
}

/**
 * Elimina una tarjeta por índice (corrección en panel de admin)
 */
export async function removeCard(eventId: string, cardIndex: number): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  if (cardIndex < 0 || cardIndex >= fState.cards.length) return;

  fState.cards = fState.cards.filter((_, idx) => idx !== cardIndex);

  await updateGameState(eventId, {
    footballState: fState,
  });
}

/**
 * Avanza el tiempo de fútbol:
 * primer_tiempo -> entretiempo -> segundo_tiempo -> finalizado
 */
export async function advanceHalf(eventId: string): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  let newHalf: FootballHalf = 'primer_tiempo';
  let newStatus = scoreboard.status;

  switch (fState.half) {
    case 'primer_tiempo':
      newHalf = 'entretiempo';
      fState.minute = 45;
      fState.addedTime = 0;
      break;
    case 'entretiempo':
      newHalf = 'segundo_tiempo';
      fState.minute = 46;
      fState.addedTime = 0;
      break;
    case 'segundo_tiempo':
      newHalf = 'finalizado';
      newStatus = 'finalizado';
      fState.minute = 90;
      fState.addedTime = 0;
      break;
    case 'finalizado':
      // Si ya estaba finalizado, permitir volver a primer tiempo si el admin lo desea
      newHalf = 'primer_tiempo';
      newStatus = 'programado';
      fState.minute = 0;
      fState.addedTime = 0;
      break;
  }

  fState.half = newHalf;

  await updateGameState(eventId, {
    status: newStatus,
    footballState: fState,
  });
}

/**
 * Actualiza el minuto mostrado y tiempo agregado
 */
export async function updateMinute(
  eventId: string,
  minute: number,
  addedTime?: number
): Promise<void> {
  const scoreboard = await getScoreboard(eventId);
  if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return;

  const fState = { ...scoreboard.footballState };
  fState.minute = Math.max(0, minute);
  if (addedTime !== undefined) {
    fState.addedTime = Math.max(0, addedTime);
  }

  await updateGameState(eventId, {
    footballState: fState,
  });
}
