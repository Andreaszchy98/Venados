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
export const DEFAULT_HISTORICAL_GAMES: HistoricalGame[] = [
  {
    id: 'hist-venados-tomateros-sep26',
    eventId: 'event-hist-ven-tom-01',
    venueId: DEFAULT_VENUE_ID,
    venueName: 'Estadio Teodoro Mariscal',
    city: 'Mazatlán',
    sport: 'baseball',
    matchTitle: 'Venados de Mazatlán vs Tomateros de Culiacán',
    homeTeamName: 'Venados de Mazatlán',
    awayTeamName: 'Tomateros de Culiacán',
    homeScore: 6,
    awayScore: 4,
    date: '2026-09-12',
    time: '20:00 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    baseballState: {
      currentInning: 9,
      isTopInning: false,
      outs: 3,
      balls: 0,
      strikes: 0,
      inningScores: generateInningScores(
        [0, 2, 0, 1, 0, 3, 0, 0, 0],
        [1, 0, 0, 2, 0, 0, 1, 0, 0]
      ),
      homeHits: 10,
      awayHits: 8,
      homeErrors: 0,
      awayErrors: 1,
    },
    summaryNote: 'Gran remontada de Venados en la 6ta entrada con cuadrangular productor de 3 carreras.',
  },
  {
    id: 'hist-venados-naranjeros-sep26',
    eventId: 'event-hist-ven-nar-02',
    venueId: DEFAULT_VENUE_ID,
    venueName: 'Estadio Teodoro Mariscal',
    city: 'Mazatlán',
    sport: 'baseball',
    matchTitle: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
    homeTeamName: 'Venados de Mazatlán',
    awayTeamName: 'Naranjeros de Hermosillo',
    homeScore: 5,
    awayScore: 3,
    date: '2026-09-05',
    time: '19:30 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    baseballState: {
      currentInning: 9,
      isTopInning: false,
      outs: 3,
      balls: 0,
      strikes: 0,
      inningScores: generateInningScores(
        [1, 0, 1, 0, 2, 0, 1, 0, 0],
        [0, 1, 0, 0, 1, 0, 0, 1, 0]
      ),
      homeHits: 9,
      awayHits: 7,
      homeErrors: 1,
      awayErrors: 2,
    },
    summaryNote: 'Sólida labor monticular de 7 ponches para sellar el triunfo ante la afición del puerto.',
  },
  {
    id: 'hist-venados-yaquis-ago26',
    eventId: 'event-hist-ven-yaq-03',
    venueId: DEFAULT_VENUE_ID,
    venueName: 'Estadio Teodoro Mariscal',
    city: 'Mazatlán',
    sport: 'baseball',
    matchTitle: 'Venados de Mazatlán vs Yaquis de Obregón',
    homeTeamName: 'Venados de Mazatlán',
    awayTeamName: 'Yaquis de Obregón',
    homeScore: 8,
    awayScore: 2,
    date: '2026-08-28',
    time: '20:00 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    baseballState: {
      currentInning: 9,
      isTopInning: false,
      outs: 3,
      balls: 0,
      strikes: 0,
      inningScores: generateInningScores(
        [2, 0, 3, 0, 1, 2, 0, 0, 0],
        [0, 0, 1, 0, 0, 1, 0, 0, 0]
      ),
      homeHits: 13,
      awayHits: 5,
      homeErrors: 0,
      awayErrors: 2,
    },
    summaryNote: 'Ofensiva arrolladora con 13 imparables para asegurar la serie completa en casa.',
  },
  {
    id: 'hist-dorados-atlante-sep26',
    eventId: 'event-hist-dor-atl-01',
    venueId: 'venue-encanto',
    venueName: 'Estadio El Encanto',
    city: 'Mazatlán',
    sport: 'football',
    matchTitle: 'Dorados de Sinaloa vs Atlante F.C.',
    homeTeamName: 'Dorados de Sinaloa',
    awayTeamName: 'Atlante F.C.',
    homeScore: 2,
    awayScore: 1,
    date: '2026-09-10',
    time: '20:00 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    footballState: {
      half: 'finalizado',
      minute: 90,
      addedTime: 4,
      goals: [
        { team: 'home', playerName: 'Daniel Parra', minute: 28 },
        { team: 'away', playerName: 'Christian Bermúdez', minute: 63 },
        { team: 'home', playerName: 'Christian Blanco', minute: 84 },
      ],
      cards: [
        { team: 'away', playerName: 'Elbis Sousa', minute: 41, type: 'amarilla' },
        { team: 'home', playerName: 'Edson Rivera', minute: 73, type: 'amarilla' },
      ],
    },
    summaryNote: 'Victoria dorada con anotación agónica en el minuto 84 ante un abarrotado Estadio El Encanto.',
  },
  {
    id: 'hist-dorados-mineros-ago26',
    eventId: 'event-hist-dor-min-02',
    venueId: 'venue-encanto',
    venueName: 'Estadio El Encanto',
    city: 'Mazatlán',
    sport: 'football',
    matchTitle: 'Dorados de Sinaloa vs Mineros de Zacatecas',
    homeTeamName: 'Dorados de Sinaloa',
    awayTeamName: 'Mineros de Zacatecas',
    homeScore: 3,
    awayScore: 1,
    date: '2026-08-30',
    time: '20:30 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    footballState: {
      half: 'finalizado',
      minute: 90,
      addedTime: 3,
      goals: [
        { team: 'home', playerName: 'Raúl Zúñiga', minute: 14 },
        { team: 'home', playerName: 'Kevin Lara', minute: 45 },
        { team: 'away', playerName: 'Brian Figueroa', minute: 58 },
        { team: 'home', playerName: 'David Angulo', minute: 89 },
      ],
      cards: [
        { team: 'away', playerName: 'José Hernández', minute: 32, type: 'amarilla' },
      ],
    },
    summaryNote: 'Contundente demostración ofensiva del Gran Pez sumando tres unidades vitales.',
  },
  {
    id: 'hist-venados-basketball-ago26',
    eventId: 'event-hist-ven-bas-01',
    venueId: DEFAULT_VENUE_ID,
    venueName: 'Estadio Teodoro Mariscal / CUM',
    city: 'Mazatlán',
    sport: 'basketball',
    matchTitle: 'Venados Basketball vs Rayos de Hermosillo',
    homeTeamName: 'Venados Basketball',
    awayTeamName: 'Rayos de Hermosillo',
    homeScore: 94,
    awayScore: 88,
    date: '2026-08-20',
    time: '20:15 hrs',
    status: 'finalizado',
    winnerTeam: 'home',
    summaryNote: 'Gran cierre en el último cuarto con triple clutch en los segundos finales.',
  },
];

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
