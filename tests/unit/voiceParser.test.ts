import { parseVoiceCommand } from "@/src/domain/voiceParser";

const context = {
  defaultCurrency: "PKR",
  locale: "en-PK",
  timezone: "Asia/Karachi",
  accounts: ["Cash", "Bank"],
  categories: [
    "Food",
    "Groceries",
    "Transport",
    "Fuel",
    "Shopping",
    "Bills",
    "Entertainment",
    "Health",
    "Education",
    "Rent",
    "Travel",
    "Other",
    "Income",
  ],
  budgetCategories: [
    "Food",
    "Groceries",
    "Transport",
    "Fuel",
    "Shopping",
    "Bills",
    "Entertainment",
    "Health",
    "Education",
    "Rent",
    "Travel",
    "Other",
    "Eating Out",
  ],
  referenceTime: new Date("2026-08-30T10:15:00.000Z"),
};

describe("deterministic English voice parser", () => {
  it("parses amount, currency, groceries, merchant, and today", () => {
    const result = parseVoiceCommand(
      "I spent 1,250 rupees on groceries at Metro today.",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind !== "transactions") return;
    expect(result.drafts[0]).toMatchObject({
      type: "expense",
      amount: "1250",
      currency: "PKR",
      category: "Groceries",
      merchant: "Metro",
      occurredAt: context.referenceTime.toISOString(),
    });
  });

  it("parses fuel, yesterday, and Cash account", () => {
    const result = parseVoiceCommand(
      "Paid 600 for fuel yesterday from cash.",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind !== "transactions") return;
    expect(result.drafts[0]).toMatchObject({
      amount: "600",
      category: "Fuel",
      account: "Cash",
      occurredAt: "2026-08-29T10:15:00.000Z",
    });
  });

  it("creates multiple drafts from one sentence", () => {
    const result = parseVoiceCommand(
      "Spent 300 on lunch and 150 on coffee.",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind !== "transactions") return;
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((item) => [item.amount, item.category])).toEqual([
      ["300", "Food"],
      ["150", "Food"],
    ]);
  });

  it("recognizes income and salary", () => {
    const result = parseVoiceCommand(
      "I received my salary of 120,000 rupees today.",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind !== "transactions") return;
    expect(result.drafts[0]).toMatchObject({
      type: "income",
      amount: "120000",
      currency: "PKR",
      category: "Income",
    });
  });

  it("returns a reviewed delete command rather than mutating data", () => {
    expect(
      parseVoiceCommand(
        "Delete the coffee expense I added a minute ago.",
        context,
      ),
    ).toMatchObject({
      kind: "delete",
      query: expect.stringContaining("coffee"),
    });
  });

  it("preserves an unparsed transcript for manual completion", () => {
    expect(parseVoiceCommand("Something about lunch", context)).toEqual({
      kind: "unknown",
      transcript: "Something about lunch",
      reason: expect.any(String),
    });
  });

  it("parses English spoken amount words without floating-point conversion", () => {
    const result = parseVoiceCommand(
      "I spent one thousand two hundred and fifty rupees on groceries today",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions")
      expect(result.drafts[0]?.amount).toBe("1250");
  });

  it("supports South Asian spoken amount scales", () => {
    const result = parseVoiceCommand(
      "I received my salary of one lakh twenty thousand rupees today",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions")
      expect(result.drafts[0]?.amount).toBe("120000");
  });

  it("does not mistake a merchant name beginning with One for an amount", () => {
    expect(parseVoiceCommand("I spent at One Store today", context).kind).toBe(
      "unknown",
    );
  });

  it("applies natural calendar dates to the reviewed voice draft", () => {
    const result = parseVoiceCommand(
      "I paid 60,000 for rent on the first of this month from bank",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions") {
      expect(result.drafts[0]).toMatchObject({
        amount: "60000",
        category: "Rent",
        account: "Bank",
        occurredAt: "2026-08-01T07:00:00.000Z",
      });
    }
  });

  it("flags an invalid spoken calendar date for review instead of rolling it over", () => {
    const result = parseVoiceCommand(
      "I paid 600 for food on February 31st 2026",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions") {
      expect(result.drafts[0]?.lowConfidenceFields).toContain("date");
      expect(result.drafts[0]?.occurredAt).toBe(
        context.referenceTime.toISOString(),
      );
    }
  });

  it("matches a custom category by its spoken name", () => {
    const result = parseVoiceCommand("I spent 500 on pets today", {
      ...context,
      categories: [...context.categories, "Pets"],
    });
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions")
      expect(result.drafts[0]?.category).toBe("Pets");
  });

  it("recognizes an explicit budget separately from the expense category", () => {
    const result = parseVoiceCommand(
      "Expense 600 spent on Food in Eating Out budget",
      context,
    );
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions") {
      expect(result.drafts[0]).toMatchObject({
        amount: "600",
        category: "Food",
        budget: "Eating Out",
      });
    }
  });

  it("leaves the budget blank when it was not spoken so local mapping can apply", () => {
    const result = parseVoiceCommand("Spent 600 on Food", context);
    expect(result.kind).toBe("transactions");
    if (result.kind === "transactions")
      expect(result.drafts[0]?.budget).toBeNull();
  });
});
