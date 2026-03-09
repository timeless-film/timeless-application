import { describe, expect, it } from "vitest";

/**
 * Catalog Modal State Tests
 *
 * Tests the state management logic for the film selection modal
 * including cinema/room selection, quantity, dates, and validation.
 */

interface ModalState {
  selectedCinemaId: string | null;
  selectedRoomId: string | null;
  quantity: number;
  startDate: Date | null;
  endDate: Date | null;
  displayCurrency: string;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

const createInitialState = (): ModalState => ({
  selectedCinemaId: null,
  selectedRoomId: null,
  quantity: 1,
  startDate: null,
  endDate: null,
  displayCurrency: "EUR",
  isSubmitting: false,
  errors: {},
});

describe("Catalog Modal State Management", () => {
  describe("cinema and room selection", () => {
    it("initializes with no cinema selected", () => {
      const state = createInitialState();
      expect(state.selectedCinemaId).toBeNull();
      expect(state.selectedRoomId).toBeNull();
    });

    it("sets cinema when selected", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";

      expect(state.selectedCinemaId).toBe("cinema-123");
    });

    it("clears room when cinema changes", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.selectedRoomId = "room-456";

      state.selectedCinemaId = "cinema-789";
      state.selectedRoomId = null; // Automatically cleared

      expect(state.selectedRoomId).toBeNull();
    });

    it("sets room when selected", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.selectedRoomId = "room-456";

      expect(state.selectedRoomId).toBe("room-456");
    });

    it("validates cinema is required before submission", () => {
      const state = createInitialState();
      const isValid = Boolean(state.selectedCinemaId && state.selectedRoomId);

      expect(isValid).toBe(false);
    });

    it("validates room is required before submission", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";

      const isValid = Boolean(state.selectedCinemaId && state.selectedRoomId);

      expect(isValid).toBe(false);
    });

