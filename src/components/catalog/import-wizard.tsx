"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { importFilmsAction } from "@/app/[locale]/(rights-holder)/films/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "@/i18n/navigation";
import {
  autoDetectColumns,
  calculateDiff,
  groupRowsByFilm,
  parseAndValidateRow,
} from "@/lib/services/film-import-service";

import type {
  ColumnMapping,
  DiffResult,
  ExistingFilm,
  GroupedFilm,
  ParsedFilmRow,
} from "@/lib/services/film-import-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "upload" | "mapping" | "preview" | "confirm";
type ImportSource = "csv" | "excel";

const MAPPING_FIELDS = [
  "identifier",
  "title",
  "type",
  "countries",
  "price",
  "currency",
  "status",
  "synopsis",
  "synopsisEn",
  "duration",
  "releaseYear",
  "genres",
  "directors",
  "cast",
  "posterUrl",
  "backdropUrl",
] as const;

const MAPPING_FIELD_LABELS: Record<(typeof MAPPING_FIELDS)[number], string> = {
  identifier: "Identifier",
  title: "Title",
  type: "Type",
  countries: "Countries",
  price: "Price",
  currency: "Currency",
  status: "Status",
  synopsis: "Synopsis",
  synopsisEn: "Synopsis (EN)",
  duration: "Duration",
  releaseYear: "Release year",
  genres: "Genres",
  directors: "Directors",
  cast: "Cast",
  posterUrl: "Poster URL",
  backdropUrl: "Backdrop URL",
};

const TEMPLATE_HEADERS = [
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
];

