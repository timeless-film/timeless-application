import { COUNTRY_CODES } from "@/lib/countries";
import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportedRow {
  lineNumber: number;
  identifier: string;
  title: string;
  type: string;
  countries: string;
  price: string;
  currency: string;
  status: string;
  synopsis?: string;
  synopsisEn?: string;
  duration?: string;
  releaseYear?: string;
  genres?: string;
  directors?: string;
  cast?: string;
  posterUrl?: string;
  backdropUrl?: string;
}

export interface ColumnMapping {
  identifier: string | null;
  title: string | null;
  type: string | null;
  countries: string | null;
  price: string | null;
  currency: string | null;
  status: string | null;
  synopsis: string | null;
  synopsisEn: string | null;
  duration: string | null;
  releaseYear: string | null;
  genres: string | null;
  directors: string | null;
  cast: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

export interface ParsedFilmRow {
  lineNumber: number;
  identifier: string;
  title: string;
  type: "direct" | "validation";
  countries: string[];
  price: number; // In cents
  currency: string;
  status: "active" | "inactive";
  synopsis?: string | null;
  synopsisEn?: string | null;
  duration?: number | null;
  releaseYear?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  lineNumber: number;
  column: string;
  code: string;
}

export interface ImportWarning {
  lineNumber: number;
  column: string;
  code: string;
}

export interface GroupedFilm {
  identifier: string;
  title: string;
  type: "direct" | "validation";
  status: "active" | "inactive";
  prices: { countries: string[]; price: number; currency: string }[];
  synopsis?: string | null;
  synopsisEn?: string | null;
  duration?: number | null;
  releaseYear?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  errors: ImportError[];
  warnings: ImportWarning[];
  lineNumbers: number[];
}

export interface DiffResult {
  toCreate: GroupedFilm[];
  toUpdate: GroupedFilm[];
  toArchive: { id: string; title: string }[];
  errored: GroupedFilm[];
}

export interface ExistingFilm {
  id: string;
  title: string;
  externalId: string | null;
  status: "active" | "inactive" | "retired";
}

const VALID_COUNTRY_CODES = new Set<string>(COUNTRY_CODES as readonly string[]);
const VALID_CURRENCY_CODES = new Set<string>(STRIPE_CURRENCY_CODES as readonly string[]);

// ─── Column name auto-detection ───────────────────────────────────────────────

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  identifier: [
    "identifier",
    "identifiant",
    "id",
    "ref",
    "reference",
    "code",
    "ean",
    "external_id",
    "externalid",
  ],
  title: ["title", "titre", "film", "name", "nom"],
  type: ["type"],
  countries: ["countries", "pays", "country", "territories", "territoires"],
  price: ["price", "prix", "tarif", "cost"],
  currency: ["currency", "devise", "monnaie"],
  status: ["status", "statut", "state", "etat", "état"],
  synopsis: ["synopsis", "overview", "resume", "description"],
  synopsisEn: ["synopsisen", "overviewen", "synopsisenglish", "descriptionen"],
  duration: ["duration", "runtime", "duree", "minutes"],
  releaseYear: ["releaseyear", "year", "annee", "anneesortie"],
  genres: ["genres", "genre"],
  directors: ["directors", "director", "realisateurs", "realisateur"],
  cast: ["cast", "distribution", "actors", "acteurs"],
  posterUrl: ["posterurl", "poster", "affiche", "posterpath"],
  backdropUrl: ["backdropurl", "backdrop", "background", "arriereplan"],
};

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    identifier: null,
    title: null,
    type: null,
    countries: null,
    price: null,
    currency: null,
    status: null,
    synopsis: null,
    synopsisEn: null,
    duration: null,
    releaseYear: null,
    genres: null,
    directors: null,
    cast: null,
    posterUrl: null,
    backdropUrl: null,
  };

  const normalizedHeaders = headers.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
  );

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (header && aliases.includes(header)) {
        mapping[field as keyof ColumnMapping] = headers[i] ?? null;
        break;
      }
    }
  }

  return mapping;
}

