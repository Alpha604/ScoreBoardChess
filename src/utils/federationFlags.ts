/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FederationInfo {
  code: string;
  name: string;
  iso2?: string;
  emoji: string;
  isFide: boolean;
}

/**
 * Mapping officiel des fédérations FIDE (codes à 3 lettres et FIDE)
 * vers les codes ISO à 2 lettres, noms en français et emojis drapeaux.
 */
export const FEDERATION_MAP: Record<string, { name: string; iso2: string; emoji: string }> = {
  // Europe
  FRA: { name: 'France', iso2: 'fr', emoji: '🇫🇷' },
  GER: { name: 'Allemagne', iso2: 'de', emoji: '🇩🇪' },
  ESP: { name: 'Espagne', iso2: 'es', emoji: '🇪🇸' },
  ITA: { name: 'Italie', iso2: 'it', emoji: '🇮🇹' },
  ENG: { name: 'Angleterre', iso2: 'gb-eng', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  SCO: { name: 'Écosse', iso2: 'gb-sct', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  WLS: { name: 'Pays de Galles', iso2: 'gb-wls', emoji: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  IRL: { name: 'Irlande', iso2: 'ie', emoji: '🇮🇪' },
  NED: { name: 'Pays-Bas', iso2: 'nl', emoji: '🇳🇱' },
  BEL: { name: 'Belgique', iso2: 'be', emoji: '🇧🇪' },
  SUI: { name: 'Suisse', iso2: 'ch', emoji: '🇨🇭' },
  AUT: { name: 'Autriche', iso2: 'at', emoji: '🇦🇹' },
  POL: { name: 'Pologne', iso2: 'pl', emoji: '🇵🇱' },
  UKR: { name: 'Ukraine', iso2: 'ua', emoji: '🇺🇦' },
  RUS: { name: 'Russie', iso2: 'ru', emoji: '🇷🇺' },
  NOR: { name: 'Norvège', iso2: 'no', emoji: '🇳🇴' },
  SWE: { name: 'Suède', iso2: 'se', emoji: '🇸🇪' },
  DEN: { name: 'Danemark', iso2: 'dk', emoji: '🇩🇰' },
  FIN: { name: 'Finlande', iso2: 'fi', emoji: '🇫🇮' },
  ISL: { name: 'Islande', iso2: 'is', emoji: '🇮🇸' },
  POR: { name: 'Portugal', iso2: 'pt', emoji: '🇵🇹' },
  GRE: { name: 'Grèce', iso2: 'gr', emoji: '🇬🇷' },
  TUR: { name: 'Turquie', iso2: 'tr', emoji: '🇹🇷' },
  ROU: { name: 'Roumanie', iso2: 'ro', emoji: '🇷🇴' },
  HUN: { name: 'Hongrie', iso2: 'hu', emoji: '🇭🇺' },
  CZE: { name: 'Tchéquie', iso2: 'cz', emoji: '🇨🇿' },
  SVK: { name: 'Slovaquie', iso2: 'sk', emoji: '🇸🇰' },
  CRO: { name: 'Croatie', iso2: 'hr', emoji: '🇭🇷' },
  SRB: { name: 'Serbie', iso2: 'rs', emoji: '🇷🇸' },
  SLO: { name: 'Slovénie', iso2: 'si', emoji: '🇸🇮' },
  BUL: { name: 'Bulgarie', iso2: 'bg', emoji: '🇧🇬' },
  BIH: { name: 'Bosnie-Herzégovine', iso2: 'ba', emoji: '🇧🇦' },
  MNE: { name: 'Monténégro', iso2: 'me', emoji: '🇲🇪' },
  MKD: { name: 'Macédoine du Nord', iso2: 'mk', emoji: '🇲🇰' },
  ALB: { name: 'Albanie', iso2: 'al', emoji: '🇦🇱' },
  EST: { name: 'Estonie', iso2: 'ee', emoji: '🇪🇪' },
  LAT: { name: 'Lettonie', iso2: 'lv', emoji: '🇱🇻' },
  LTU: { name: 'Lituanie', iso2: 'lt', emoji: '🇱🇹' },
  LUX: { name: 'Luxembourg', iso2: 'lu', emoji: '🇱🇺' },
  MON: { name: 'Monaco', iso2: 'mc', emoji: '🇲🇨' },
  AND: { name: 'Andorre', iso2: 'ad', emoji: '🇦🇩' },
  SMR: { name: 'Saint-Marin', iso2: 'sm', emoji: '🇸🇲' },
  LIE: { name: 'Liechtenstein', iso2: 'li', emoji: '🇱🇮' },
  CYP: { name: 'Chypre', iso2: 'cy', emoji: '🇨🇾' },
  MLT: { name: 'Malte', iso2: 'mt', emoji: '🇲🇹' },
  MDA: { name: 'Moldavie', iso2: 'md', emoji: '🇲🇩' },
  GEO: { name: 'Géorgie', iso2: 'ge', emoji: '🇬🇪' },
  ARM: { name: 'Arménie', iso2: 'am', emoji: '🇦🇲' },
  AZE: { name: 'Azerbaïdjan', iso2: 'az', emoji: '🇦🇿' },

  // Amériques
  USA: { name: 'États-Unis', iso2: 'us', emoji: '🇺🇸' },
  CAN: { name: 'Canada', iso2: 'ca', emoji: '🇨🇦' },
  MEX: { name: 'Mexique', iso2: 'mx', emoji: '🇲🇽' },
  CUB: { name: 'Cuba', iso2: 'cu', emoji: '🇨🇺' },
  BRA: { name: 'Brésil', iso2: 'br', emoji: '🇧🇷' },
  ARG: { name: 'Argentine', iso2: 'ar', emoji: '🇦🇷' },
  COL: { name: 'Colombie', iso2: 'co', emoji: '🇨🇴' },
  PER: { name: 'Pérou', iso2: 'pe', emoji: '🇵🇪' },
  CHI: { name: 'Chili', iso2: 'cl', emoji: '🇨🇱' },
  URU: { name: 'Uruguay', iso2: 'uy', emoji: '🇺🇾' },
  PAR: { name: 'Paraguay', iso2: 'py', emoji: '🇵🇾' },
  BOL: { name: 'Bolivie', iso2: 'bo', emoji: '🇧🇴' },
  ECU: { name: 'Équateur', iso2: 'ec', emoji: '🇪🇨' },
  VEN: { name: 'Venezuela', iso2: 've', emoji: '🇻🇪' },
  CRC: { name: 'Costa Rica', iso2: 'cr', emoji: '🇨🇷' },
  PAN: { name: 'Panama', iso2: 'pa', emoji: '🇵🇦' },
  DOM: { name: 'Rép. Dominicaine', iso2: 'do', emoji: '🇩🇴' },
  PUR: { name: 'Porto Rico', iso2: 'pr', emoji: '🇵🇷' },
  JAM: { name: 'Jamaïque', iso2: 'jm', emoji: '🇯🇲' },

  // Asie & Océanie
  IND: { name: 'Inde', iso2: 'in', emoji: '🇮🇳' },
  CHN: { name: 'Chine', iso2: 'cn', emoji: '🇨🇳' },
  UZB: { name: 'Ouzbékistan', iso2: 'uz', emoji: '🇺🇿' },
  KAZ: { name: 'Kazakhstan', iso2: 'kz', emoji: '🇰🇿' },
  IRI: { name: 'Iran', iso2: 'ir', emoji: '🇮🇷' },
  ISR: { name: 'Israël', iso2: 'il', emoji: '🇮🇱' },
  AUS: { name: 'Australie', iso2: 'au', emoji: '🇦🇺' },
  NZL: { name: 'Nouvelle-Zélande', iso2: 'nz', emoji: '🇳🇿' },
  JPN: { name: 'Japon', iso2: 'jp', emoji: '🇯🇵' },
  KOR: { name: 'Corée du Sud', iso2: 'kr', emoji: '🇰🇷' },
  VIE: { name: 'Vietnam', iso2: 'vn', emoji: '🇻🇳' },
  PHI: { name: 'Philippines', iso2: 'ph', emoji: '🇵🇭' },
  INA: { name: 'Indonésie', iso2: 'id', emoji: '🇮🇩' },
  SGP: { name: 'Singapour', iso2: 'sg', emoji: '🇸🇬' },
  MAS: { name: 'Malaisie', iso2: 'my', emoji: '🇲🇾' },
  THA: { name: 'Thaïlande', iso2: 'th', emoji: '🇹🇭' },
  MGL: { name: 'Mongolie', iso2: 'mn', emoji: '🇲🇳' },
  UAE: { name: 'Émirats Arabes Unis', iso2: 'ae', emoji: '🇦🇪' },
  QAT: { name: 'Qatar', iso2: 'qa', emoji: '🇶🇦' },
  KSA: { name: 'Arabie Saoudite', iso2: 'sa', emoji: '🇸🇦' },
  BAN: { name: 'Bangladesh', iso2: 'bd', emoji: '🇧🇩' },
  PAK: { name: 'Pakistan', iso2: 'pk', emoji: '🇵🇰' },
  SRI: { name: 'Sri Lanka', iso2: 'lk', emoji: '🇱🇰' },
  KGZ: { name: 'Kirghizistan', iso2: 'kg', emoji: '🇰🇬' },
  TJK: { name: 'Tadjikistan', iso2: 'tj', emoji: '🇹🇯' },
  TKM: { name: 'Turkménistan', iso2: 'tm', emoji: '🇹🇲' },

  // Afrique
  EGY: { name: 'Égypte', iso2: 'eg', emoji: '🇪🇬' },
  MAR: { name: 'Maroc', iso2: 'ma', emoji: '🇲🇦' },
  ALG: { name: 'Algérie', iso2: 'dz', emoji: '🇩🇿' },
  TUN: { name: 'Tunisie', iso2: 'tn', emoji: '🇹🇳' },
  RSA: { name: 'Afrique du Sud', iso2: 'za', emoji: '🇿🇦' },
  NGR: { name: 'Nigéria', iso2: 'ng', emoji: '🇳🇬' },
  KEN: { name: 'Kenya', iso2: 'ke', emoji: '🇰🇪' },
  SEN: { name: 'Sénégal', iso2: 'sn', emoji: '🇸🇳' },
  CIV: { name: "Côte d'Ivoire", iso2: 'ci', emoji: '🇨🇮' },
  CMR: { name: 'Cameroun', iso2: 'cm', emoji: '🇨🇲' },
  MAD: { name: 'Madagascar', iso2: 'mg', emoji: '🇲🇬' },
  MRI: { name: 'Maurice', iso2: 'mu', emoji: '🇲🇺' },
  GHA: { name: 'Ghana', iso2: 'gh', emoji: '🇬🇭' },
  ANG: { name: 'Angola', iso2: 'ao', emoji: '🇦🇴' },
};

/**
 * Fédérations courantes pour les suggestions rapides d'autocomplétion
 */
export const POPULAR_FEDERATIONS = [
  { code: 'FRA', name: 'France' },
  { code: 'FIDE', name: 'FIDE (Fédération Internationale)' },
  { code: 'ESP', name: 'Espagne' },
  { code: 'GER', name: 'Allemagne' },
  { code: 'ITA', name: 'Italie' },
  { code: 'ENG', name: 'Angleterre' },
  { code: 'BEL', name: 'Belgique' },
  { code: 'SUI', name: 'Suisse' },
  { code: 'USA', name: 'États-Unis' },
  { code: 'IND', name: 'Inde' },
  { code: 'UKR', name: 'Ukraine' },
  { code: 'POL', name: 'Pologne' },
  { code: 'NED', name: 'Pays-Bas' },
  { code: 'MAR', name: 'Maroc' },
  { code: 'ALG', name: 'Algérie' },
  { code: 'TUN', name: 'Tunisie' },
  { code: 'CAN', name: 'Canada' },
];

/**
 * Analyse un code de fédération et retourne son nom, drapeau ISO et émoji.
 */
export function getFederationInfo(rawCode: string | undefined | null): FederationInfo {
  const clean = (rawCode || '').trim().toUpperCase();

  // Cas spécial FIDE / FID
  if (clean === 'FIDE' || clean === 'FID') {
    return {
      code: 'FIDE',
      name: 'Fédération Internationale des Échecs',
      emoji: '♟️',
      isFide: true,
    };
  }

  // Correspondance exacte dans le mapping FIDE
  if (FEDERATION_MAP[clean]) {
    return {
      code: clean,
      name: FEDERATION_MAP[clean].name,
      iso2: FEDERATION_MAP[clean].iso2,
      emoji: FEDERATION_MAP[clean].emoji,
      isFide: false,
    };
  }

  // Si c'est déjà un code ISO 2 lettres (ex: FR, US, DE)
  if (clean.length === 2) {
    const foundEntry = Object.entries(FEDERATION_MAP).find(
      ([, item]) => item.iso2.toUpperCase() === clean
    );
    if (foundEntry) {
      return {
        code: foundEntry[0],
        name: foundEntry[1].name,
        iso2: foundEntry[1].iso2,
        emoji: foundEntry[1].emoji,
        isFide: false,
      };
    }
  }

  // Fallback par défaut si non reconnu
  return {
    code: clean || 'FRA',
    name: clean || 'France',
    emoji: clean ? '🌐' : '🇫🇷',
    isFide: false,
  };
}
