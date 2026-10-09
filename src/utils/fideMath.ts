import { FideGame, GameResult, PlayerColor } from '../types/fide';

/**
 * Official FIDE Handbook B.02 Rating Regulations Math:
 * 1. A difference in rating of more than 400 points shall be counted for rating purposes
 *    as though it were a difference of 400 points.
 * 2. Expected score E(D) = 1 / (1 + 10^(-D / 400)), rounded to 2 decimal places per FIDE table.
 * 3. Rating change Delta R = K * (S - E(D)), rounded to 1 decimal place.
 */
export function calculateFideExpectedScore(playerElo: number, opponentElo: number): number {
  const rawDiff = playerElo - opponentElo;
  const clampedDiff = Math.max(-400, Math.min(400, rawDiff));
  const expected = 1 / (1 + Math.pow(10, -clampedDiff / 400));
  return Math.round(expected * 100) / 100;
}

export function getPlayerScoreFromResult(result: GameResult, playerColor: PlayerColor): 0 | 0.5 | 1 {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return playerColor === 'White' ? 1 : 0;
  return playerColor === 'Black' ? 1 : 0;
}

/**
 * Convertit le score du point de vue du joueur (1 = Victoire, 0.5 = Nulle, 0 = Défaite)
 * et sa couleur (White / Black) en notation FIDE officielle ('1-0', '1/2-1/2', '0-1').
 */
export function getResultFromPlayerScore(
  playerScore: 0 | 0.5 | 1,
  playerColor: PlayerColor
): GameResult {
  if (playerScore === 0.5) return '1/2-1/2';
  if (playerScore === 1) return playerColor === 'White' ? '1-0' : '0-1';
  return playerColor === 'White' ? '0-1' : '1-0';
}

export function calculateFideEloChange(
  playerElo: number,
  opponentElo: number,
  score: 0 | 0.5 | 1,
  kFactor: 10 | 20 | 40
): number {
  const expected = calculateFideExpectedScore(playerElo, opponentElo);
  const delta = kFactor * (score - expected);
  return Math.round(delta * 10) / 10;
}

/**
 * Official FIDE Table B.02.8.1a conversion from fractional score p to rating difference dp
 * for Tournament Performance Rating (Rp = Rc + dp).
 */
export function calculateFidePerformanceRating(games: Pick<FideGame, 'opponentElo' | 'playerScore'>[]): number {
  if (games.length === 0) return 0;
  const avgOpponentElo =
    games.reduce((acc, g) => acc + g.opponentElo, 0) / games.length;
  const totalScore = games.reduce((acc, g) => acc + g.playerScore, 0);
  const p = totalScore / games.length;

  if (p >= 1) return Math.round(avgOpponentElo + 800);
  if (p <= 0) return Math.round(avgOpponentElo - 800);

  // Inverse logistic formula matching FIDE dp table: dp = -400 * log10(1/p - 1)
  const dp = -400 * Math.log10(1 / p - 1);
  return Math.round(avgOpponentElo + dp);
}

export interface EcoOpeningEntry {
  eco: string;
  name: string;
  family: 'A' | 'B' | 'C' | 'D' | 'E';
  familyLabel: string;
  moves: string;
}

