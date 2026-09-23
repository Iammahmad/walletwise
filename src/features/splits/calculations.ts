export function allocateEqualShares(
  totalMinor: number,
  participantCount: number,
): number[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    throw new Error(
      "The split total must be a positive amount in minor units.",
    );
  }
  if (
    !Number.isSafeInteger(participantCount) ||
    participantCount < 2 ||
    participantCount > 50
  ) {
    throw new Error("An equal split needs between 2 and 50 people.");
  }
  const base = Math.floor(totalMinor / participantCount);
  const remainder = totalMinor - base * participantCount;
  return Array.from(
    { length: participantCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function calculateParticipantBalance(
  shareMinor: number,
  paidMinor: number,
): number {
  if (!Number.isSafeInteger(shareMinor) || !Number.isSafeInteger(paidMinor)) {
    throw new Error("Split values must use integer minor units.");
  }
  // Positive means this participant owes the local user; negative means the
  // local user owes this participant.
  return shareMinor - paidMinor;
}

export function applySettlement(
  balanceMinor: number,
  direction: "received" | "paid",
  amountMinor: number,
): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("The settlement amount must be positive.");
  }
  return balanceMinor + (direction === "received" ? -amountMinor : amountMinor);
}

export function settlementDirectionForBalance(
  balanceMinor: number,
): "received" | "paid" {
  if (!Number.isSafeInteger(balanceMinor) || balanceMinor === 0) {
    throw new Error("There is no outstanding balance to settle.");
  }
  return balanceMinor > 0 ? "received" : "paid";
}

export function validateSettlement(
  balanceMinor: number,
  direction: "received" | "paid",
  amountMinor: number,
): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Enter a valid settlement amount.");
  }
  const expectedDirection = settlementDirectionForBalance(balanceMinor);
  if (direction !== expectedDirection) {
    throw new Error("The settlement direction does not match who owes money.");
  }
  if (amountMinor > Math.abs(balanceMinor)) {
    throw new Error("The settlement cannot exceed the outstanding balance.");
  }
}