// ─── Row parsing + validation ─────────────────────────────────────────────────

const VALID_COUNTRY_SET = VALID_COUNTRY_CODES;
const VALID_CURRENCY_SET = VALID_CURRENCY_CODES;

export function parseAndValidateRow(
  rawRow: Record<string, string>,
  mapping: ColumnMapping,
  lineNumber: number
): ParsedFilmRow | null {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  // Extract values from mapped columns
  const rawIdentifier = mapping.identifier ? (rawRow[mapping.identifier] ?? "").trim() : "";
  const rawTitle = mapping.title ? (rawRow[mapping.title] ?? "").trim() : "";
  const rawType = mapping.type ? (rawRow[mapping.type] ?? "").trim().toLowerCase() : "";
  const rawCountries = mapping.countries ? (rawRow[mapping.countries] ?? "").trim() : "";
  const rawPrice = mapping.price ? (rawRow[mapping.price] ?? "").trim() : "";
  const rawCurrency = mapping.currency ? (rawRow[mapping.currency] ?? "").trim().toUpperCase() : "";
  const rawStatus = mapping.status ? (rawRow[mapping.status] ?? "").trim().toLowerCase() : "";
  const getOptionalText = (column: string | null): string | null | undefined => {
    if (!column) {
      return undefined;
    }

    const value = (rawRow[column] ?? "").trim();
    return value || null;
  };

  const parseOptionalList = (value: string | null | undefined): string[] | null | undefined => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return parsed.length > 0 ? parsed : null;
  };

  const rawSynopsis = getOptionalText(mapping.synopsis);
  const rawSynopsisEn = getOptionalText(mapping.synopsisEn);
  const rawPosterUrl = getOptionalText(mapping.posterUrl);
  const rawBackdropUrl = getOptionalText(mapping.backdropUrl);
  const rawDirectors = parseOptionalList(getOptionalText(mapping.directors));
  const rawGenres = parseOptionalList(getOptionalText(mapping.genres));
  const rawCast = parseOptionalList(getOptionalText(mapping.cast));

  let duration: number | null | undefined;
  const rawDuration = getOptionalText(mapping.duration);
  if (rawDuration !== undefined) {
    if (rawDuration === null) {
      duration = null;
    } else {
      const parsedDuration = Number.parseInt(rawDuration, 10);
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        errors.push({ lineNumber, column: "duration", code: "INVALID_DURATION" });
      } else {
        duration = parsedDuration;
      }
    }
  }

  let releaseYear: number | null | undefined;
  const rawReleaseYear = getOptionalText(mapping.releaseYear);
  if (rawReleaseYear !== undefined) {
    if (rawReleaseYear === null) {
      releaseYear = null;
    } else {
      const parsedReleaseYear = Number.parseInt(rawReleaseYear, 10);
      if (
        !Number.isFinite(parsedReleaseYear) ||
        parsedReleaseYear < 1800 ||
        parsedReleaseYear > 2100
      ) {
        errors.push({ lineNumber, column: "release_year", code: "INVALID_RELEASE_YEAR" });
      } else {
        releaseYear = parsedReleaseYear;
      }
    }
  }

  // ── Validate title (required) ──
  if (!rawTitle) {
    errors.push({ lineNumber, column: "title", code: "EMPTY_TITLE" });
  }

  // ── Validate type (required) ──
  let type: "direct" | "validation" = "direct";
  if (!rawType || (rawType !== "direct" && rawType !== "validation")) {
    errors.push({ lineNumber, column: "type", code: "INVALID_TYPE" });
  } else {
    type = rawType;
  }

  // ── Validate countries (required) ──
  const countryCodes = rawCountries
    .split(/[,\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const validCountries: string[] = [];
  const invalidCountries: string[] = [];

  for (const code of countryCodes) {
    if (VALID_COUNTRY_SET.has(code)) {
      validCountries.push(code);
    } else {
      invalidCountries.push(code);
    }
  }

  if (invalidCountries.length > 0 && validCountries.length > 0) {
    warnings.push({ lineNumber, column: "countries", code: "PARTIAL_INVALID_COUNTRIES" });
  }

  if (validCountries.length === 0) {
    errors.push({ lineNumber, column: "countries", code: "EMPTY_COUNTRIES" });
  }

  // ── Validate price (required, positive integer) ──
  // Price in the file is in whole units (e.g., 150 = 150€). Converted to cents.
  const priceNum = parseFloat(rawPrice);
  let priceInCents = 0;
  if (isNaN(priceNum) || priceNum <= 0) {
    errors.push({ lineNumber, column: "price", code: "INVALID_PRICE" });
  } else {
    priceInCents = Math.round(priceNum * 100);
  }

  // ── Validate currency (required) ──
  if (!rawCurrency || !VALID_CURRENCY_SET.has(rawCurrency)) {
    errors.push({ lineNumber, column: "currency", code: "INVALID_CURRENCY" });
  }

  // ── Validate status (optional, defaults to "active") ──
  let status: "active" | "inactive" = "active";
  if (rawStatus) {
    if (rawStatus !== "active" && rawStatus !== "inactive") {
      errors.push({ lineNumber, column: "status", code: "INVALID_STATUS" });
    } else {
      status = rawStatus;
    }
  } else {
    warnings.push({ lineNumber, column: "status", code: "DEFAULT_STATUS_APPLIED" });
  }

  // Use externalId as identifier if available, fallback to normalized title
  const identifier = rawIdentifier || normalizeTitle(rawTitle);

  return {
    lineNumber,
    identifier,
    title: rawTitle,
    type,
    countries: validCountries,
    price: priceInCents,
    currency: rawCurrency,
    status,
    synopsis: rawSynopsis,
    synopsisEn: rawSynopsisEn,
    duration,
    releaseYear,
    directors: rawDirectors,
    genres: rawGenres,
    cast: rawCast,
    posterUrl: rawPosterUrl,
    backdropUrl: rawBackdropUrl,
    errors,
    warnings,
  };
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export function groupRowsByFilm(rows: ParsedFilmRow[]): GroupedFilm[] {
  const groups = new Map<string, GroupedFilm>();

  for (const row of rows) {
    const key = row.identifier;
    const existing = groups.get(key);

    if (existing) {
      // Check for duplicate countries within the same film
      const existingCountries = new Set(existing.prices.flatMap((p) => p.countries));
      const duplicateCountries: string[] = [];

      for (const country of row.countries) {
        if (existingCountries.has(country)) {
          duplicateCountries.push(country);
        }
      }

      if (duplicateCountries.length > 0) {
        row.warnings.push({
          lineNumber: row.lineNumber,
          column: "countries",
          code: "DUPLICATE_COUNTRY_IN_GROUP",
        });
      }

      existing.prices.push({
        countries: row.countries,
        price: row.price,
        currency: row.currency,
      });
      existing.errors.push(...row.errors);
      existing.warnings.push(...row.warnings);
      existing.lineNumbers.push(row.lineNumber);
      if (row.synopsis !== undefined) existing.synopsis = row.synopsis;
      if (row.synopsisEn !== undefined) existing.synopsisEn = row.synopsisEn;
      if (row.duration !== undefined) existing.duration = row.duration;
      if (row.releaseYear !== undefined) existing.releaseYear = row.releaseYear;
      if (row.directors !== undefined) existing.directors = row.directors;
      if (row.genres !== undefined) existing.genres = row.genres;
      if (row.cast !== undefined) existing.cast = row.cast;
      if (row.posterUrl !== undefined) existing.posterUrl = row.posterUrl;
      if (row.backdropUrl !== undefined) existing.backdropUrl = row.backdropUrl;
    } else {
      groups.set(key, {
        identifier: key,
        title: row.title,
        type: row.type,
        status: row.status,
        prices: [
          {
            countries: row.countries,
            price: row.price,
            currency: row.currency,
          },
        ],
        synopsis: row.synopsis,
        synopsisEn: row.synopsisEn,
        duration: row.duration,
        releaseYear: row.releaseYear,
        directors: row.directors,
        genres: row.genres,
        cast: row.cast,
        posterUrl: row.posterUrl,
        backdropUrl: row.backdropUrl,
        errors: [...row.errors],
        warnings: [...row.warnings],
        lineNumbers: [row.lineNumber],
      });
    }
  }

  return Array.from(groups.values());
}

// ─── Diff calculation ─────────────────────────────────────────────────────────

export function calculateDiff(
  groupedFilms: GroupedFilm[],
  existingFilms: ExistingFilm[],
  hasIdentifierColumn: boolean
): DiffResult {
  const toCreate: GroupedFilm[] = [];
  const toUpdate: GroupedFilm[] = [];
  const errored: GroupedFilm[] = [];

  // Build lookup from existing films
  const existingByExternalId = new Map<string, ExistingFilm>();
  const existingByTitle = new Map<string, ExistingFilm>();

  for (const film of existingFilms) {
    if (film.externalId) {
      existingByExternalId.set(film.externalId, film);
    }
    existingByTitle.set(normalizeTitle(film.title), film);
  }

  // Track which existing films appeared in the import
  const matchedExistingIds = new Set<string>();

  for (const group of groupedFilms) {
    // Try to match to existing film
    let matchedFilm: ExistingFilm | undefined;

    if (hasIdentifierColumn) {
      matchedFilm = existingByExternalId.get(group.identifier);
    }

    if (!matchedFilm) {
      matchedFilm = existingByTitle.get(normalizeTitle(group.title));
    }

    // Groups with blocking errors are ignored for sync, but must still prevent
    // accidental archive of the corresponding existing film.
    if (group.errors.length > 0) {
      if (matchedFilm) {
        matchedExistingIds.add(matchedFilm.id);
      }
      errored.push(group);
      continue;
    }

    if (matchedFilm) {
      matchedExistingIds.add(matchedFilm.id);
      toUpdate.push(group);
    } else {
      toCreate.push(group);
    }
  }

  // Films in DB but not in file → archive (only non-retired)
  const toArchive = existingFilms
    .filter((f) => !matchedExistingIds.has(f.id) && f.status !== "retired")
    .map((f) => ({ id: f.id, title: f.title }));

  return { toCreate, toUpdate, toArchive, errored };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Double safety validation for import payloads received by server actions.
 */
export function validateGroupedFilmForServer(group: GroupedFilm): string | null {
  if (!group.title.trim()) {
    return "EMPTY_TITLE";
  }

  if (group.type !== "direct" && group.type !== "validation") {
    return "INVALID_TYPE";
  }

  if (group.status !== "active" && group.status !== "inactive") {
    return "INVALID_STATUS";
  }

  if (group.prices.length === 0) {
    return "NO_PRICE_ZONES";
  }

  const seenCountries = new Set<string>();

  for (const zone of group.prices) {
    if (!Number.isInteger(zone.price) || zone.price <= 0) {
      return "INVALID_PRICE";
    }

    const currency = zone.currency.toUpperCase();
    if (!VALID_CURRENCY_CODES.has(currency)) {
      return "INVALID_CURRENCY";
    }

    if (zone.countries.length === 0) {
      return "EMPTY_COUNTRIES";
    }

    for (const country of zone.countries) {
      if (!VALID_COUNTRY_CODES.has(country)) {
        return "INVALID_COUNTRY";
      }

      if (seenCountries.has(country)) {
        return "DUPLICATE_COUNTRY";
      }

      seenCountries.add(country);
    }
  }

  if (
    group.duration !== undefined &&
    group.duration !== null &&
    (!Number.isInteger(group.duration) || group.duration <= 0)
  ) {
    return "INVALID_DURATION";
  }

  if (
    group.releaseYear !== undefined &&
    group.releaseYear !== null &&
    (!Number.isInteger(group.releaseYear) || group.releaseYear < 1800 || group.releaseYear > 2100)
  ) {
    return "INVALID_RELEASE_YEAR";
  }

  return null;
}