const TEMPLATE_ROWS = [
  [
    "CAT-001",
    "Le Mepris",
    "direct",
    "FR,BE,CH",
    "300",
    "EUR",
    "active",
    "Paul et Camille vivent une crise conjugale.",
    "Paul and Camille face a marital crisis.",
    "103",
    "1963",
    "Drama,Romance",
    "Jean-Luc Godard",
    "Brigitte Bardot,Michel Piccoli",
    "https://example.com/posters/cat-001.jpg",
    "https://example.com/backdrops/cat-001.jpg",
  ],
  [
    "CAT-001",
    "Le Mepris",
    "direct",
    "US,GB",
    "400",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "CAT-001",
    "Le Mepris",
    "direct",
    "JP,KR",
    "390",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-002",
    "Les 400 Coups",
    "direct",
    "FR",
    "250",
    "EUR",
    "active",
    "Antoine Doinel se confronte a l'ecole et a la rue.",
    "Antoine Doinel struggles at school and in the streets.",
    "99",
    "1959",
    "Drama",
    "Francois Truffaut",
    "Jean-Pierre Leaud,Claire Maurier",
    "https://example.com/posters/cat-002.jpg",
    "https://example.com/backdrops/cat-002.jpg",
  ],

  [
    "CAT-003",
    "Alphaville",
    "validation",
    "FR,BE",
    "200",
    "EUR",
    "active",
    "Un agent secret lutte contre une intelligence artificielle.",
    "A secret agent fights an authoritarian AI.",
    "99",
    "1965",
    "Sci-Fi,Noir",
    "Jean-Luc Godard",
    "Eddie Constantine,Anna Karina",
    "https://example.com/posters/cat-003.jpg",
    "https://example.com/backdrops/cat-003.jpg",
  ],
  [
    "CAT-003",
    "Alphaville",
    "validation",
    "US",
    "350",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-004",
    "Cleo de 5 a 7",
    "direct",
    "FR",
    "180",
    "EUR",
    "active",
    "Deux heures dans la vie d'une chanteuse anxieuse.",
    "Two hours in the life of an anxious singer.",
    "90",
    "1962",
    "Drama",
    "Agnes Varda",
    "Corinne Marchand,Antoine Bourseiller",
    "https://example.com/posters/cat-004.jpg",
    "https://example.com/backdrops/cat-004.jpg",
  ],

  [
    "CAT-005",
    "Hiroshima mon amour",
    "direct",
    "FR,BE,CH",
    "320",
    "EUR",
    "inactive",
    "Une histoire d'amour sur fond de memoire et de guerre.",
    "A love story shaped by war and memory.",
    "90",
    "1959",
    "Drama,Romance",
    "Alain Resnais",
    "Emmanuelle Riva,Eiji Okada",
    "https://example.com/posters/cat-005.jpg",
    "https://example.com/backdrops/cat-005.jpg",
  ],

  [
    "CAT-006",
    "La Jetee",
    "direct",
    "FR",
    "150",
    "EUR",
    "active",
    "Un voyage dans le temps raconte en photogrammes.",
    "A time-travel story told through still images.",
    "28",
    "1962",
    "Sci-Fi",
    "Chris Marker",
    "Helene Chatelain,Davos Hanich",
    "https://example.com/posters/cat-006.jpg",
    "https://example.com/backdrops/cat-006.jpg",
  ],
  [
    "CAT-006",
    "La Jetee",
    "direct",
    "US,CA",
    "220",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-007",
    "Playtime",
    "validation",
    "FR,BE",
    "280",
    "EUR",
    "active",
    "Monsieur Hulot se perd dans une ville ultra-moderne.",
    "Monsieur Hulot gets lost in a hyper-modern city.",
    "115",
    "1967",
    "Comedy",
    "Jacques Tati",
    "Jacques Tati,Barbara Dennek",
    "https://example.com/posters/cat-007.jpg",
    "https://example.com/backdrops/cat-007.jpg",
  ],

  [
    "CAT-008",
    "L'Atalante",
    "direct",
    "FR,DE",
    "220",
    "EUR",
    "active",
    "Un couple de mariniers a l'epreuve du quotidien.",
    "A newlywed barge couple faces daily life challenges.",
    "89",
    "1934",
    "Romance,Drama",
    "Jean Vigo",
    "Dita Parlo,Jean Daste",
    "https://example.com/posters/cat-008.jpg",
    "https://example.com/backdrops/cat-008.jpg",
  ],

  [
    "CAT-009",
    "La Grande Illusion",
    "direct",
    "FR",
    "260",
    "EUR",
    "active",
    "Des prisonniers de guerre tissent des liens inattendus.",
    "POWs build unexpected bonds during wartime.",
    "113",
    "1937",
    "Drama,War",
    "Jean Renoir",
    "Jean Gabin,Pierre Fresnay",
    "https://example.com/posters/cat-009.jpg",
    "https://example.com/backdrops/cat-009.jpg",
  ],
  [
    "CAT-009",
    "La Grande Illusion",
    "direct",
    "US,GB",
    "340",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-010",
    "Peeping Tom",
    "validation",
    "GB",
    "290",
    "GBP",
    "active",
    "Un cameraman transforme ses crimes en experiences filmiques.",
    "A cameraman turns his crimes into filmed experiments.",
    "101",
    "1960",
    "Thriller,Horror",
    "Michael Powell",
    "Karlheinz Bohm,Anna Massey",
    "https://example.com/posters/cat-010.jpg",
    "https://example.com/backdrops/cat-010.jpg",
  ],

  [
    "CAT-011",
    "Black Girl",
    "direct",
    "SN,FR",
    "170",
    "EUR",
    "active",
    "Le parcours tragique d'une jeune gouvernante senegalaise.",
    "The tragic path of a young Senegalese maid.",
    "65",
    "1966",
    "Drama",
    "Ousmane Sembene",
    "Mbissine Therese Diop,Anne-Marie Jelinek",
    "https://example.com/posters/cat-011.jpg",
    "https://example.com/backdrops/cat-011.jpg",
  ],

  [
    "CAT-012",
    "Touki Bouki",
    "validation",
    "SN",
    "160",
    "EUR",
    "active",
    "Deux jeunes Dakarois revent de partir pour Paris.",
    "Two young Dakar residents dream of leaving for Paris.",
    "85",
    "1973",
    "Drama,Adventure",
    "Djibril Diop Mambety",
    "Mareme Niang,Magueye Niang",
    "https://example.com/posters/cat-012.jpg",
    "https://example.com/backdrops/cat-012.jpg",
  ],
  [
    "CAT-012",
    "Touki Bouki",
    "validation",
    "US",
    "250",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-013",
    "The Red Shoes",
    "direct",
    "GB",
    "330",
    "GBP",
    "inactive",
    "Le dilemme entre creation artistique et vie personnelle.",
    "A dilemma between artistic ambition and personal life.",
    "134",
    "1948",
    "Drama,Music",
    "Michael Powell,Emeric Pressburger",
    "Moira Shearer,Anton Walbrook",
    "https://example.com/posters/cat-013.jpg",
    "https://example.com/backdrops/cat-013.jpg",
  ],

  [
    "CAT-014",
    "Aniki-Bobo",
    "direct",
    "PT",
    "140",
    "EUR",
    "active",
    "Une chronique d'enfance entre innocence et jalousie.",
    "A childhood chronicle of innocence and jealousy.",
    "71",
    "1942",
    "Drama",
    "Manoel de Oliveira",
    "Narciso Costa,Fernanda Matos",
    "https://example.com/posters/cat-014.jpg",
    "https://example.com/backdrops/cat-014.jpg",
  ],

  [
    "CAT-015",
    "Solaris",
    "validation",
    "FR,DE",
    "300",
    "EUR",
    "active",
    "Une mission spatiale confronte les souvenirs intimes.",
    "A space mission confronts intimate memories.",
    "167",
    "1972",
    "Sci-Fi,Drama",
    "Andrei Tarkovsky",
    "Donatas Banionis,Natalya Bondarchuk",
    "https://example.com/posters/cat-015.jpg",
    "https://example.com/backdrops/cat-015.jpg",
  ],
  [
    "CAT-015",
    "Solaris",
    "validation",
    "US,CA",
    "420",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "CAT-015",
    "Solaris",
    "validation",
    "JP",
    "410",
    "USD",
    "active",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],

  [
    "CAT-016",
    "Stalker",
    "validation",
    "FR",
    "290",
    "EUR",
    "active",
    "Trois hommes traversent une Zone mysterieuse.",
    "Three men cross a mysterious Zone.",
    "162",
    "1979",
    "Sci-Fi,Drama",
    "Andrei Tarkovsky",
    "Alexander Kaidanovsky,Alisa Freindlikh",
    "https://example.com/posters/cat-016.jpg",
    "https://example.com/backdrops/cat-016.jpg",
  ],

  [
    "CAT-017",
    "Wings of Desire",
    "direct",
    "DE,FR",
    "270",
    "EUR",
    "active",
    "Des anges observent Berlin et ses habitants.",
    "Angels observe Berlin and its inhabitants.",
    "128",
    "1987",
    "Fantasy,Drama",
    "Wim Wenders",
    "Bruno Ganz,Solveig Dommartin",
    "https://example.com/posters/cat-017.jpg",
    "https://example.com/backdrops/cat-017.jpg",
  ],

  [
    "CAT-018",
    "A Brighter Summer Day",
    "direct",
    "TW",
    "360",
    "USD",
    "active",
    "Le passage a l'age adulte dans le Taipei des annees 60.",
    "Coming of age in 1960s Taipei.",
    "237",
    "1991",
    "Crime,Drama",
    "Edward Yang",
    "Chang Chen,Lisa Yang",
    "https://example.com/posters/cat-018.jpg",
    "https://example.com/backdrops/cat-018.jpg",
  ],

  [
    "CAT-019",
    "Pather Panchali",
    "direct",
    "IN",
    "210",
    "USD",
    "active",
    "Le quotidien d'une famille rurale du Bengale.",
    "Daily life of a rural Bengali family.",
    "125",
    "1955",
    "Drama",
    "Satyajit Ray",
    "Kanu Banerjee,Karuna Banerjee",
    "https://example.com/posters/cat-019.jpg",
    "https://example.com/backdrops/cat-019.jpg",
  ],

  [
    "",
    "The Color of Pomegranates",
    "validation",
    "AM,FR",
    "240",
    "EUR",
    "active",
    "Une biographie poetique en tableaux visuels.",
    "A poetic biography told through visual tableaux.",
    "79",
    "1969",
    "Drama,Art",
    "Sergei Parajanov",
    "Sofiko Chiaureli,Melkon Alekyan",
    "",
    "",
  ],
];

