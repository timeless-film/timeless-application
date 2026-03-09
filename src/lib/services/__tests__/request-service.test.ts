import { describe, expect, it } from "vitest";

import {
  canRelaunchRequest,
  isFinalStatus,
  isValidTransition,
  type RequestStatus,
} from "../request-service";

describe("request-service", () => {
  describe("isValidTransition", () => {
    it("allows pending -> approved", () => {
      expect(isValidTransition("pending", "approved")).toBe(true);
    });

    it("allows pending -> rejected", () => {
      expect(isValidTransition("pending", "rejected")).toBe(true);
    });

    it("allows pending -> cancelled", () => {
      expect(isValidTransition("pending", "cancelled")).toBe(true);
    });

    it("allows approved -> paid", () => {
      expect(isValidTransition("approved", "paid")).toBe(true);
    });

    it("rejects pending -> paid (must go through approved)", () => {
      expect(isValidTransition("pending", "paid")).toBe(false);
    });

    it("rejects approved -> cancelled", () => {
      expect(isValidTransition("approved", "cancelled")).toBe(false);
    });

    it("rejects approved -> rejected", () => {
      expect(isValidTransition("approved", "rejected")).toBe(false);
    });

    it("rejects rejected -> any status", () => {
      expect(isValidTransition("rejected", "pending")).toBe(false);
      expect(isValidTransition("rejected", "approved")).toBe(false);
      expect(isValidTransition("rejected", "cancelled")).toBe(false);
      expect(isValidTransition("rejected", "paid")).toBe(false);
    });

    it("rejects cancelled -> any status", () => {
      expect(isValidTransition("cancelled", "pending")).toBe(false);
      expect(isValidTransition("cancelled", "approved")).toBe(false);
      expect(isValidTransition("cancelled", "rejected")).toBe(false);
      expect(isValidTransition("cancelled", "paid")).toBe(false);
    });

    it("rejects paid -> any status", () => {
      expect(isValidTransition("paid", "pending")).toBe(false);
      expect(isValidTransition("paid", "approved")).toBe(false);
      expect(isValidTransition("paid", "rejected")).toBe(false);
      expect(isValidTransition("paid", "cancelled")).toBe(false);
    });

    it("rejects deprecated status transitions", () => {
      expect(isValidTransition("validated", "paid")).toBe(false);
      expect(isValidTransition("refused", "pending")).toBe(false);
      expect(isValidTransition("expired", "pending")).toBe(false);
    });
  });

  describe("isFinalStatus", () => {
    it("identifies final statuses correctly", () => {
      const finalStatuses: RequestStatus[] = ["rejected", "cancelled", "paid"];
      const nonFinalStatuses: RequestStatus[] = ["pending", "approved"];

      finalStatuses.forEach((status) => {
        expect(isFinalStatus(status), `${status} should be final`).toBe(true);
      });

      nonFinalStatuses.forEach((status) => {
        expect(isFinalStatus(status), `${status} should not be final`).toBe(false);
      });
    });

    it("identifies deprecated statuses as final", () => {
      expect(isFinalStatus("refused")).toBe(true);
      expect(isFinalStatus("expired")).toBe(true);
    });
  });

  describe("canRelaunchRequest", () => {
    it("allows relaunch from cancelled", () => {
      expect(canRelaunchRequest("cancelled")).toBe(true);
    });

    it("allows relaunch from rejected", () => {
      expect(canRelaunchRequest("rejected")).toBe(true);
    });

    it("rejects relaunch from pending", () => {
      expect(canRelaunchRequest("pending")).toBe(false);
    });

    it("rejects relaunch from approved", () => {
      expect(canRelaunchRequest("approved")).toBe(false);
    });

    it("rejects relaunch from paid", () => {
      expect(canRelaunchRequest("paid")).toBe(false);
    });
  });
});
