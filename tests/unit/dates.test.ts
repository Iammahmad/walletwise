import {
  formatMonthStart,
  getZonedParts,
  monthBounds,
  monthBoundsFromStart,
  monthStartFor,
  resolveSpokenDate,
  shiftMonthStart,
} from "@/src/domain/dates";

describe("timezone-aware relative dates", () => {
  const reference = new Date("2026-08-30T10:15:00.000Z"); // Sunday, 15:15 in Karachi

  it("keeps today at the reference instant", () => {
    expect(resolveSpokenDate("paid today", reference, "Asia/Karachi")).toBe(
      reference.toISOString(),
    );
  });

  it("resolves yesterday in the user timezone while keeping wall-clock time", () => {
    expect(resolveSpokenDate("paid yesterday", reference, "Asia/Karachi")).toBe(
      "2026-08-29T10:15:00.000Z",
    );
  });

  it("resolves a weekday to the previous occurrence", () => {
    expect(resolveSpokenDate("paid Friday", reference, "Asia/Karachi")).toBe(
      "2026-08-28T10:15:00.000Z",
    );
  });

  it("resolves ISO and day-first explicit dates at local noon", () => {
    expect(resolveSpokenDate("on 2026-08-12", reference, "Asia/Karachi")).toBe(
      "2026-08-12T07:00:00.000Z",
    );
    expect(resolveSpokenDate("on 12/08/2026", reference, "Asia/Karachi")).toBe(
      "2026-08-12T07:00:00.000Z",
    );
  });

  it("resolves ordinal dates relative to this, last, and next month", () => {
    expect(
      resolveSpokenDate(
        "paid on the first of this month",
        reference,
        "Asia/Karachi",
      ),
    ).toBe("2026-08-01T07:00:00.000Z");
    expect(
      resolveSpokenDate(
        "paid on the 21st of last month",
        reference,
        "Asia/Karachi",
      ),
    ).toBe("2026-07-21T07:00:00.000Z");
    expect(
      resolveSpokenDate(
        "paid on the third of next month",
        reference,
        "Asia/Karachi",
      ),
    ).toBe("2026-09-03T07:00:00.000Z");
  });

  it("resolves named dates with numeric and spoken ordinals", () => {
    expect(
      resolveSpokenDate("paid on August 12th", reference, "Asia/Karachi"),
    ).toBe("2026-08-12T07:00:00.000Z");
    expect(
      resolveSpokenDate(
        "paid on the twenty-third of July 2025",
        reference,
        "Asia/Karachi",
      ),
    ).toBe("2025-07-23T07:00:00.000Z");
    expect(
      resolveSpokenDate("paid on 5 September 2026", reference, "Asia/Karachi"),
    ).toBe("2026-09-05T07:00:00.000Z");
  });

  it("resolves an ordinal without a month to the current month", () => {
    expect(
      resolveSpokenDate("paid on the 15th", reference, "Asia/Karachi"),
    ).toBe("2026-08-15T07:00:00.000Z");
  });

  it("resolves month boundaries across year changes", () => {
    const januaryReference = new Date("2026-01-15T10:00:00.000Z");
    expect(
      resolveSpokenDate(
        "the first of last month",
        januaryReference,
        "Asia/Karachi",
      ),
    ).toBe("2025-12-01T07:00:00.000Z");
    expect(
      resolveSpokenDate(
        "the last day of this month",
        januaryReference,
        "Asia/Karachi",
      ),
    ).toBe("2026-01-31T07:00:00.000Z");
  });

  it("uses the selected locale for ambiguous numeric dates", () => {
    expect(
      resolveSpokenDate("on 03/04/2026", reference, "Asia/Karachi", "en-US"),
    ).toBe("2026-03-04T07:00:00.000Z");
    expect(
      resolveSpokenDate("on 03/04/2026", reference, "Asia/Karachi", "en-PK"),
    ).toBe("2026-04-03T07:00:00.000Z");
  });

  it("rejects invalid calendar dates instead of rolling into another month", () => {
    expect(
      resolveSpokenDate(
        "paid on February 31st 2026",
        reference,
        "Asia/Karachi",
      ),
    ).toBeNull();
    expect(
      resolveSpokenDate("paid on 2026-02-29", reference, "Asia/Karachi"),
    ).toBeNull();
  });

  it("returns exact month bounds for the timezone", () => {
    const bounds = monthBounds(reference, "Asia/Karachi");
    expect(bounds).toEqual({
      start: "2026-07-31T19:00:00.000Z",
      end: "2026-08-31T19:00:00.000Z",
    });
    expect(getZonedParts(new Date(bounds.start), "Asia/Karachi")).toMatchObject(
      { year: 2026, month: 8, day: 1, hour: 0 },
    );
  });

  it("navigates calendar months across year boundaries", () => {
    expect(shiftMonthStart("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonthStart("2026-12-01", 1)).toBe("2027-01-01");
    expect(formatMonthStart("2025-12-01", "en-US")).toBe("December 2025");
  });

  it("builds exact bounds for a selected older month", () => {
    expect(monthStartFor(reference, "Asia/Karachi")).toBe("2026-08-01");
    expect(monthBoundsFromStart("2026-07-01", "Asia/Karachi")).toEqual({
      start: "2026-06-30T19:00:00.000Z",
      end: "2026-07-31T19:00:00.000Z",
    });
  });
});