interface ImportWizardProps {
  existingFilms: ExistingFilm[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportWizard({ existingFilms }: ImportWizardProps) {
  const t = useTranslations("films.import");
  const router = useRouter();

  // ─── Wizard state ──────────────────────────────────────────────────────

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
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
  });
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>("csv");
  const [autoEnrichImportedFilms, setAutoEnrichImportedFilms] = useState(false);

  // ─── Scroll tracking for table preview ──────────────────────────────────
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [canScrollRight, setCanScrollRight] = useState(true); // Start as true to show hint

  useEffect(() => {
    const scrollContainer = tableScrollRef.current;
    if (!scrollContainer) return;

    // Hide hint when scrolling
    const handleScroll = () => {
      setShowScrollHint(false);
    };

    // Check if table can scroll horizontally
    const checkScroll = () => {
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      const hasScroll = scrollWidth > clientWidth;
      setCanScrollRight(hasScroll);
    };

    // Attach listener immediately
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    // Check dimensions after brief delay
    const timeoutId = setTimeout(() => {
      checkScroll();
    }, 100);

    // Auto-hide hint after 6 seconds if user hasn't scrolled
    const autoHideId = setTimeout(() => {
      setShowScrollHint(false);
    }, 6000);

    const handleResize = () => {
      checkScroll();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(autoHideId);
      window.removeEventListener("resize", handleResize);
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [headers, rawRows]);

  // ─── File handling ─────────────────────────────────────────────────────

  const handleFile = useCallback(
    (file: File) => {
      // Validate size (10 MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("upload.tooLarge"));
        return;
      }

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (extension === "csv" || extension === "tsv") {
        setImportSource("csv");
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data.length > 5000) {
              toast.error(t("upload.tooManyRows", { count: results.data.length }));
              return;
            }
            const fileHeaders = results.meta.fields ?? [];
            setHeaders(fileHeaders);
            setRawRows(results.data);
            const detected = autoDetectColumns(fileHeaders);
            setMapping(detected);
            setStep("mapping");
          },
        });
      } else if (extension === "xlsx" || extension === "xls") {
        setImportSource("excel");
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) return;
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
            defval: "",
            raw: false,
          });

          if (jsonData.length > 5000) {
            toast.error(t("upload.tooManyRows", { count: jsonData.length }));
            return;
          }

          const fileHeaders = jsonData.length > 0 ? Object.keys(jsonData[0]!) : [];
          setHeaders(fileHeaders);
          setRawRows(jsonData);
          const detected = autoDetectColumns(fileHeaders);
          setMapping(detected);
          setStep("mapping");
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error(t("upload.invalidFormat"));
      }
    },
    [t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ─── Mapping helpers ──────────────────────────────────────────────────

  function getMappedFieldForHeader(header: string) {
    return MAPPING_FIELDS.find((field) => mapping[field] === header) ?? null;
  }

  function updateHeaderMapping(header: string, selectedField: string) {
    const nextField = selectedField === "_none" ? null : (selectedField as keyof ColumnMapping);

    setMapping((previousMapping) => {
      const updatedMapping: ColumnMapping = { ...previousMapping };

      // Remove this header from any previously mapped field.
      for (const field of MAPPING_FIELDS) {
        if (updatedMapping[field] === header) {
          updatedMapping[field] = null;
        }
      }

      if (nextField) {
        updatedMapping[nextField] = header;
      }

      return updatedMapping;
    });
  }

  // ─── Download sample template ──────────────────────────────────────────

  function downloadSampleTemplate() {
    const sampleData = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Films");
    XLSX.writeFile(wb, "timeless-import-template.xlsx");
  }

  function downloadCsvTemplate() {
    const csv = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
      .map((line) => line.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "timeless-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ─── Compute diff ─────────────────────────────────────────────────────

  const parsedRows = useMemo(() => {
    return rawRows
      .map((row, idx) => parseAndValidateRow(row, mapping, idx + 2)) // +2 for header row + 1-indexed
      .filter((row): row is ParsedFilmRow => row !== null);
  }, [rawRows, mapping]);

  const groupedFilms = useMemo(() => groupRowsByFilm(parsedRows), [parsedRows]);
  const warningCount = useMemo(
    () => groupedFilms.reduce((sum, film) => sum + film.warnings.length, 0),
    [groupedFilms]
  );

  function proceedToPreview() {
    const result = calculateDiff(groupedFilms, existingFilms, !!mapping.identifier);
    setDiff(result);
    setStep("preview");
  }

  // ─── Import execution ─────────────────────────────────────────────────

  async function handleImport() {
    if (!diff) return;
    setImporting(true);

    const importedMetadataFields = MAPPING_FIELDS.filter(
      (
        field
      ): field is
        | "synopsis"
        | "synopsisEn"
        | "duration"
        | "releaseYear"
        | "genres"
        | "directors"
        | "cast"
        | "posterUrl"
        | "backdropUrl" => {
        if (
          field !== "synopsis" &&
          field !== "synopsisEn" &&
          field !== "duration" &&
          field !== "releaseYear" &&
          field !== "genres" &&
          field !== "directors" &&
          field !== "cast" &&
          field !== "posterUrl" &&
          field !== "backdropUrl"
        ) {
          return false;
        }

        return mapping[field] !== null;
      }
    );

    try {
      const result = await importFilmsAction({
        toCreate: diff.toCreate,
        toUpdate: diff.toUpdate,
        toArchive: diff.toArchive,
        hasIdentifierColumn: !!mapping.identifier,
        importSource,
        autoEnrichImportedFilms,
        importedMetadataFields,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(t("result.success"));
      toast.info(
        [
          result.created > 0 ? t("result.created", { count: result.created }) : null,
          result.updated > 0 ? t("result.updated", { count: result.updated }) : null,
          result.archived > 0 ? t("result.archived", { count: result.archived }) : null,
          result.errors > 0 ? t("result.errors", { count: result.errors }) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );

      router.push("/films");
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setImporting(false);
    }
  }

  // ─── Steps ────────────────────────────────────────────────────────────

  const previewRows = rawRows.slice(0, 10);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "preview", "confirm"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span className={step === s ? "font-semibold" : "text-muted-foreground"}>
              {t(`step.${s}`)}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <label
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors hover:border-primary"
            >
              <FileUp className="text-muted-foreground mb-4 size-12" />
              <p className="text-muted-foreground mb-2">{t("upload.dragDrop")}</p>
              <p className="text-muted-foreground text-xs">{t("upload.maxSize")}</p>
              <input
                type="file"
                accept=".csv,.tsv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            <div className="mt-4 flex justify-center">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
                  <Download className="mr-2 size-4" />
                  {t("templateDownloadCsv")}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadSampleTemplate}>
                  <Download className="mr-2 size-4" />
                  {t("templateDownloadExcel")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <>
          <Card className="w-full min-w-0 max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">{t("step.mapping")}</CardTitle>
              <CardDescription>{t("mapping.autoDetected")}</CardDescription>
            </CardHeader>
            <CardContent className="w-full min-w-0 space-y-4">
              {/* Preview first 10 rows */}
              {previewRows.length > 0 && (
                <div className="mt-4 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-muted-foreground text-sm">{t("mapping.previewRows")}</p>
                    {showScrollHint && (
                      <div className="animate-pulse flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-1 text-xs font-medium text-white">
                        Scroll right
                        <ArrowRight className="size-3" />
                      </div>
                    )}
                  </div>
                  <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border/60 relative">
                    <div
                      ref={tableScrollRef}
                      className="w-full min-w-0 max-w-full overflow-x-auto"
                      style={{
                        boxShadow: canScrollRight
                          ? "inset -25px 0 20px -5px rgba(0, 0, 0, 0.15)"
                          : "none",
                      }}
                    >
                      <Table className="w-max min-w-full">
                        <TableHeader>
                          <TableRow className="border-border/40">
                            {headers.map((header) => {
                              const mappedField = getMappedFieldForHeader(header);
                              const isSkipped = mappedField === null;
                              const isIdentifier = mappedField === "identifier";

                              return (
                                <TableHead
                                  key={header}
                                  className={`min-w-[220px] px-3 py-2 align-top ${
                                    isIdentifier
                                      ? "bg-primary/5"
                                      : isSkipped
                                        ? "bg-muted/50 text-muted-foreground"
                                        : ""
                                  }`}
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-mono text-xs">{header}</p>
                                      {isIdentifier && (
                                        <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                                          ID
                                        </span>
                                      )}
                                    </div>
                                    <Select
                                      value={mappedField ?? "_none"}
                                      onValueChange={(value) => updateHeaderMapping(header, value)}
                                    >
                                      <SelectTrigger
                                        className={`h-8 text-xs ${isIdentifier ? "border-primary/30" : ""}`}
                                      >
                                        <SelectValue placeholder={t("mapping.unmapped")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="_none">
                                          {t("mapping.unmapped")}
                                        </SelectItem>
                                        {MAPPING_FIELDS.map((field) => (
                                          <SelectItem key={field} value={field}>
                                            {MAPPING_FIELD_LABELS[field]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.map((row, i) => (
                            <TableRow key={i} className="border-b border-border/40">
                              {headers.map((header) => {
                                const isSkipped = getMappedFieldForHeader(header) === null;

                                return (
                                  <TableCell
                                    key={header}
                                    className={`text-xs ${
                                      isSkipped ? "bg-muted/35 text-muted-foreground" : ""
                                    }`}
                                  >
                                    {row[header] ?? ""}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {previewRows.length === 0 && (
                <p className="text-muted-foreground text-sm">{t("diff.noChanges")}</p>
              )}

              {!mapping.identifier && (
                <p className="text-xs text-amber-600">{t("mapping.identifierRequired")}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="mr-2 size-4" />
              {t("back")}
            </Button>
            <Button
              onClick={proceedToPreview}
              disabled={!mapping.identifier || !mapping.title || !mapping.type}
            >
              {t("next")}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Preview / Diff */}
      {step === "preview" && diff && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              icon={<CheckCircle2 className="size-5 text-green-600" />}
              label={t("diff.toCreate", { count: diff.toCreate.length })}
              count={diff.toCreate.length}
            />
            <SummaryCard
              icon={<ArrowRight className="size-5 text-blue-600" />}
              label={t("diff.toUpdate", { count: diff.toUpdate.length })}
              count={diff.toUpdate.length}
            />
            <SummaryCard
              icon={<AlertTriangle className="size-5 text-amber-600" />}
              label={t("diff.toArchive", { count: diff.toArchive.length })}
              count={diff.toArchive.length}
            />
            <SummaryCard
              icon={<XCircle className="size-5 text-red-600" />}
              label={t("diff.errors", { count: diff.errored.length })}
              count={diff.errored.length}
            />
            <SummaryCard
              icon={<AlertTriangle className="size-5 text-orange-600" />}
              label={t("warnings", { count: warningCount })}
              count={warningCount}
            />
          </div>

          {/* Detail tables */}
          {diff.toCreate.length > 0 && (
            <DiffSection
              title={t("diff.toCreate", { count: diff.toCreate.length })}
              films={diff.toCreate}
              variant="create"
            />
          )}
          {diff.toUpdate.length > 0 && (
            <DiffSection
              title={t("diff.toUpdate", { count: diff.toUpdate.length })}
              films={diff.toUpdate}
              variant="update"
            />
          )}
          {diff.toArchive.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("diff.toArchive", { count: diff.toArchive.length })}
                </CardTitle>
                <CardDescription className="text-amber-600">
                  {t("diff.archiveWarning")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {diff.toArchive.map((f) => (
                    <li key={f.id} className="text-sm">
                      {f.title}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {diff.errored.length > 0 && (
            <DiffSection
              title={t("diff.errors", { count: diff.errored.length })}
              films={diff.errored}
              variant="error"
            />
          )}
          {warningCount > 0 && (
            <DiffSection
              title={t("warnings", { count: warningCount })}
              films={groupedFilms.filter((film) => film.warnings.length > 0)}
              variant="warning"
            />
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              <ArrowLeft className="mr-2 size-4" />
              {t("back")}
            </Button>
            <Button
              onClick={() => setStep("confirm")}
              disabled={
                diff.toCreate.length === 0 &&
                diff.toUpdate.length === 0 &&
                diff.toArchive.length === 0
              }
            >
              {t("next")}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Confirmation */}
      {step === "confirm" && diff && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("step.confirm")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {diff.toCreate.length > 0 && (
                  <p>✅ {t("diff.toCreate", { count: diff.toCreate.length })}</p>
                )}
                {diff.toUpdate.length > 0 && (
                  <p>🔄 {t("diff.toUpdate", { count: diff.toUpdate.length })}</p>
                )}
                {diff.toArchive.length > 0 && (
                  <p>⚠️ {t("diff.toArchive", { count: diff.toArchive.length })}</p>
                )}
              </div>

              {diff.toArchive.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("confirmation.typeConfirm")}</p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={t("confirmation.confirmPlaceholder")}
                    disabled={importing}
                  />
                </div>
              )}

              <div className="flex items-start space-x-3 rounded-md border border-border/60 p-3">
                <Checkbox
                  id="auto-enrich-import"
                  checked={autoEnrichImportedFilms}
                  onCheckedChange={(checked) => setAutoEnrichImportedFilms(checked === true)}
                  disabled={importing}
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="auto-enrich-import"
                    className="cursor-pointer text-sm font-medium"
                  >
                    {t("confirmation.autoEnrichLabel")}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {t("confirmation.autoEnrichHint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("preview")} disabled={importing}>
              <ArrowLeft className="mr-2 size-4" />
              {t("back")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push("/films")} disabled={importing}>
                {t("cancel")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  importing ||
                  (diff.toArchive.length > 0 &&
                    confirmText !== t("confirmation.confirmPlaceholder"))
                }
              >
                {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
                {importing
                  ? t("confirmation.importing")
                  : t("confirm", {
                      count: diff.toCreate.length + diff.toUpdate.length,
                    })}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        {icon}
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DiffSection({
  title,
  films,
  variant,
}: {
  title: string;
  films: GroupedFilm[];
  variant: "create" | "update" | "error" | "warning";
}) {
  const t = useTranslations("films.import");

  const variantColors = {
    create: "border-green-200",
    update: "border-blue-200",
    error: "border-red-200",
    warning: "border-orange-200",
  };

  return (
    <Card className={variantColors[variant]}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.title")}</TableHead>
              <TableHead>{t("table.type")}</TableHead>
              <TableHead>{t("table.zones")}</TableHead>
              {variant === "error" && <TableHead>{t("table.errors")}</TableHead>}
              {variant === "warning" && <TableHead>{t("table.warnings")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {films.map((film, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{film.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{film.type}</Badge>
                </TableCell>
                <TableCell>{film.prices.length}</TableCell>
                {variant === "error" && (
                  <TableCell>
                    {film.errors.map((err, j) => (
                      <Badge key={j} variant="destructive" className="mr-1 mb-1">
                        {t("table.lineColumn", {
                          line: err.lineNumber,
                          column: err.column,
                          code: err.code,
                        })}
                      </Badge>
                    ))}
                  </TableCell>
                )}
                {variant === "warning" && (
                  <TableCell>
                    {film.warnings.map((warning, j) => (
                      <Badge key={j} variant="secondary" className="mr-1 mb-1">
                        {t("table.lineColumn", {
                          line: warning.lineNumber,
                          column: warning.column,
                          code: warning.code,
                        })}
                      </Badge>
                    ))}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
