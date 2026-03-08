import { describe, expect, it } from "vitest";

import {
  autoDetectColumns,
  calculateDiff,
  groupRowsByFilm,
  normalizeTitle,
  parseAndValidateRow,
  validateGroupedFilmForServer,
} from "../film-import-service";

import type { ColumnMapping, ExistingFilm } from "../film-import-service";

// ─── normalizeTitle ───────────────────────────────────────────────────────────

describe("normalizeTitle", () => {
  it("trims and lowercases", () => {
    expect(normalizeTitle("  Le Mépris  ")).toBe("le mépris");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });
});

// ─── autoDetectColumns ────────────────────────────────────────────────────────

describe("autoDetectColumns", () => {
  it("detects English headers", () => {
    const result = autoDetectColumns(["Title", "Type", "Countries", "Price", "Currency", "Status"]);
    expect(result.title).toBe("Title");
    expect(result.type).toBe("Type");
    expect(result.countries).toBe("Countries");
    expect(result.price).toBe("Price");
    expect(result.currency).toBe("Currency");
    expect(result.status).toBe("Status");
  });

  it("detects French headers", () => {
    const result = autoDetectColumns(["Titre", "Type", "Pays", "Prix", "Devise", "Statut"]);
    expect(result.title).toBe("Titre");
    expect(result.countries).toBe("Pays");
    expect(result.price).toBe("Prix");
    expect(result.currency).toBe("Devise");
    expect(result.status).toBe("Statut");
  });

  it("detects identifier columns", () => {
    const result = autoDetectColumns(["Ref", "Title", "Price"]);
    expect(result.identifier).toBe("Ref");
  });

  it("returns null for unrecognized headers", () => {
    const result = autoDetectColumns(["Foo", "Bar", "Baz"]);
    expect(result.title).toBeNull();
    expect(result.price).toBeNull();
    expect(result.countries).toBeNull();
    expect(result.currency).toBeNull();
  });

  it("is case-insensitive", () => {
    const result = autoDetectColumns(["TITLE", "PRICE", "CURRENCY"]);
    expect(result.title).toBe("TITLE");
    expect(result.price).toBe("PRICE");
    expect(result.currency).toBe("CURRENCY");
  });
});

// ─── parseAndValidateRow ──────────────────────────────────────────────────────

const validMapping: ColumnMapping = {
  identifier: "Ref",
  title: "Title",
  type: "Type",
  countries: "Countries",
  price: "Price",
  currency: "Currency",
  status: "Status",
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

describe("parseAndValidateRow", () => {
  it("parses a valid row", () => {
    const row = {
      Ref: "EAN-001",
      Title: "Le Mépris",
      Type: "direct",
      Countries: "FR,BE",
      Price: "300",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Le Mépris");
    expect(result!.type).toBe("direct");
    expect(result!.countries).toEqual(["FR", "BE"]);
    expect(result!.price).toBe(30000); // 300 * 100
    expect(result!.currency).toBe("EUR");
    expect(result!.status).toBe("active");
    expect(result!.identifier).toBe("EAN-001");
    expect(result!.errors).toHaveLength(0);
  });

  it("returns EMPTY_TITLE error for missing title", () => {
    const row = {
      Ref: "",
      Title: "",
      Type: "direct",
      Countries: "FR",
      Price: "100",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "EMPTY_TITLE")).toBe(true);
  });

  it("returns INVALID_TYPE error for bad type", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "wrong",
      Countries: "FR",
      Price: "100",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "INVALID_TYPE")).toBe(true);
  });

  it("returns EMPTY_COUNTRIES error when no valid countries", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "XX,YY",
      Price: "100",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "EMPTY_COUNTRIES")).toBe(true);
  });

  it("warns for partial invalid countries", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR,XX",
      Price: "100",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.countries).toEqual(["FR"]);
    expect(result!.warnings.some((w) => w.code === "PARTIAL_INVALID_COUNTRIES")).toBe(true);
  });

  it("returns INVALID_PRICE error for non-numeric price", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "abc",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "INVALID_PRICE")).toBe(true);
  });

  it("returns INVALID_PRICE error for zero price", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "0",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "INVALID_PRICE")).toBe(true);
  });

  it("returns INVALID_CURRENCY error for bad currency", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "100",
      Currency: "FAKE",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "INVALID_CURRENCY")).toBe(true);
  });

  it("returns INVALID_STATUS error for bad status", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "100",
      Currency: "EUR",
      Status: "unknown",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.errors.some((e) => e.code === "INVALID_STATUS")).toBe(true);
  });

  it("defaults status to active with warning", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "100",
      Currency: "EUR",
      Status: "",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.status).toBe("active");
    expect(result!.warnings.some((w) => w.code === "DEFAULT_STATUS_APPLIED")).toBe(true);
  });

  it("converts price to cents correctly", () => {
    const row = {
      Ref: "",
      Title: "Test",
      Type: "direct",
      Countries: "FR",
      Price: "150.50",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, validMapping, 2);
    expect(result!.price).toBe(15050);
  });

  it("uses normalized title as identifier when no externalId", () => {
    const mapping: ColumnMapping = { ...validMapping, identifier: null };
    const row = {
      Title: "  Le Mépris  ",
      Type: "direct",
      Countries: "FR",
      Price: "100",
      Currency: "EUR",
      Status: "active",
    };
    const result = parseAndValidateRow(row, mapping, 2);
    expect(result!.identifier).toBe("le mépris");
  });
});

