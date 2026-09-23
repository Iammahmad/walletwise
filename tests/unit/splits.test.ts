import { savingInputSchema, splitInputSchema } from "@/src/domain/schemas";
import {
  allocateEqualShares,
  applySettlement,
  calculateParticipantBalance,
  settlementDirectionForBalance,
  validateSettlement,
} from "@/src/features/splits/calculations";

describe("split calculations", () => {
  it("distributes indivisible minor units without losing money", () => {
    const shares = allocateEqualShares(1000, 3);
    expect(shares).toEqual([334, 333, 333]);
    expect(shares.reduce((sum, amount) => sum + amount, 0)).toBe(1000);
  });

  it("represents money owed to the owner as a positive balance", () => {
    expect(calculateParticipantBalance(6000, 0)).toBe(6000);
    expect(calculateParticipantBalance(0, 6000)).toBe(-6000);
    expect(applySettlement(6000, "received", 2500)).toBe(3500);
    expect(applySettlement(-6000, "paid", 2500)).toBe(-3500);
  });

  it("allows partial and full settlements but rejects overpayment", () => {
    expect(settlementDirectionForBalance(5000)).toBe("received");
    expect(settlementDirectionForBalance(-5000)).toBe("paid");
    expect(() => validateSettlement(-5000, "paid", 500)).not.toThrow();
    expect(() => validateSettlement(-5000, "paid", 5000)).not.toThrow();
    expect(() => validateSettlement(-5000, "paid", 5001)).toThrow(
      "cannot exceed",
    );
    expect(() => validateSettlement(-5000, "received", 500)).toThrow(
      "direction",
    );
  });

  it("requires exactly one owner and balanced shares and payments", () => {
    const valid = {
      description: "Dinner",
      splitType: "equal" as const,
      loanDirection: null,
      totalMinor: 1000,
      currency: "PKR",
      occurredAt: "2026-09-22T10:00:00.000Z",
      note: null,
      participants: [
        { displayName: "You", isOwner: true, shareMinor: 500, paidMinor: 1000 },
        {
          displayName: "Ayesha",
          isOwner: false,
          shareMinor: 500,
          paidMinor: 0,
        },
      ],
    };
    expect(splitInputSchema.safeParse(valid).success).toBe(true);
    expect(
      splitInputSchema.safeParse({ ...valid, totalMinor: 999 }).success,
    ).toBe(false);
    expect(
      splitInputSchema.safeParse({
        ...valid,
        participants: valid.participants.map((item) => ({
          ...item,
          isOwner: false,
        })),
      }).success,
    ).toBe(false);
  });
});

describe("savings separation contract", () => {
  it("validates savings without transaction or budget fields", () => {
    const result = savingInputSchema.parse({
      name: "Emergency fund",
      amountMinor: 250000,
      currency: "PKR",
      occurredAt: "2026-09-22T10:00:00.000Z",
      note: null,
      source: "manual",
    });
    expect(result.amountMinor).toBe(250000);
    expect(result).not.toHaveProperty("categoryId");
    expect(result).not.toHaveProperty("budgetCategoryId");
  });
});