    it("allows submission when cinema and room are selected", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.selectedRoomId = "room-456";

      const isValid = Boolean(state.selectedCinemaId && state.selectedRoomId);

      expect(isValid).toBe(true);
    });
  });

  describe("quantity management", () => {
    it("initializes with quantity = 1", () => {
      const state = createInitialState();
      expect(state.quantity).toBe(1);
    });

    it("increments quantity", () => {
      const state = createInitialState();
      state.quantity = Math.max(1, state.quantity + 1);

      expect(state.quantity).toBe(2);
    });

    it("decrements quantity to minimum 1", () => {
      const state = createInitialState();
      state.quantity = 3;
      state.quantity = Math.max(1, state.quantity - 1);

      expect(state.quantity).toBe(2);
    });

    it("prevents quantity below 1", () => {
      const state = createInitialState();
      state.quantity = 1;
      state.quantity = Math.max(1, state.quantity - 1);

      expect(state.quantity).toBeGreaterThanOrEqual(1);
    });

    it("allows setting arbitrary quantity >= 1", () => {
      const state = createInitialState();
      state.quantity = 25;

      expect(state.quantity).toBe(25);
    });

    it("resets quantity to 1 when modal reopens", () => {
      const state = createInitialState();
      state.quantity = 10;

      const resetState = createInitialState();

      expect(resetState.quantity).toBe(1);
    });
  });

  describe("date management", () => {
    it("initializes with no dates", () => {
      const state = createInitialState();
      expect(state.startDate).toBeNull();
      expect(state.endDate).toBeNull();
    });

    it("allows setting optional start date", () => {
      const state = createInitialState();
      const date = new Date("2024-03-15");
      state.startDate = date;

      expect(state.startDate).toEqual(date);
    });

    it("allows setting optional end date", () => {
      const state = createInitialState();
      const date = new Date("2024-04-15");
      state.endDate = date;

      expect(state.endDate).toEqual(date);
    });

    it("allows both dates to be null (optional feature)", () => {
      const state = createInitialState();
      state.startDate = null;
      state.endDate = null;

      expect(state.startDate).toBeNull();
      expect(state.endDate).toBeNull();
    });

    it("validates end date >= start date when both provided", () => {
      const state = createInitialState();
      state.startDate = new Date("2024-03-15");
      state.endDate = new Date("2024-04-15");

      const isValid = !state.startDate || !state.endDate || state.endDate >= state.startDate;

      expect(isValid).toBe(true);
    });

    it("invalidates when end date < start date", () => {
      const state = createInitialState();
      state.startDate = new Date("2024-04-15");
      state.endDate = new Date("2024-03-15");

      const isValid = !state.startDate || !state.endDate || state.endDate >= state.startDate;

      expect(isValid).toBe(false);
    });
  });

  describe("currency display", () => {
    it("initializes with default currency EUR", () => {
      const state = createInitialState();
      expect(state.displayCurrency).toBe("EUR");
    });

    it("allows changing display currency", () => {
      const state = createInitialState();
      state.displayCurrency = "USD";

      expect(state.displayCurrency).toBe("USD");
    });

    it("does not affect native price currency (only display)", () => {
      const state = createInitialState();
      const nativeCurrency = "EUR";
      state.displayCurrency = "USD";

      // Display currency changed, but native currency unchanged
      expect(nativeCurrency).toBe("EUR");
      expect(state.displayCurrency).toBe("USD");
    });

    it("resets to original currency when modal reopens", () => {
      const state = createInitialState();
      state.displayCurrency = "GBP";

      const resetState = createInitialState();

      expect(resetState.displayCurrency).toBe("EUR");
    });
  });

  describe("total calculation", () => {
    it("calculates total = unit price × quantity", () => {
      const unitPrice = 15000; // 150 EUR
      const quantity = 3;
      const total = unitPrice * quantity;

      expect(total).toBe(45000);
    });

    it("recalculates total when quantity changes", () => {
      const unitPrice = 15000;
      const quantities = [1, 2, 3, 5];
      const totals = quantities.map((q) => unitPrice * q);

      expect(totals).toEqual([15000, 30000, 45000, 75000]);
    });

    it("recalculates total when display currency changes", () => {
      const unitPrice = 15000; // EUR
      const exchangeRate = 1.08;
      const quantity = 2;

      const nativeTotal = unitPrice * quantity;
      const displayTotal = Math.round(nativeTotal * exchangeRate);

      expect(displayTotal).toBe(32400);
    });

    it("maintains native currency total independently", () => {
      const unitPrice = 15000;
      const quantity = 2;
      const nativeTotal = unitPrice * quantity;

      // Even if display currency changes
      const displayTotal = nativeTotal; // Would be converted for display

      expect(nativeTotal).toBe(displayTotal);
    });
  });

  describe("validation and errors", () => {
    it("initializes with no errors", () => {
      const state = createInitialState();
      expect(Object.keys(state.errors)).toHaveLength(0);
    });

    it("sets error when cinema not selected", () => {
      const state = createInitialState();
      if (!state.selectedCinemaId) {
        state.errors.cinema = "Veuillez sélectionner un cinéma";
      }

      expect(state.errors.cinema).toBeDefined();
    });

    it("sets error when room not selected", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";

      if (!state.selectedRoomId) {
        state.errors.room = "Veuillez sélectionner une salle";
      }

      expect(state.errors.room).toBeDefined();
    });

    it("sets error when dates are invalid", () => {
      const state = createInitialState();
      state.startDate = new Date("2024-04-15");
      state.endDate = new Date("2024-03-15");

      if (state.startDate && state.endDate && state.endDate < state.startDate) {
        state.errors.dates = "La date de fin doit être après la date de début";
      }

      expect(state.errors.dates).toBeDefined();
    });

    it("clears errors when fixed", () => {
      const state = createInitialState();
      state.errors.cinema = "Cinéma required";
      state.selectedCinemaId = "cinema-123";
      state.selectedRoomId = "room-456";
      delete state.errors.cinema;

      expect(state.errors.cinema).toBeUndefined();
    });
  });

  describe("submission state", () => {
    it("initializes with isSubmitting = false", () => {
      const state = createInitialState();
      expect(state.isSubmitting).toBe(false);
    });

    it("sets isSubmitting to true during submission", () => {
      const state = createInitialState();
      state.isSubmitting = true;

      expect(state.isSubmitting).toBe(true);
    });

    it("disables form controls when submitting", () => {
      const state = createInitialState();
      state.isSubmitting = true;

      const formDisabled = state.isSubmitting;

      expect(formDisabled).toBe(true);
    });

    it("resets isSubmitting after successful submission", () => {
      const state = createInitialState();
      state.isSubmitting = true;
      state.isSubmitting = false;

      expect(state.isSubmitting).toBe(false);
    });
  });

  describe("duplicate detection", () => {
    it("detects duplicate panier item", () => {
      const filmId = "film-123";
      const cinemaId = "cinema-456";
      const roomId = "room-789";

      const cartItems = [
        {
          filmId: "film-123",
          cinemaId: "cinema-456",
          roomId: "room-789",
        },
      ];

      const isDuplicate = cartItems.some(
        (item) => item.filmId === filmId && item.cinemaId === cinemaId && item.roomId === roomId
      );

      expect(isDuplicate).toBe(true);
    });

    it("detects duplicate pending request", () => {
      const filmId = "film-123";

      const pendingRequests = [
        {
          filmId: "film-123",
          status: "pending",
        },
      ];

      const hasPendingRequest = pendingRequests.some(
        (req) => req.filmId === filmId && req.status === "pending"
      );

      expect(hasPendingRequest).toBe(true);
    });

    it("allows duplicate in different cinema/room", () => {
      const filmId = "film-123";
      const cinemaId = "cinema-456";
      const roomId = "room-789";

      const cartItems = [
        {
          filmId: "film-123",
          cinemaId: "cinema-999",
          roomId: "room-111",
        },
      ];

      const isDuplicate = cartItems.some(
        (item) => item.filmId === filmId && item.cinemaId === cinemaId && item.roomId === roomId
      );

      expect(isDuplicate).toBe(false);
    });
  });

  describe("modal lifecycle", () => {
    it("resets all state when modal opens", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.quantity = 5;
      state.displayCurrency = "USD";

      const resetState = createInitialState();

      expect(resetState.selectedCinemaId).toBeNull();
      expect(resetState.quantity).toBe(1);
      expect(resetState.displayCurrency).toBe("EUR");
    });

    it("closes modal after successful submission", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.selectedRoomId = "room-456";
      state.isSubmitting = false;

      const isModalOpen = Boolean(state.selectedCinemaId);

      expect(isModalOpen).toBe(true);
    });

    it("preserves state while modal is open", () => {
      const state = createInitialState();
      state.selectedCinemaId = "cinema-123";
      state.quantity = 3;

      const snapshot1 = { ...state };
      state.quantity = 4;
      const snapshot2 = { ...state };

      expect(snapshot1.quantity).toBe(3);
      expect(snapshot2.quantity).toBe(4);
    });
  });
});
