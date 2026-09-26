import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  HistoricalGame,
  GameScoreboard,
  InningScore,
  ScoreboardSport,
} from '../types';
import { DEFAULT_VENUE_ID } from './constants';

function generateInningScores(
  homeRuns: number[],
  awayRuns: number[]
): InningScore[] {
  return Array.from({ length: 9 }, (_, idx) => ({
    inning: idx + 1,
    home: homeRuns[idx] !== undefined ? homeRuns[idx] : 0,
    away: awayRuns[idx] !== undefined ? awayRuns[idx] : 0,
  }));
}

/**
 * Juegos históricos base con estadísticas completas para cada recinto
 */
export const DEFAULT_HISTORICAL_GAMES: HistoricalGame[] = [];

/**
 * Convierte un GameScoreboard de Firestore a HistoricalGame
 */
export function scoreboardToHistoricalGame(
  sb: GameScoreboard,
  venueName?: string
): HistoricalGame {
  let winner: 'home' | 'away' | 'tie' = 'tie';
  if (sb.homeScore > sb.awayScore) winner = 'home';
  else if (sb.awayScore > sb.homeScore) winner = 'away';

  return {
    id: sb.id || sb.eventId,
    eventId: sb.eventId,
    venueId: sb.venueId || DEFAULT_VENUE_ID,
    venueName: venueName || 'Recinto Deportivo',
    sport: sb.sport,
    matchTitle: `${sb.homeTeamName} vs ${sb.awayTeamName}`,
    homeTeamName: sb.homeTeamName,
    awayTeamName: sb.awayTeamName,
    homeScore: sb.homeScore,
    awayScore: sb.awayScore,
    date: sb.updatedAt ? sb.updatedAt.substring(0, 10) : '2026-09-15',
    time: 'Finalizado',
    status: 'finalizado',
    winnerTeam: winner,
    baseballState: sb.baseballState,
    footballState: sb.footballState,
    summaryNote: `Partido oficial concluido en ${venueName || 'el recinto'}.`,
  };
}

/**
 * Escucha en tiempo real el historial de juegos finalizados por sede
 */
export function subscribeGameHistory(
  selectedVenueId: string | 'todos' = 'todos',
  callback: (games: HistoricalGame[]) => void
): () => void {
  const q = query(
    collection(db, 'gameScoreboards'),
    where('status', '==', 'finalizado')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const liveHistorical: HistoricalGame[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as GameScoreboard;
        liveHistorical.push(scoreboardToHistoricalGame(data));
      });

      // Combinar partidos en vivo finalizados de Firestore con los predeterminados
      const mergedMap = new Map<string, HistoricalGame>();

      // 1. Agregar predeterminados
      DEFAULT_HISTORICAL_GAMES.forEach((g) => {
        mergedMap.set(g.eventId, g);
      });

      // 2. Sobrescribir o añadir con datos de Firestore
      liveHistorical.forEach((g) => {
        mergedMap.set(g.eventId, g);
      });

      let allList = Array.from(mergedMap.values());

      // 3. Filtrar por sede si aplica
      if (selectedVenueId && selectedVenueId !== 'todos') {
        allList = allList.filter((g) => g.venueId === selectedVenueId);
      }

      // 4. Ordenar cronológicamente descendente (más recientes primero)
      allList.sort((a, b) => b.date.localeCompare(a.date));

      callback(allList);
    },
    (error) => {
      console.warn('Error escuchando marcadores finalizados:', error);
      let list = DEFAULT_HISTORICAL_GAMES;
      if (selectedVenueId && selectedVenueId !== 'todos') {
        list = list.filter((g) => g.venueId === selectedVenueId);
      }
      list.sort((a, b) => b.date.localeCompare(a.date));
      callback(list);
    }
  );
}
