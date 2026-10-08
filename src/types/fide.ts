export type FideTitle = 'None' | 'CM' | 'FM' | 'IM' | 'GM' | 'WCM' | 'WFM' | 'WIM' | 'WGM';
export type TimeControlCategory = 'Standard' | 'Rapid' | 'Blitz';
export type TournamentFormat = 'Swiss' | 'Round Robin' | 'Team' | 'Knockout';
export type TournamentStatus = 'upcoming' | 'ongoing' | 'completed';
export type PlayerColor = 'White' | 'Black';
export type GameResult = '1-0' | '0-1' | '1/2-1/2';
export type GameTermination =
  | 'Checkmate'
  | 'Resignation'
  | 'Time Forfeit'
  | 'Agreement'
  | 'Stalemate'
  | 'Threefold Repetition'
  | 'Insufficient Material';

export interface PlayerProfile {
  uid: string;
  displayName: string;
  fideId: string;
  ffeId?: string;
  federation: string;
  club: string;
  fideTitle: FideTitle;
  birthYear: number;
  kFactor: 10 | 20 | 40;
  standardElo: number;
  rapidElo: number;
  blitzElo: number;
  targetElo: number;
  accessPin?: string;
}

/**
 * Joueur affronté (relié par Nom, ID FIDE et/ou ID FFE)
 * Possède un classement Elo distinct dans chaque cadence (Classique, Rapide, Blitz)
 */
export interface OpponentPlayer {
  id: string;
  name: string;
  fideId: string; // ex: 65104823
  ffeId: string; // ex: K59102
  elo: number; // Elo principal (synchronisé avec standardElo)
  standardElo: number; // Elo Classique / Standard
  rapidElo: number; // Elo Rapide
  blitzElo: number; // Elo Blitz
  title: FideTitle;
  federation: string;
  club: string;
  notes: string;
}

export interface Tournament {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeControl: TimeControlCategory;
  timeControlDetails: string;
  format: TournamentFormat;
  totalRounds: number;
  totalPlayers?: number; // Nombre de joueurs dans le tournoi
  finalRank?: number; // Classement final du joueur (ex: 12 pour 12e)
  startingElo: number;
  status: TournamentStatus;
  normTarget: string;
  notes: string;
}

export interface FideGame {
  id: string;
  ownerId: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  datePlayed: string; // YYYY-MM-DD
  timeControl: TimeControlCategory;
  playerColor: PlayerColor;
  playerElo: number;
  opponentId?: string; // Référence vers OpponentPlayer.id
  opponentName: string;
  opponentFideId: string;
  opponentFfeId?: string;
  opponentTitle: FideTitle;
  opponentElo: number;
  opponentFederation: string;
  result: GameResult;
  playerScore: 0 | 0.5 | 1;
  eloChange: number;
  kFactorUsed: 10 | 20 | 40;
  ecoCode: string; // Optionnel ou ex: B90
  openingName: string;
  movesCount: number;
  termination: GameTermination;
  pgn: string; // Optionnel (surtout pour les parties classiques)
  chessComUrl?: string; // Lien facultatif pour analyser sur Chess.com
  keyMomentNote: string;
}

export interface MonthlyRatingRecord {
  id: string;
  ownerId: string;
  period: string; // YYYY-MM
  standardElo: number;
  rapidElo: number;
  blitzElo: number;
  standardGamesCount: number;
  standardDelta: number;
  fideRankNational: number;
  notes: string;
}