// ─── groupRowsByFilm ──────────────────────────────────────────────────────────

describe("groupRowsByFilm", () => {
  it("groups rows with the same identifier", () => {
    const rows = [
      {
        lineNumber: 2,
        identifier: "film-1",
        title: "Film 1",
        type: "direct" as const,
        countries: ["FR"],
        price: 10000,
        currency: "EUR",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
      {
        lineNumber: 3,
        identifier: "film-1",
        title: "Film 1",
        type: "direct" as const,
        countries: ["US"],
        price: 15000,
        currency: "USD",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
    ];
    const grouped = groupRowsByFilm(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.prices).toHaveLength(2);
    expect(grouped[0]!.lineNumbers).toEqual([2, 3]);
  });

  it("keeps different identifiers separate", () => {
    const rows = [
      {
        lineNumber: 2,
        identifier: "film-1",
        title: "Film 1",
        type: "direct" as const,
        countries: ["FR"],
        price: 10000,
        currency: "EUR",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
      {
        lineNumber: 3,
        identifier: "film-2",
        title: "Film 2",
        type: "validation" as const,
        countries: ["US"],
        price: 15000,
        currency: "USD",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
    ];
    const grouped = groupRowsByFilm(rows);
    expect(grouped).toHaveLength(2);
  });

  it("warns on duplicate countries within same film", () => {
    const rows = [
      {
        lineNumber: 2,
        identifier: "film-1",
        title: "Film 1",
        type: "direct" as const,
        countries: ["FR"],
        price: 10000,
        currency: "EUR",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
      {
        lineNumber: 3,
        identifier: "film-1",
        title: "Film 1",
        type: "direct" as const,
        countries: ["FR", "BE"],
        price: 12000,
        currency: "EUR",
        status: "active" as const,
        errors: [],
        warnings: [],
      },
    ];
    const grouped = groupRowsByFilm(rows);
    expect(grouped[0]!.warnings.some((w) => w.code === "DUPLICATE_COUNTRY_IN_GROUP")).toBe(true);
  });
});

// ─── calculateDiff ────────────────────────────────────────────────────────────

describe("calculateDiff", () => {
  const makeGrouped = (identifier: string, title: string, hasErrors = false) => ({
    identifier,
    title,
    type: "direct" as const,
    status: "active" as const,
    prices: [{ countries: ["FR"], price: 10000, currency: "EUR" }],
    errors: hasErrors ? [{ lineNumber: 2, column: "title", code: "EMPTY_TITLE" }] : [],
    warnings: [],
    lineNumbers: [2],
  });

  const existingFilms: ExistingFilm[] = [
    { id: "1", title: "Existing Film", externalId: "EXT-001", status: "active" },
    { id: "2", title: "Another Film", externalId: null, status: "active" },
  ];

  it("identifies new films to create", () => {
    const grouped = [makeGrouped("new-film", "New Film")];
    const result = calculateDiff(grouped, existingFilms, false);
    expect(result.toCreate).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("identifies existing films to update by externalId", () => {
    const grouped = [makeGrouped("EXT-001", "Existing Film")];
    const result = calculateDiff(grouped, existingFilms, true);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toCreate).toHaveLength(0);
  });

  it("identifies existing films to update by title normalization", () => {
    const grouped = [makeGrouped("existing film", "Existing Film")];
    const result = calculateDiff(grouped, existingFilms, false);
    expect(result.toUpdate).toHaveLength(1);
  });

  it("identifies films to archive", () => {
    const grouped = [makeGrouped("EXT-001", "Existing Film")];
    const result = calculateDiff(grouped, existingFilms, true);
    // "Another Film" is not in the import → should be archived
    expect(result.toArchive).toHaveLength(1);
    expect(result.toArchive[0]!.title).toBe("Another Film");
  });

  it("does not archive retired films", () => {
    const filmsWithRetired: ExistingFilm[] = [
      ...existingFilms,
      { id: "3", title: "Retired Film", externalId: null, status: "retired" },
    ];
    const grouped = [
      makeGrouped("EXT-001", "Existing Film"),
      makeGrouped("another film", "Another Film"),
    ];
    const result = calculateDiff(grouped, filmsWithRetired, true);
    expect(result.toArchive).toHaveLength(0);
  });

  it("puts errored groups in errored list", () => {
    const grouped = [makeGrouped("bad-film", "Bad Film", true)];
    const result = calculateDiff(grouped, existingFilms, false);
    expect(result.errored).toHaveLength(1);
    expect(result.toCreate).toHaveLength(0);
  });

  it("does not archive existing film when matching imported group has errors", () => {
    const grouped = [makeGrouped("EXT-001", "Existing Film", true)];
    const result = calculateDiff(grouped, existingFilms, true);
    expect(result.errored).toHaveLength(1);
    expect(result.toArchive).toHaveLength(1);
    expect(result.toArchive[0]!.title).toBe("Another Film");
  });

  it("does not archive existing film on errored title-based match", () => {
    const grouped = [makeGrouped("existing film", "Existing Film", true)];
    const result = calculateDiff(grouped, existingFilms, false);
    expect(result.errored).toHaveLength(1);
    expect(result.toArchive).toHaveLength(1);
    expect(result.toArchive[0]!.title).toBe("Another Film");
  });

  it("matches retired films for update instead of creating duplicates", () => {
    const filmsWithRetired: ExistingFilm[] = [
      { id: "1", title: "Archived Film", externalId: "ARC-001", status: "retired" },
    ];
    const grouped = [makeGrouped("ARC-001", "Archived Film")];
    const result = calculateDiff(grouped, filmsWithRetired, true);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toCreate).toHaveLength(0);
  });

  it("matches retired films by title normalization", () => {
    const filmsWithRetired: ExistingFilm[] = [
      { id: "1", title: "Old Classic Film", externalId: null, status: "retired" },
    ];
    const grouped = [makeGrouped("", "old classic film")];
    const result = calculateDiff(grouped, filmsWithRetired, false);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toCreate).toHaveLength(0);
  });
});

describe("validateGroupedFilmForServer", () => {
  const validGroup = {
    identifier: "CAT-001",
    title: "Valid Film",
    type: "direct" as const,
    status: "active" as const,
    prices: [{ countries: ["FR", "BE"], price: 15000, currency: "EUR" }],
    errors: [],
    warnings: [],
    lineNumbers: [2],
  };

  it("returns null for valid payload", () => {
    expect(validateGroupedFilmForServer(validGroup)).toBeNull();
  });

  it("returns INVALID_CURRENCY for unknown currency", () => {
    expect(
      validateGroupedFilmForServer({
        ...validGroup,
        prices: [{ countries: ["FR"], price: 10000, currency: "FAKE" }],
      })
    ).toBe("INVALID_CURRENCY");
  });

  it("returns INVALID_COUNTRY for unknown country", () => {
    expect(
      validateGroupedFilmForServer({
        ...validGroup,
        prices: [{ countries: ["XX"], price: 10000, currency: "EUR" }],
      })
    ).toBe("INVALID_COUNTRY");
  });

  it("returns DUPLICATE_COUNTRY for duplicate country across zones", () => {
    expect(
      validateGroupedFilmForServer({
        ...validGroup,
        prices: [
          { countries: ["FR", "BE"], price: 10000, currency: "EUR" },
          { countries: ["FR", "US"], price: 12000, currency: "USD" },
        ],
      })
    ).toBe("DUPLICATE_COUNTRY");
  });
});