export const ECO_OPENINGS_CATALOG: EcoOpeningEntry[] = [
  { eco: 'A04', name: 'Ouverture Réti, Système Zukertort', family: 'A', familyLabel: 'Ouvertures de Flanc (A)', moves: '1. Nf3 d5' },
  { eco: 'A10', name: 'Ouverture Anglaise, Système Symétrique', family: 'A', familyLabel: 'Ouvertures de Flanc (A)', moves: '1. c4 c5' },
  { eco: 'A28', name: 'Ouverture Anglaise, Variante des Quatre Cavaliers', family: 'A', familyLabel: 'Ouvertures de Flanc (A)', moves: '1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6' },
  { eco: 'A45', name: 'Attaque Trompowsky', family: 'A', familyLabel: 'Ouvertures de Flanc (A)', moves: '1. d4 Nf6 2. Bg5' },
  { eco: 'A80', name: 'Défense Hollandaise, Variante Classique', family: 'A', familyLabel: 'Ouvertures de Flanc (A)', moves: '1. d4 f5' },
  { eco: 'B01', name: 'Défense Scandinave, Ligne Principale', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 d5 2. exd5 Qxd5' },
  { eco: 'B12', name: 'Défense Caro-Kann, Variante d’Avance', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c6 2. d4 d5 3. e5' },
  { eco: 'B18', name: 'Défense Caro-Kann, Variante Classique', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5' },
  { eco: 'B22', name: 'Défense Sicilienne, Variante Alapin (c3)', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c5 2. c3' },
  { eco: 'B33', name: 'Défense Sicilienne, Variante Sveshnikov', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5' },
  { eco: 'B50', name: 'Défense Sicilienne, Système Rossolimo / Moscou', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c5 2. Nf3 d6 3. Bb5+' },
  { eco: 'B90', name: 'Défense Sicilienne, Variante Najdorf', family: 'B', familyLabel: 'Jeux Semi-Ouverts hors Française (B)', moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6' },
  { eco: 'C02', name: 'Défense Française, Variante d’Avance', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e6 2. d4 d5 3. e5' },
  { eco: 'C11', name: 'Défense Française, Système Classique Steinitz', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e6 2. d4 d5 3. Nc3 Nf6' },
  { eco: 'C18', name: 'Défense Française, Variante Winawer', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e6 2. d4 d5 3. Nc3 Bb4' },
  { eco: 'C42', name: 'Défense Russe (Petrov)', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e5 2. Nf3 Nf6' },
  { eco: 'C50', name: 'Partie Italienne, Giuoco Pianissimo', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3' },
  { eco: 'C54', name: 'Partie Italienne, Ligne Principale avec c3 et d4', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6' },
  { eco: 'C65', name: 'Partie Espagnole (Ruy Lopez), Défense Berlinoise', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6' },
  { eco: 'C88', name: 'Partie Espagnole, Variante Fermée Anti-Marshall', family: 'C', familyLabel: 'Jeux Ouverts & Défense Française (C)', moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4' },
  { eco: 'D02', name: 'Système de Londres', family: 'D', familyLabel: 'Jeux Fermés & Défense Grünfeld (D)', moves: '1. d4 d5 2. Bf4 Nf6 3. e3' },
  { eco: 'D15', name: 'Défense Slave, Ligne Principale', family: 'D', familyLabel: 'Jeux Fermés & Défense Grünfeld (D)', moves: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3' },
  { eco: 'D37', name: 'Gambit Dame Refusé, Variante des Trois Cavaliers', family: 'D', familyLabel: 'Jeux Fermés & Défense Grünfeld (D)', moves: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3' },
  { eco: 'D45', name: 'Défense Semi-Slave, Système Meran', family: 'D', familyLabel: 'Jeux Fermés & Défense Grünfeld (D)', moves: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3' },
  { eco: 'D85', name: 'Défense Grünfeld, Variante d’Échange', family: 'D', familyLabel: 'Jeux Fermés & Défense Grünfeld (D)', moves: '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5' },
  { eco: 'E06', name: 'Ouverture Catalane, Variante Fermée', family: 'E', familyLabel: 'Défenses Indiennes (E)', moves: '1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. Nf3' },
  { eco: 'E15', name: 'Défense Ouest-Indienne', family: 'E', familyLabel: 'Défenses Indiennes (E)', moves: '1. d4 Nf6 2. c4 e6 3. Nf3 b6' },
  { eco: 'E32', name: 'Défense Nimzo-Indienne, Variante Classique (4.Qc2)', family: 'E', familyLabel: 'Défenses Indiennes (E)', moves: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2' },
  { eco: 'E46', name: 'Défense Nimzo-Indienne, Système Rubinstein', family: 'E', familyLabel: 'Défenses Indiennes (E)', moves: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O' },
  { eco: 'E97', name: 'Défense Est-Indienne, Variante Mar del Plata', family: 'E', familyLabel: 'Défenses Indiennes (E)', moves: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5' },
];

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  const months = [
    'Janv.',
    'Févr.',
    'Mars',
    'Avr.',
    'Mai',
    'Juin',
    'Juil.',
    'Août',
    'Sept.',
    'Oct.',
    'Nov.',
    'Déc.',
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${months[mIndex]} ${year}`;
  }
  return period;
}
