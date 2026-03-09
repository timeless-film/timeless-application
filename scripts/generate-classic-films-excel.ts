#!/usr/bin/env tsx
/**
 * Script pour générer un fichier Excel avec plus de 100 films classiques depuis TMDB
 * Usage: pnpm tsx scripts/generate-classic-films-excel.ts
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

interface TmdbDiscoverMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
}

interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  credits: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

interface PriceZone {
  countries: string;
  price: string;
  currency: string;
}

// Zones géographiques avec prix réalistes
const PRICE_ZONES: PriceZone[] = [
  { countries: "FR,BE,CH", price: "250", currency: "EUR" },
  { countries: "DE,AT", price: "280", currency: "EUR" },
  { countries: "ES,PT", price: "220", currency: "EUR" },
  { countries: "IT", price: "260", currency: "EUR" },
  { countries: "GB,IE", price: "300", currency: "GBP" },
  { countries: "US,CA", price: "350", currency: "USD" },
  { countries: "JP", price: "400", currency: "USD" },
  { countries: "AU,NZ", price: "320", currency: "USD" },
  { countries: "BR,AR,MX", price: "200", currency: "USD" },
  { countries: "IN", price: "180", currency: "USD" },
];

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function discoverClassicFilms(
  yearFrom: number,
  yearTo: number,
  page: number = 1
): Promise<TmdbDiscoverMovie[]> {
  const data = await tmdbFetch<{ results: TmdbDiscoverMovie[] }>("/discover/movie", {
    language: "fr-FR",
    sort_by: "popularity.desc",
    "primary_release_date.gte": `${yearFrom}-01-01`,
    "primary_release_date.lte": `${yearTo}-12-31`,
    "vote_count.gte": "100", // Films avec au moins 100 votes pour assurer une qualité minimale
    include_adult: "false",
    page: page.toString(),
  });

  return data.results;
}

async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    language: "fr-FR",
    append_to_response: "credits",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomPriceZones(basePrice: number): PriceZone[] {
  // Choisir aléatoirement 1 à 4 zones de prix pour ce film
  const numZones = Math.floor(Math.random() * 4) + 1;
  const shuffled = [...PRICE_ZONES].sort(() => Math.random() - 0.5);
  const selectedZones = shuffled.slice(0, numZones);

  // Varier légèrement les prix selon la zone
  return selectedZones.map((zone) => {
    const variation = Math.floor(Math.random() * 100) - 50; // -50 à +50
    const adjustedPrice = Math.max(100, basePrice + variation);
    return {
      ...zone,
      price: adjustedPrice.toString(),
    };
  });
}

async function main() {
  console.log("🎬 Génération d'un fichier Excel avec des films classiques depuis TMDB...\n");

  if (!process.env.TMDB_ACCESS_TOKEN && !process.env.TMDB_API_KEY) {
    console.error("❌ TMDB_ACCESS_TOKEN ou TMDB_API_KEY non défini dans .env.local");
    process.exit(1);
  }

  const filmRows: any[] = [];
  const minFilmCount = 100; // Minimum requis
  const targetFilmCount = 130; // Cible pour être sûr d'atteindre le minimum

  // Récupérer des films de différentes décennies pour avoir de la variété
  const decades = [
    { from: 1950, to: 1959, pages: 3 },
    { from: 1960, to: 1969, pages: 3 },
    { from: 1970, to: 1979, pages: 3 },
    { from: 1980, to: 1989, pages: 3 },
    { from: 1990, to: 1999, pages: 2 },
    { from: 2000, to: 2009, pages: 2 },
    { from: 2010, to: 2019, pages: 2 },
  ];

  const seenIds = new Set<number>();
  let filmCount = 0;
  let totalAttempts = 0;

  for (const decade of decades) {
    console.log(`📅 Récupération des films de ${decade.from}-${decade.to}...`);

    for (let page = 1; page <= decade.pages && filmCount < targetFilmCount; page++) {
      try {
        const discovered = await discoverClassicFilms(decade.from, decade.to, page);

        for (const movie of discovered) {
          if (filmCount >= targetFilmCount) break;
          if (seenIds.has(movie.id)) continue; // Éviter les doublons

          seenIds.add(movie.id);
          totalAttempts++;

          try {
            // Récupérer les détails complets (avec crédits)
            const details = await getMovieDetails(movie.id);

            const directors = details.credits.crew
              .filter((c) => c.job === "Director")
              .map((c) => c.name)
              .join(",");

            const cast = details.credits.cast
              .sort((a, b) => a.order - b.order)
              .slice(0, 10)
              .map((c) => c.name)
              .join(",");

            const releaseYear = details.release_date
              ? parseInt(details.release_date.split("-")[0] || "", 10)
              : null;

            const genres = details.genres.map((g) => g.name).join(",");

            // Déterminer le type (mix 70% direct, 30% validation)
            const type = Math.random() < 0.7 ? "direct" : "validation";

            // Déterminer le statut (90% active, 10% inactive)
            const status = Math.random() < 0.9 ? "active" : "inactive";

            // Prix de base aléatoire entre 150 et 350
            const basePrice = Math.floor(Math.random() * 200) + 150;

            // Générer 1 à 4 zones de prix pour ce film
            const priceZones = getRandomPriceZones(basePrice);

            const externalId = `TMDB-${details.id}`;

            // Première ligne avec toutes les infos
            filmRows.push({
              Identifier: externalId,
              Title: details.title,
              Type: type,
              Countries: priceZones[0]?.countries || "FR",
              Price: priceZones[0]?.price || basePrice.toString(),
              Currency: priceZones[0]?.currency || "EUR",
              Status: status,
              Synopsis: details.overview || "",
              Synopsis_EN: "", // On pourrait faire un appel supp. pour l'anglais mais pour l'exemple ça va
              Duration: details.runtime?.toString() || "",
              Release_Year: releaseYear?.toString() || "",
              Genres: genres,
              Directors: directors || "",
              Cast: cast || "",
              Poster_URL: details.poster_path
                ? `${TMDB_IMAGE_BASE}/w500${details.poster_path}`
                : "",
              Backdrop_URL: details.backdrop_path
                ? `${TMDB_IMAGE_BASE}/w1280${details.backdrop_path}`
                : "",
            });

            // Lignes supplémentaires pour les autres zones de prix (sans les métadonnées)
            for (let i = 1; i < priceZones.length; i++) {
              filmRows.push({
                Identifier: externalId,
                Title: details.title,
                Type: type,
                Countries: priceZones[i]?.countries || "",
                Price: priceZones[i]?.price || "",
                Currency: priceZones[i]?.currency || "",
                Status: status,
                Synopsis: "",
                Synopsis_EN: "",
                Duration: "",
                Release_Year: "",
                Genres: "",
                Directors: "",
                Cast: "",
                Poster_URL: "",
                Backdrop_URL: "",
              });
            }

            filmCount++;

            console.log(
              `  ✓ ${filmCount}/${targetFilmCount} - ${details.title} (${releaseYear}) [${type}] - ${priceZones.length} zone(s)`
            );

            // Respecter le rate limit TMDB (40 requests/10sec)
            await sleep(250);
          } catch (error) {
            console.error(`  ⚠️  Erreur pour le film ${movie.title}:`, error);
            continue;
          }
        }

        // Pause entre les pages
        await sleep(500);
      } catch (error) {
        console.error(`  ⚠️  Erreur pour la page ${page}:`, error);
        continue;
      }
    }
  }

  console.log(`\n✅ ${filmCount} films récupérés depuis TMDB`);
  console.log(`📊 ${filmRows.length} lignes générées (avec zones multiples)\n`);

  // Vérification du minimum requis
  if (filmCount < minFilmCount) {
    console.warn(`⚠️  Attention: Seulement ${filmCount} films générés (minimum: ${minFilmCount})`);
    console.warn(`   Le script devrait être relancé ou les paramètres ajustés.\n`);
  }

  // Créer le workbook Excel
  const worksheet = XLSX.utils.json_to_sheet(filmRows, {
    header: [
      "Identifier",
      "Title",
      "Type",
      "Countries",
      "Price",
      "Currency",
      "Status",
      "Synopsis",
      "Synopsis_EN",
      "Duration",
      "Release_Year",
      "Genres",
      "Directors",
      "Cast",
      "Poster_URL",
      "Backdrop_URL",
    ],
  });

  // Ajuster la largeur des colonnes
  const colWidths = [
    { wch: 15 }, // Identifier
    { wch: 40 }, // Title
    { wch: 12 }, // Type
    { wch: 20 }, // Countries
    { wch: 8 }, // Price
    { wch: 10 }, // Currency
    { wch: 10 }, // Status
    { wch: 60 }, // Synopsis
    { wch: 60 }, // Synopsis_EN
    { wch: 10 }, // Duration
    { wch: 12 }, // Release_Year
    { wch: 30 }, // Genres
    { wch: 30 }, // Directors
    { wch: 50 }, // Cast
    { wch: 50 }, // Poster_URL
    { wch: 50 }, // Backdrop_URL
  ];

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Films");

  // Créer le dossier data/ s'il n'existe pas
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Sauvegarder le fichier Excel
  const filename = `timeless-import-sample-${Date.now()}.xlsx`;
  const filepath = path.join(dataDir, filename);

  XLSX.writeFile(workbook, filepath);

  console.log(`\n📊 Fichier Excel généré avec succès !`);
  console.log(`📁 Emplacement: ${filepath}`);
  console.log(`📈 Nombre de films: ${filmCount}`);
  console.log(`📈 Nombre de lignes (avec zones): ${filmRows.length}\n`);

  // Statistiques
  const directCount = filmRows.filter((r) => r.Identifier && r.Type === "direct").length;
  const validationCount = filmRows.filter((r) => r.Identifier && r.Type === "validation").length;
  const activeCount = filmRows.filter((r) => r.Identifier && r.Status === "active").length;
  const inactiveCount = filmRows.filter((r) => r.Identifier && r.Status === "inactive").length;

  console.log(`📊 Statistiques:`);
  console.log(`   • ${directCount} films en achat direct`);
  console.log(`   • ${validationCount} films nécessitant validation`);
  console.log(`   • ${activeCount} films actifs`);
  console.log(`   • ${inactiveCount} films inactifs\n`);

  console.log(`💡 Pour importer ces films dans la base de données:`);
  console.log(`   1. Va dans Films → Importer des films`);
  console.log(`   2. Upload le fichier Excel généré`);
  console.log(`   3. Vérifie le mapping des colonnes`);
  console.log(`   4. Confirme l'import\n`);
}

main().catch((error) => {
  console.error("❌ Erreur:", error);
  process.exit(1);
});
