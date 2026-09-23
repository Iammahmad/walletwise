"use strict";

const screenGroups = [
  {
    label: "Brand & onboarding",
    screens: [
      ["splash", "Splash", "auto_awesome"],
      ["welcome", "Welcome", "waving_hand"],
      ["preferences", "Preferences", "tune"],
      ["privacy", "Local-first privacy", "verified_user"],
    ],
  },
  {
    label: "Core money tracking",
    screens: [
      ["home", "Home", "home"],
      ["transactions", "Transactions", "receipt_long"],
      ["filters", "Transaction filters", "filter_list"],
      ["add", "Add transaction", "add_circle"],
      ["edit", "Edit transaction", "edit_note"],
    ],
  },
  {
    label: "Voice entry",
    screens: [
      ["voice-listening", "Listening", "graphic_eq"],
      ["voice-clarification", "Needs clarification", "help"],
      ["voice-review", "Voice review", "fact_check"],
    ],
  },
  {
    label: "Budgets",
    screens: [
      ["budgets", "Budget dashboard", "donut_large"],
      ["budget-editor", "Create budget", "add_chart"],
      ["budget-detail", "Budget detail", "analytics"],
    ],
  },
  {
    label: "Splits",
    screens: [
      ["splits", "Splits dashboard", "group"],
      ["split-type", "New split", "call_split"],
      ["equal-split", "Equal split", "balance"],
      ["loan", "Loan entry", "handshake"],
      ["friend", "Friend balance", "person"],
      ["split-detail", "Split detail", "receipt"],
      ["settle", "Settle up", "done_all"],
    ],
  },
  {
    label: "Settings & categories",
    screens: [
      ["settings", "Settings", "settings"],
      ["backup", "Google & cloud backup", "cloud_sync"],
      ["categories", "Transaction categories", "category"],
      ["category-editor", "Category editor", "interests"],
      ["budget-categories", "Budget categories", "folder_special"],
      ["budget-category-editor", "Budget category editor", "folder_open"],
    ],
  },
];

const screenMeta = {
  splash: ["Splash", "A focused first impression using the approved two-layer WalletWise mark and the all-in-one budget message."],
  welcome: ["Welcome", "The first onboarding screen introduces fast voice entry without positioning it as the whole product."],
  preferences: ["Preferences", "Currency, locale, and timezone are explicit setup choices—no hard-coded currency assumptions."],
  privacy: ["Local-first privacy", "Explains local-only mode, optional sign-in, optional cloud AI, and the no-audio-retention promise."],
  home: ["Home", "Current-month money summary, category insight, recent activity, and fast manual or voice entry."],
  transactions: ["Transactions", "Searchable month-scoped history with clear manual/voice provenance and expense/income treatment."],
  filters: ["Transaction filters", "A compact bottom sheet for date, type, category, account, and budget filters."],
  add: ["Add transaction", "A fast manual entry flow with automatic, explicit, or excluded budget assignment."],
  edit: ["Edit transaction", "The same reusable form with destructive actions isolated and clearly labeled."],
  "voice-listening": ["Listening", "High-visibility recording state, live transcript, silence guidance, cancel, and stop controls."],
  "voice-clarification": ["Needs clarification", "Transcript is preserved while the user resolves only missing or uncertain details."],
  "voice-review": ["Voice review", "Nothing is saved until the user reviews and explicitly confirms each parsed transaction."],
  budgets: ["Budget dashboard", "A month-scoped budget overview with category-level remaining amounts and visible overall progress."],
  "budget-editor": ["Create budget", "Creates an overall or category budget for the currently viewed month."],
  "budget-detail": ["Budget detail", "Shows only transactions assigned to this budget and explains automatic versus explicit matches."],
  splits: ["Splits dashboard", "Standalone social balances for equal splits and loans; these entries never affect budgets or spending."],
  "split-type": ["New split", "A clear choice between sharing an expense and recording a direct loan."],
  "equal-split": ["Equal split", "Participants, payer, amount, and shares remain easy to audit before saving."],
  loan: ["Loan entry", "Records whether you lent or borrowed money without creating a normal financial transaction."],
  friend: ["Friend balance", "A person-centered history showing exactly why they owe you—or why you owe them."],
  "split-detail": ["Split detail", "Transparent contribution math, participants, notes, and settlement history."],
  settle: ["Settle up", "A focused settlement action that updates only the standalone split ledger."],
  settings: ["Settings", "Profile, sync, preferences, category systems, privacy, export, and data controls."],
  backup: ["Google & cloud backup", "Optional Google sign-in enables encrypted backup and multi-device synchronization."],
  categories: ["Transaction categories", "Everyday classification stays independent from budget grouping and remains fully editable."],
  "category-editor": ["Category editor", "A much broader icon catalog makes custom categories feel personal and recognizable."],
  "budget-categories": ["Budget categories", "Budget groups are separate, reusable entities; matching names still auto-connect when appropriate."],
  "budget-category-editor": ["Budget category editor", "Build broad groups such as Household while preserving the one-transaction/one-budget maximum."],
};

const allScreens = screenGroups.flatMap((group) => group.screens.map(([id]) => id));
const state = {
  screen: "home",
  themeMode: "compare",
  monthOffset: 0,
  selectedCategoryIcon: "restaurant",
};

const money = (value) => `PKR ${value}`;
const icon = (name, label = "") =>
  `<span class="material-symbols-rounded"${label ? ` aria-label="${label}"` : " aria-hidden=\"true\""}>${name}</span>`;

function statusBar() {
  return `
    <div class="phone-status">
      <span>9:41</span>
      <span class="dynamic-island"></span>
      <span class="status-icons">${icon("signal_cellular_alt")}${icon("wifi")}${icon("battery_full")}</span>
    </div>`;
}

function header(title, subtitle = "", action = "", back = "") {
  const leading = back
    ? `<button class="back-button" type="button" data-go="${back}" aria-label="Back">${icon("arrow_back")}</button>`
    : "";
  return `
    <div class="phone-header">
      ${leading}
      <div style="flex:1">
        <h2 class="phone-title">${title}</h2>
        ${subtitle ? `<p class="phone-subtitle">${subtitle}</p>` : ""}
      </div>
      ${action}
    </div>`;
}

function monthPicker() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + state.monthOffset);
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
  const hint = state.monthOffset === 0 ? "Current month" : state.monthOffset === -1 ? "Previous month" : "Selected month";
  return `
    <div class="month-picker">
      <button type="button" data-month="-1" aria-label="Previous month">${icon("chevron_left")}</button>
      <div><strong>${month}</strong><span>${hint}</span></div>
      <button type="button" data-month="1" aria-label="Next month">${icon("chevron_right")}</button>
    </div>`;
}

function tabs(active) {
  const items = [
    ["home", "home", "Home"],
    ["transactions", "receipt_long", "Activity"],
    ["add", "add", "Add"],
    ["budgets", "donut_large", "Budgets"],
    ["splits", "group", "Splits"],
  ];
  return `<nav class="bottom-tabs" aria-label="App navigation">${items
    .map(
      ([target, glyph, label], index) => `
        <button type="button" data-go="${target}" class="tab-button ${index === 2 ? "add-tab" : ""} ${active === target ? "is-active" : ""}">
          ${icon(glyph)}${index === 2 ? "" : `<span>${label}</span>`}
        </button>`,
    )
    .join("")}</nav>`;
}

function phone(theme, content, options = {}) {
  const { activeTab = "", noTabs = false } = options;
  return `
    <article class="phone" data-theme="${theme}" aria-label="${theme} ${screenMeta[state.screen][0]} design">
      ${statusBar()}
      <div class="phone-content ${noTabs ? "no-tabs" : ""}">${content}</div>
      ${noTabs ? "" : tabs(activeTab)}
    </article>`;
}

function transactionRow(glyph, title, meta, amount, tone = "negative", source = "Manual") {
  return `
    <div class="transaction-row">
      <span class="transaction-icon">${icon(glyph)}</span>
      <span class="transaction-copy"><strong>${title}</strong><span>${meta}</span></span>
      <span class="transaction-value"><strong class="${tone}">${amount}</strong><span><i class="source-dot"></i>${source}</span></span>
    </div>`;
}

function field(label, value, glyph = "expand_more", className = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <span class="input-like ${className}"><span>${value}</span>${glyph ? icon(glyph) : ""}</span>
    </label>`;
}

function progressCard(glyph, title, spent, total, progress, status = "", subtitle = "Monthly budget") {
  const remaining = Math.max(0, total - spent).toLocaleString("en-US");
  return `
    <button type="button" class="progress-card" data-go="budget-detail" style="width:100%;text-align:left">
      <span class="progress-head">
        <span class="list-icon">${icon(glyph)}</span>
        <span><strong>${title}</strong><span>${subtitle}</span></span>
        <span class="progress-value"><strong>${money(remaining)}</strong><span>left</span></span>
      </span>
      <span class="progress-track ${status}" style="--progress:${Math.min(progress, 100)}%"><i></i></span>
    </button>`;
}

function splash(theme) {
  const source = theme === "purple" ? "../assets/walletwise-icon-purple-v1.png" : "../assets/walletwise-icon-emerald-v1.png";
  return phone(
    theme,
    `<div class="splash-screen">
      <img class="brand-app-icon" src="${source}" alt="WalletWise two-layer open wallet mark" />
      <h1 class="splash-wordmark">Wallet<span>Wise</span></h1>
      <p class="splash-tagline">One app. Every budget under control.</p>
      <div class="splash-wave" aria-hidden="true">
        ${[8, 16, 29, 44, 31, 19, 11].map((height) => `<i style="--h:${height}px"></i>`).join("")}
      </div>
    </div>`,
    { noTabs: true },
  );
}

function welcome(theme) {
  return phone(
    theme,
    `<div class="onboarding-screen">
      <div class="onboarding-art"><div class="onboarding-logo">${icon("account_balance_wallet")}</div></div>
      <p class="eyebrow" style="color:var(--ww-primary)">Meet WalletWise</p>
      <h2>Money tracking that keeps up with you.</h2>
      <p>Log spending in seconds, speak naturally, build flexible budgets, and stay clear on shared expenses—all from one private place.</p>
      <div class="onboarding-actions">
        <button class="primary-button" type="button" data-go="preferences">Get started ${icon("arrow_forward")}</button>
        <div class="page-dots"><i class="is-active"></i><i></i><i></i></div>
      </div>
    </div>`,
    { noTabs: true },
  );
}

function preferences(theme) {
  return phone(
    theme,
    `<div class="onboarding-screen">
      ${header("Make it yours", "You can change these anytime", "", "welcome")}
      <div style="margin:10px 0 22px" class="info-banner">${icon("language")}<div><strong>Designed for your locale</strong><p>Amounts and dates are always formatted with your selected preferences.</p></div></div>
      <div class="field-grid">
        ${field("Default currency", "PKR — Pakistani Rupee")}
        ${field("Language & locale", "English (Pakistan)")}
        ${field("Timezone", "Asia / Karachi")}
      </div>
      <div class="section-heading"><h3>Starting accounts</h3><button type="button">Edit</button></div>
      <div class="settings-card">
        <div class="setting-row"><span class="list-icon">${icon("payments")}</span><span class="list-copy"><strong>Cash</strong><span>For notes and coins</span></span>${icon("check_circle")}</div>
        <div class="setting-row"><span class="list-icon">${icon("account_balance")}</span><span class="list-copy"><strong>Bank</strong><span>Primary bank account</span></span>${icon("check_circle")}</div>
      </div>
      <div class="onboarding-actions">
        <button class="primary-button" type="button" data-go="privacy">Continue ${icon("arrow_forward")}</button>
        <div class="page-dots"><i></i><i class="is-active"></i><i></i></div>
      </div>
    </div>`,
    { noTabs: true },
  );
}

function privacy(theme) {
  return phone(
    theme,
    `<div class="onboarding-screen">
      ${header("Your money stays yours", "Private by default", "", "preferences")}
      <div class="onboarding-art" style="min-height:180px;margin-bottom:20px"><div class="onboarding-logo" style="width:125px;height:125px">${icon("shield_lock")}</div></div>
      <div class="privacy-banner">${icon("smartphone")}<div><strong>Works without an account</strong><p>Your data starts on this device. Manual entry and standard voice parsing remain available offline.</p></div></div>
      <div class="privacy-banner">${icon("cloud_sync")}<div><strong>Backup is optional</strong><p>Sign in only if you want cloud backup and synchronization across devices.</p></div></div>
      <div class="privacy-banner">${icon("mic_off")}<div><strong>Audio is never retained</strong><p>The microphone starts only when you tap it. WalletWise stores no audio recordings.</p></div></div>
      <div class="onboarding-actions">
        <button class="primary-button" type="button" data-go="home">Continue without an account</button>
        <button class="secondary-button" type="button" data-go="backup">Sign in for backup</button>
        <div class="page-dots"><i></i><i></i><i class="is-active"></i></div>
      </div>
    </div>`,
    { noTabs: true },
  );
}

function home(theme) {
  return phone(
    theme,
    `${header("Good morning, Ahmed", "Here’s your September snapshot", '<button class="avatar-button" type="button" data-go="settings">AM</button>')}
      <div class="hero-card">
        <span class="card-label">Available after planned spending</span>
        <div class="hero-amount">${money("84,250")}</div>
        <div class="hero-metrics">
          <div class="hero-metric"><span>Spent this month</span><strong>${money("45,750")}</strong></div>
          <div class="hero-metric"><span>Income this month</span><strong class="positive">${money("120,000")}</strong></div>
        </div>
      </div>
      <div class="section-heading"><h3>Quick actions</h3></div>
      <div class="quick-grid">
        <button class="quick-card" type="button" data-go="voice-listening">${icon("mic")}<strong>Speak expense</strong></button>
        <button class="quick-card" type="button" data-go="add">${icon("add_card")}<strong>Add manually</strong></button>
        <button class="quick-card" type="button" data-go="split-type">${icon("group_add")}<strong>New split</strong></button>
      </div>
      <div class="section-heading"><h3>Spending by category</h3><button type="button" data-go="transactions">View all</button></div>
      <div class="category-chart">
        <div class="donut"><strong>${money("45.7K")}</strong></div>
        <div class="legend">
          <div class="legend-row"><i style="background:var(--ww-primary)"></i><span>Food</span><strong>38%</strong></div>
          <div class="legend-row"><i style="background:#66a3ff"></i><span>Household</span><strong>25%</strong></div>
          <div class="legend-row"><i style="background:#f4b860"></i><span>Transport</span><strong>18%</strong></div>
          <div class="legend-row"><i style="background:#ff7b72"></i><span>Other</span><strong>19%</strong></div>
        </div>
      </div>
      <div class="section-heading"><h3>Recent activity</h3><button type="button" data-go="transactions">See all</button></div>
      <div class="transaction-list">
        ${transactionRow("restaurant", "Lunch at Arcadian", "Food · Today, 1:20 PM", "− PKR 1,850", "negative", "Voice")}
        ${transactionRow("local_gas_station", "Shell", "Fuel · Yesterday", "− PKR 6,000")}
        ${transactionRow("payments", "Monthly salary", "Bank · Sep 1", "+ PKR 120,000", "positive")}
      </div>`,
    { activeTab: "home" },
  );
}

function transactionsBody() {
  return `${header("Transactions", "Every entry, in one place", `<button class="phone-action" type="button" data-go="filters" aria-label="Filters">${icon("tune")}</button>`)}
    ${monthPicker()}
    <div class="search-bar">${icon("search")}<span>Search merchant, note, or category</span></div>
    <div class="filter-chips"><button class="chip is-active">All</button><button class="chip">Expense</button><button class="chip">Income</button><button class="chip">Food</button></div>
    <div class="summary-line"><span>Net activity</span><strong class="positive">+ ${money("74,250")}</strong></div>
    <div class="date-label">Today · PKR 3,100 spent</div>
    <div class="transaction-list">
      ${transactionRow("restaurant", "Lunch at Arcadian", "Food · Household budget", "− PKR 1,850", "negative", "Voice")}
      ${transactionRow("shopping_basket", "Metro groceries", "Groceries · Household budget", "− PKR 1,250")}
    </div>
    <div class="date-label">Yesterday · PKR 6,000 spent</div>
    <div class="transaction-list">
      ${transactionRow("local_gas_station", "Shell", "Fuel · Fuel budget", "− PKR 6,000")}
      ${transactionRow("payments", "Monthly salary", "Bank · Income", "+ PKR 120,000", "positive")}
    </div>
    <button class="secondary-button" type="button">${icon("download")} Export this month as CSV</button>`;
}

function transactions(theme) {
  return phone(theme, transactionsBody(), { activeTab: "transactions" });
}

function filters(theme) {
  return phone(
    theme,
    `${transactionsBody()}
      <div class="sheet-overlay">
        <div class="bottom-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-title-row"><h3>Filter transactions</h3><button class="text-button" type="button">Reset</button></div>
          <div class="field-grid">
            ${field("Date range", "Sep 1 – Sep 30")}
            ${field("Transaction type", "All types")}
            ${field("Category", "All categories")}
            ${field("Account", "All accounts")}
            ${field("Budget", "Any budget assignment")}
          </div>
          <button class="primary-button" type="button" data-go="transactions">Show 24 transactions</button>
        </div>
      </div>`,
    { activeTab: "transactions" },
  );
}

function transactionForm(isEdit = false) {
  return `${header(isEdit ? "Edit transaction" : "Add transaction", isEdit ? "Update or remove this entry" : "Save an expense in seconds", "", isEdit ? "transactions" : "home")}
    <div class="type-toggle"><button class="is-active">Expense</button><button>Income</button></div>
    <div style="height:10px"></div>
    <div class="amount-input"><span>PKR</span><strong>${isEdit ? "1,850" : "2,500"}</strong></div>
    <div style="height:12px"></div>
    <div class="field-grid two">
      ${field("Category", isEdit ? "Food" : "Groceries", "restaurant")}
      ${field("Account", isEdit ? "Bank" : "Cash", "account_balance_wallet")}
    </div>
    <div style="height:10px"></div>
    ${field("Budget", isEdit ? "Household · Explicit" : "Automatic match", "donut_large")}
    <p class="phone-subtitle" style="margin:5px 2px 11px">Automatic counts this expense only if an active budget has the same name as its transaction category. One expense can affect one budget maximum.</p>
    <div class="field-grid">
      ${field("Merchant", isEdit ? "Arcadian Café" : "Metro")}
      <div class="field-grid two">
        ${field("Date", isEdit ? "Sep 22, 2026" : "Today", "calendar_today")}
        ${field("Time", isEdit ? "1:20 PM" : "9:41 AM", "schedule")}
      </div>
      ${field("Note", isEdit ? "Team lunch" : "Weekly groceries", "", "large")}
    </div>
    <button class="primary-button" type="button" data-toast="${isEdit ? "Changes saved" : "Transaction saved and form cleared"}" data-go="transactions">${isEdit ? "Save changes" : "Save transaction"}</button>
    ${isEdit ? '<button class="danger-button" type="button" data-toast="Transaction moved to Recently deleted">' + icon("delete") + " Delete transaction</button>" : ""}`;
}

function add(theme) {
  return phone(theme, transactionForm(false), { activeTab: "add", noTabs: true });
}

function edit(theme) {
  return phone(theme, transactionForm(true), { noTabs: true });
}

function voiceListening(theme) {
  return phone(
    theme,
    `<div class="voice-screen">
      <button class="back-button" type="button" data-go="home" aria-label="Cancel">${icon("close")}</button>
      <div class="voice-orb-wrap"><i class="voice-ring"></i><i class="voice-ring"></i><i class="voice-ring"></i><div class="voice-orb">${icon("mic")}</div></div>
      <h2>Listening…</h2>
      <p>Speak naturally. Pause when you’re finished and WalletWise will stop automatically.</p>
      <div class="waveform">${[
        [9, "0ms"], [18, "-180ms"], [13, "-410ms"], [26, "-80ms"], [20, "-520ms"], [11, "-260ms"], [23, "-630ms"], [15, "-330ms"],
      ].map(([height, delay]) => `<i style="--h:${height}px;--d:${delay}"></i>`).join("")}</div>
      <div class="live-transcript">“I spent 2,500 rupees on groceries at Metro today in the Household budget…”</div>
      <div class="button-row" style="width:100%;margin-top:auto"><button class="secondary-button" type="button" data-go="home">Cancel</button><button class="primary-button" type="button" data-go="voice-review">${icon("stop_circle")} Stop</button></div>
    </div>`,
    { noTabs: true },
  );
}

function voiceClarification(theme) {
  return phone(
    theme,
    `${header("One detail needed", "We kept your transcript safe", "", "voice-listening")}
      <div class="live-transcript" style="margin-top:0">“Paid 600 for fuel yesterday from cash.”</div>
      <div class="confidence-banner" style="margin-top:12px">${icon("help")}<div><strong>Which currency was this?</strong><p>The amount and other details were recognized with high confidence.</p></div></div>
      <div class="section-heading"><h3>Select currency</h3></div>
      <div class="radio-list">
        <div class="radio-row is-active"><span class="radio-dot"></span><span class="list-copy"><strong>PKR</strong><span>Pakistani Rupee · Your default</span></span>${icon("check")}</div>
        <div class="radio-row"><span class="radio-dot"></span><span class="list-copy"><strong>USD</strong><span>United States Dollar</span></span></div>
        <div class="radio-row"><span class="radio-dot"></span><span class="list-copy"><strong>AED</strong><span>UAE Dirham</span></span></div>
      </div>
      <button class="primary-button" type="button" data-go="voice-review">Continue to review</button>
      <button class="secondary-button" type="button" data-go="add">Fill everything manually</button>`,
    { noTabs: true },
  );
}

function voiceReview(theme) {
  return phone(
    theme,
    `${header("Review before saving", "Voice created · 1 transaction", "", "voice-listening")}
      <div class="info-banner">${icon("verified_user")}<div><strong>Nothing has been saved yet</strong><p>Check the details below and confirm when they look right.</p></div></div>
      <div class="type-toggle"><button class="is-active">Expense</button><button>Income</button></div>
      <div style="height:9px"></div>
      <div class="amount-input" style="min-height:65px"><span>PKR</span><strong>2,500</strong></div>
      <div style="height:10px"></div>
      <div class="field-grid two">
        ${field("Category · 96%", "Groceries", "shopping_basket")}
        ${field("Account · 91%", "Cash", "payments")}
      </div>
      <div style="height:9px"></div>
      ${field("Budget · Spoken", "Household · Explicit", "donut_large")}
      <div style="height:9px"></div>
      ${field("Merchant · 93%", "Metro")}
      <div style="height:9px"></div>
      <div class="field-grid two">${field("Date", "Today", "calendar_today")}${field("Time", "9:41 AM", "schedule")}</div>
      <div style="height:9px"></div>
      ${field("Note", "Voice entry", "", "large")}
      <button class="primary-button" type="button" data-go="transactions" data-toast="Voice transaction saved">Confirm and save</button>
      <button class="secondary-button" type="button" data-go="voice-listening">Start over</button>`,
    { noTabs: true },
  );
}

function budgets(theme) {
  return phone(
    theme,
    `${header("Budgets", "Plan this month with confidence", `<button class="phone-action" type="button" data-go="budget-editor" aria-label="Create budget">${icon("add")}</button>`)}
      ${monthPicker()}
      <div class="hero-card">
        <span class="card-label">Overall monthly budget</span>
        <div class="hero-amount">${money("54,250")} <span style="font-size:9px;color:var(--ww-muted)">left</span></div>
        <div class="progress-track" style="--progress:45.75%"><i></i></div>
        <div class="hero-metrics" style="margin-top:11px">
          <div class="hero-metric"><span>Spent</span><strong>${money("45,750")}</strong></div>
          <div class="hero-metric"><span>Limit</span><strong>${money("100,000")}</strong></div>
        </div>
      </div>
      <div class="section-heading"><h3>Category budgets</h3><button type="button" data-go="budget-categories">Manage</button></div>
      ${progressCard("home", "Household", 28750, 40000, 72, "warning-progress", "Food, Groceries + 2 more")}
      ${progressCard("local_gas_station", "Fuel", 6000, 15000, 40, "", "Automatic same-name match")}
      ${progressCard("shopping_bag", "Shopping", 8800, 10000, 88, "danger-progress", "Automatic same-name match")}
      ${progressCard("flight", "Travel", 0, 25000, 0, "", "No spending yet")}`,
    { activeTab: "budgets" },
  );
}

function budgetEditor(theme) {
  return phone(
    theme,
    `${header("Create budget", "For the month you’re viewing", "", "budgets")}
      <div class="type-toggle"><button>Overall</button><button class="is-active">Category</button></div>
      <div style="height:13px"></div>
      ${field("Budget category", "Household", "home")}
      <div style="height:10px"></div>
      <div class="amount-input"><span>PKR</span><strong>40,000</strong></div>
      <div style="height:10px"></div>
      ${field("Budget month", "September 2026", "calendar_month")}
      <div class="info-banner" style="margin-top:12px">${icon("rule")}<div><strong>How matching works</strong><p>An expense can count against one budget maximum. Choose Household explicitly, or let same-name categories match automatically.</p></div></div>
      <div class="section-heading"><h3>Preview</h3></div>
      ${progressCard("home", "Household", 28750, 40000, 72, "warning-progress", "Food, Groceries + 2 more")}
      <button class="primary-button" type="button" data-go="budgets" data-toast="Household budget created">Create budget</button>`,
    { noTabs: true },
  );
}

function budgetDetail(theme) {
  return phone(
    theme,
    `${header("Household", "September 2026", `<button class="phone-action" type="button" data-go="budget-editor" aria-label="Edit budget">${icon("edit")}</button>`, "budgets")}
      <div class="hero-card">
        <span class="card-label">Remaining</span>
        <div class="hero-amount">${money("11,250")}</div>
        <div class="progress-track warning-progress" style="--progress:72%"><i></i></div>
        <div class="hero-metrics" style="margin-top:11px">
          <div class="hero-metric"><span>Spent</span><strong>${money("28,750")}</strong></div>
          <div class="hero-metric"><span>Budget</span><strong>${money("40,000")}</strong></div>
        </div>
      </div>
      <div class="info-banner" style="margin-top:12px">${icon("link")}<div><strong>4 transaction categories included</strong><p>Food, Groceries, Bills, and Home. Explicit assignments take priority over automatic matches.</p></div></div>
      <div class="section-heading"><h3>Transactions in this budget</h3><button type="button">Filter</button></div>
      <div class="transaction-list">
        ${transactionRow("shopping_basket", "Metro groceries", "Groceries · Explicit", "− PKR 12,500", "negative", "Voice")}
        ${transactionRow("restaurant", "Lunch at Arcadian", "Food · Explicit", "− PKR 1,850")}
        ${transactionRow("receipt_long", "Electricity bill", "Bills · Explicit", "− PKR 9,400")}
        ${transactionRow("cleaning_services", "Home supplies", "Home · Explicit", "− PKR 5,000")}
      </div>`,
    { noTabs: true },
  );
}

function splits(theme) {
  return phone(
    theme,
    `${header("Splits", "Shared money, kept separate", `<button class="phone-action" type="button" data-go="split-type" aria-label="New split">${icon("add")}</button>`)}
      <div class="balance-hero">
        <span class="card-label">Your overall balance</span>
        <div class="balance-total"><strong class="positive">+ ${money("8,450")}</strong><span>3 friends</span></div>
        <div class="balance-columns">
          <div class="balance-column"><span>You are owed</span><strong class="positive">${money("15,200")}</strong></div>
          <div class="balance-column"><span>You owe</span><strong class="negative">${money("6,750")}</strong></div>
        </div>
      </div>
      <div class="info-banner" style="margin-top:12px">${icon("shield")}<div><strong>Separate from your tracker</strong><p>Splits and loans do not change your transactions, account balances, spending totals, or budgets.</p></div></div>
      <div class="section-heading"><h3>Friends</h3><button type="button">Add friend</button></div>
      <div class="transaction-list">
        <button class="friend-row" type="button" data-go="friend" style="width:100%;text-align:left"><span class="friend-avatar">SA</span><span class="list-copy"><strong>Sarah Ahmed</strong><span>3 open expenses</span></span><span class="friend-balance"><strong class="positive">+ PKR 9,200</strong><span>owes you</span></span></button>
        <button class="friend-row" type="button" data-go="friend" style="width:100%;text-align:left"><span class="friend-avatar">HK</span><span class="list-copy"><strong>Hassan Khan</strong><span>1 open loan</span></span><span class="friend-balance"><strong class="negative">− PKR 4,500</strong><span>you owe</span></span></button>
        <button class="friend-row" type="button" data-go="friend" style="width:100%;text-align:left"><span class="friend-avatar">MK</span><span class="list-copy"><strong>Mariam Khan</strong><span>2 open expenses</span></span><span class="friend-balance"><strong class="positive">+ PKR 3,750</strong><span>owes you</span></span></button>
      </div>
      <div class="section-heading"><h3>Recent split activity</h3><button type="button">View all</button></div>
      <div class="transaction-list">${transactionRow("restaurant", "Dinner at Café Aylanto", "You paid · 4 people", "+ PKR 6,750", "positive")}${transactionRow("handshake", "Loan from Hassan", "You borrowed", "− PKR 4,500")}</div>`,
    { activeTab: "splits" },
  );
}

function splitType(theme) {
  return phone(
    theme,
    `${header("What are you adding?", "This won’t affect your budgets", "", "splits")}
      <div class="split-choice-grid" style="margin-top:16px">
        <button class="split-choice" type="button" data-go="equal-split">${icon("group")}<strong>Split an expense</strong><span>Share one bill equally or with custom amounts.</span></button>
        <button class="split-choice" type="button" data-go="loan">${icon("handshake")}<strong>Record a loan</strong><span>Track money borrowed or lent directly.</span></button>
      </div>
      <div class="section-heading"><h3>How it works</h3></div>
      <div class="timeline">
        <div class="timeline-row"><span class="timeline-dot">${icon("edit")}</span><div class="timeline-copy"><strong>Add the details</strong><p>Choose friends, record the total, and say who paid.</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("calculate")}</span><div class="timeline-copy"><strong>WalletWise calculates shares</strong><p>Equal splits are automatic; custom shares remain available.</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("done_all")}</span><div class="timeline-copy"><strong>Settle when ready</strong><p>Balances update without touching personal spending data.</p></div></div>
      </div>`,
    { noTabs: true },
  );
}

function equalSplit(theme) {
  return phone(
    theme,
    `${header("Split an expense", "Equal split · 4 people", "", "split-type")}
      <div class="amount-input"><span>PKR</span><strong>18,000</strong></div>
      <div style="height:10px"></div>
      ${field("Description", "Dinner at Café Aylanto")}
      <div style="height:10px"></div>
      ${field("Paid by", "You paid the full amount", "account_balance_wallet")}
      <div class="section-heading"><h3>Split equally</h3><button type="button">Use custom amounts</button></div>
      <div class="settings-card" style="padding:0 10px">
        <div class="participant-row"><span class="friend-avatar">YO</span><span><strong>You</strong><span>Paid PKR 18,000</span></span><span class="share-pill">PKR 4,500</span></div>
        <div class="participant-row"><span class="friend-avatar">SA</span><span><strong>Sarah</strong><span>Owes you</span></span><span class="share-pill">PKR 4,500</span></div>
        <div class="participant-row"><span class="friend-avatar">MK</span><span><strong>Mariam</strong><span>Owes you</span></span><span class="share-pill">PKR 4,500</span></div>
        <div class="participant-row"><span class="friend-avatar">HK</span><span><strong>Hassan</strong><span>Owes you</span></span><span class="share-pill">PKR 4,500</span></div>
      </div>
      <button class="secondary-button" type="button">${icon("person_add")} Add another person</button>
      <button class="primary-button" type="button" data-go="split-detail" data-toast="Split saved separately from your tracker">Save split</button>`,
    { noTabs: true },
  );
}

function loan(theme) {
  return phone(
    theme,
    `${header("Record a loan", "Track money lent or borrowed", "", "split-type")}
      <div class="type-toggle"><button class="is-active">I lent money</button><button>I borrowed</button></div>
      <div style="height:12px"></div>
      <div class="amount-input"><span>PKR</span><strong>10,000</strong></div>
      <div style="height:10px"></div>
      ${field("Person", "Sarah Ahmed", "person")}
      <div style="height:10px"></div>
      <div class="field-grid two">${field("Date", "Today", "calendar_today")}${field("Due date", "No due date", "event")}</div>
      <div style="height:10px"></div>
      ${field("Reason or note", "Short-term personal loan", "", "large")}
      <div class="info-banner" style="margin-top:12px">${icon("visibility_off")}<div><strong>Not a spending transaction</strong><p>This loan changes only your balance with Sarah. It will not appear in expenses, income, accounts, or budgets.</p></div></div>
      <button class="primary-button" type="button" data-go="friend" data-toast="Loan saved">Save loan</button>`,
    { noTabs: true },
  );
}

function friend(theme) {
  return phone(
    theme,
    `${header("Sarah Ahmed", "Friend balance", `<button class="phone-action" type="button" aria-label="More options">${icon("more_horiz")}</button>`, "splits")}
      <div class="profile-card">
        <span class="profile-avatar">SA</span>
        <span><strong>Sarah owes you</strong><span class="positive" style="font-size:14px;margin-top:5px">${money("9,200")}</span></span>
        ${icon("person")}
      </div>
      <div class="button-row"><button class="secondary-button" type="button" data-go="split-type">Add expense</button><button class="primary-button" type="button" data-go="settle">Settle up</button></div>
      <div class="section-heading"><h3>Balance history</h3><button type="button">All activity</button></div>
      <div class="timeline">
        <div class="timeline-row"><span class="timeline-dot">${icon("restaurant")}</span><div class="timeline-copy"><strong>Dinner at Café Aylanto</strong><p>Sarah owes you PKR 4,500 · Sep 20</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("flight")}</span><div class="timeline-copy"><strong>Weekend road trip</strong><p>Sarah owes you PKR 6,700 · Sep 12</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("done_all")}</span><div class="timeline-copy"><strong>Cash settlement</strong><p>Sarah paid you PKR 2,000 · Sep 8</p></div></div>
      </div>
      <div class="section-heading"><h3>Reminder</h3></div>
      <div class="info-banner">${icon("notifications")}<div><strong>Send a friendly reminder</strong><p>WalletWise will prepare a summary. Nothing is sent without your approval.</p></div></div>
      <button class="secondary-button" type="button" data-toast="Reminder copied to clipboard">${icon("content_copy")} Copy balance reminder</button>`,
    { noTabs: true },
  );
}

function splitDetail(theme) {
  return phone(
    theme,
    `${header("Dinner at Café Aylanto", "Sep 20 · Equal split", `<button class="phone-action" type="button">${icon("edit")}</button>`, "splits")}
      <div class="balance-hero">
        <span class="card-label">Total bill</span>
        <div class="balance-total"><strong>${money("18,000")}</strong><span>You paid</span></div>
        <div class="avatar-stack" style="margin-top:16px"><span class="mini-avatar">YO</span><span class="mini-avatar">SA</span><span class="mini-avatar">MK</span><span class="mini-avatar">HK</span></div>
      </div>
      <div class="section-heading"><h3>Who owes what</h3></div>
      <div class="settings-card" style="padding:0 10px">
        <div class="participant-row"><span class="friend-avatar">YO</span><span><strong>You</strong><span>Your share</span></span><span class="share-pill positive">Paid</span></div>
        <div class="participant-row"><span class="friend-avatar">SA</span><span><strong>Sarah</strong><span>Not settled</span></span><span class="share-pill">PKR 4,500</span></div>
        <div class="participant-row"><span class="friend-avatar">MK</span><span><strong>Mariam</strong><span>Not settled</span></span><span class="share-pill">PKR 4,500</span></div>
        <div class="participant-row"><span class="friend-avatar">HK</span><span><strong>Hassan</strong><span>Not settled</span></span><span class="share-pill">PKR 4,500</span></div>
      </div>
      <div class="section-heading"><h3>Details</h3></div>
      <div class="settings-card">
        <div class="setting-row"><span class="list-icon">${icon("notes")}</span><span class="list-copy"><strong>Team dinner after work</strong><span>Note</span></span></div>
        <div class="setting-row"><span class="list-icon">${icon("lock")}</span><span class="list-copy"><strong>Splits only</strong><span>Not included in tracking or budgets</span></span>${icon("check_circle")}</div>
      </div>
      <button class="primary-button" type="button" data-go="settle">Record a settlement</button>`,
    { noTabs: true },
  );
}

function settle(theme) {
  return phone(
    theme,
    `${header("Settle up", "Update a friend balance", "", "friend")}
      ${field("Settling with", "Sarah Ahmed", "person")}
      <div style="height:10px"></div>
      <div class="type-toggle"><button class="is-active">Sarah paid me</button><button>I paid Sarah</button></div>
      <div style="height:12px"></div>
      <div class="amount-input"><span>PKR</span><strong>9,200</strong></div>
      <div style="height:10px"></div>
      <div class="field-grid two">${field("Date", "Today", "calendar_today")}${field("Method", "Bank transfer", "account_balance")}</div>
      <div style="height:10px"></div>
      ${field("Note", "Full balance settled", "", "large")}
      <div class="stat-grid" style="margin-top:13px">
        <div class="stat-card"><span>Current balance</span><strong class="positive">+ ${money("9,200")}</strong></div>
        <div class="stat-card"><span>After settlement</span><strong>${money("0")}</strong></div>
      </div>
      <div class="info-banner" style="margin-top:12px">${icon("info")}<div><strong>Only the split ledger changes</strong><p>This settlement will not be added as income or modify an account balance.</p></div></div>
      <button class="primary-button" type="button" data-go="friend" data-toast="Sarah’s balance is now settled">Confirm settlement</button>`,
    { noTabs: true },
  );
}

function settings(theme) {
  const row = (glyph, title, subtitle, target = "", trailing = "chevron_right") =>
    `<button class="setting-row" type="button" ${target ? `data-go="${target}"` : ""} style="width:100%;text-align:left"><span class="list-icon">${icon(glyph)}</span><span class="list-copy"><strong>${title}</strong><span>${subtitle}</span></span>${icon(trailing)}</button>`;
  return phone(
    theme,
    `${header("Settings", "Control your data and experience", "", "home")}
      <div class="profile-card"><span class="profile-avatar">AM</span><span><strong>Local profile</strong><span>Using WalletWise without an account</span><span class="sync-badge">${icon("smartphone")} On this device only</span></span>${icon("chevron_right")}</div>
      <div class="settings-section"><span>Backup & sync</span><div class="settings-card">${row("cloud_sync", "Google & cloud backup", "Signed out · Local data is safe", "backup")}${row("sync", "Sync status", "Not enabled", "")}</div></div>
      <div class="settings-section"><span>Organize</span><div class="settings-card">${row("category", "Transaction categories", "14 active categories", "categories")}${row("folder_special", "Budget categories", "6 active groups", "budget-categories")}${row("account_balance_wallet", "Accounts", "Cash, Bank", "")}</div></div>
      <div class="settings-section"><span>Preferences</span><div class="settings-card">${row("payments", "Currency", "PKR", "")}${row("language", "Locale & timezone", "English · Asia/Karachi", "")}${row("dark_mode", "Appearance", "System", "")}</div></div>
      <div class="settings-section"><span>Privacy & data</span><div class="settings-card">${row("psychology", "Cloud AI", "Disabled", "", "toggle_off")}${row("download", "Export data", "CSV", "")}${row("delete_forever", "Reset local data", "Requires confirmation", "")}</div></div>`,
    { noTabs: true },
  );
}

function backup(theme) {
  return phone(
    theme,
    `${header("Backup & sync", "Optional, private, and reversible", "", "settings")}
      <div class="onboarding-art" style="min-height:160px;margin:0 0 16px"><div class="onboarding-logo" style="width:112px;height:112px">${icon("cloud_done")}</div></div>
      <h3 style="margin:0;font-size:16px;letter-spacing:-.03em">Keep your WalletWise data safe</h3>
      <p class="phone-subtitle" style="font-size:9px;margin-top:7px">Sign in with Google to back up encrypted records and keep multiple devices in sync. Local-first mode stays fully usable.</p>
      <button class="google-button" type="button" data-toast="Google sign-in would open here"><span class="google-mark">G</span> Continue with Google</button>
      <div class="section-heading"><h3>What gets synchronized</h3></div>
      <div class="timeline">
        <div class="timeline-row"><span class="timeline-dot">${icon("receipt_long")}</span><div class="timeline-copy"><strong>Transactions and accounts</strong><p>Latest valid update wins during an MVP conflict.</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("donut_large")}</span><div class="timeline-copy"><strong>Budgets and categories</strong><p>Soft deletions synchronize without creating duplicates.</p></div></div>
        <div class="timeline-row"><span class="timeline-dot">${icon("group")}</span><div class="timeline-copy"><strong>Standalone splits</strong><p>Stored separately from financial tracking records.</p></div></div>
      </div>
      <div class="privacy-banner">${icon("key")}<div><strong>Your private keys stay server-side</strong><p>The app uses a publishable Supabase key with row-level security. Gemini credentials never enter the mobile app.</p></div></div>
      <button class="secondary-button" type="button" data-go="home">Keep using local-only mode</button>`,
    { noTabs: true },
  );
}

const categoryIcons = [
  ["Food & drink", ["restaurant", "local_cafe", "lunch_dining", "bakery_dining", "local_bar", "ramen_dining", "icecream", "liquor", "nutrition", "fastfood", "brunch_dining", "dinner_dining", "emoji_food_beverage", "set_meal"]],
  ["Shopping & home", ["shopping_basket", "shopping_bag", "storefront", "checkroom", "devices", "chair", "bed", "kitchen", "cleaning_services", "home_repair_service", "yard", "pets", "redeem", "inventory_2"]],
  ["Travel & transport", ["directions_car", "local_gas_station", "commute", "train", "flight", "two_wheeler", "directions_bus", "local_taxi", "sailing", "hotel", "luggage", "map", "toll", "ev_station"]],
  ["Life & wellbeing", ["medical_services", "medication", "fitness_center", "spa", "school", "menu_book", "sports_esports", "movie", "music_note", "palette", "sports_soccer", "celebration", "child_care", "volunteer_activism"]],
  ["Money & services", ["receipt_long", "payments", "account_balance", "credit_card", "savings", "currency_exchange", "trending_up", "request_quote", "subscriptions", "wifi", "electric_bolt", "water_drop", "phone_iphone", "shield"]],
];

function categoryList(theme, isBudget = false) {
  const rows = isBudget
    ? [
        ["home", "Household", "Food, Groceries, Bills + 1 more"],
        ["restaurant", "Food", "Automatic same-name matching"],
        ["local_gas_station", "Fuel", "Automatic same-name matching"],
        ["shopping_bag", "Shopping", "Automatic same-name matching"],
        ["flight", "Travel", "Automatic same-name matching"],
        ["school", "Learning", "Education + Books"],
      ]
    : [
        ["restaurant", "Food", "Expense · Default"],
        ["shopping_basket", "Groceries", "Expense · Default"],
        ["directions_car", "Transport", "Expense · Default"],
        ["local_gas_station", "Fuel", "Expense · Default"],
        ["shopping_bag", "Shopping", "Expense · Default"],
        ["receipt_long", "Bills", "Expense · Default"],
        ["movie", "Entertainment", "Expense · Default"],
        ["medical_services", "Health", "Expense · Default"],
        ["payments", "Salary", "Income · Custom"],
      ];
  return phone(
    theme,
    `${header(isBudget ? "Budget categories" : "Transaction categories", isBudget ? "Separate from transaction categories" : "Used to classify money activity", `<button class="phone-action" type="button" data-go="${isBudget ? "budget-category-editor" : "category-editor"}" aria-label="Add category">${icon("add")}</button>`, "settings")}
      <div class="search-bar">${icon("search")}<span>Search categories</span></div>
      ${isBudget ? `<div class="info-banner">${icon("conversion_path")}<div><strong>Flexible by design</strong><p>Use same-name budgets for automatic matching, or group different expense categories into a custom budget such as Household.</p></div></div>` : ""}
      <div class="section-heading"><h3>${isBudget ? "Active budget groups" : "Active categories"}</h3><button type="button">Reorder</button></div>
      <div class="settings-card" style="padding:0 10px">${rows
        .map(
          ([glyph, title, subtitle]) => `<button class="category-row" type="button" data-go="${isBudget ? "budget-category-editor" : "category-editor"}" style="width:100%;text-align:left"><span class="list-icon">${icon(glyph)}</span><span><strong>${title}</strong><span>${subtitle}</span></span>${icon("chevron_right")}</button>`,
        )
        .join("")}</div>`,
    { noTabs: true },
  );
}

function categoryEditor(theme, isBudget = false) {
  return phone(
    theme,
    `${header(isBudget ? "New budget category" : "New category", isBudget ? "Create a flexible budget group" : "Make tracking feel like yours", "", isBudget ? "budget-categories" : "categories")}
      <div class="field-grid">
        ${field(isBudget ? "Budget category name" : "Category name", isBudget ? "Household" : "Dining out", "")}
        ${isBudget ? field("Default matching", "Explicit selection + optional same-name", "rule") : field("Transaction type", "Expense", "swap_vert")}
      </div>
      <div class="icon-picker-label">Choose a color</div>
      <div class="color-picker">${["#20d98b", "#66a3ff", "#f4b860", "#ff7b72", "#9a6bff", "#ff82b2", "#4fd1c5", "#b4dc7f", "#f59e5b"]
        .map((color, index) => `<button class="color-swatch ${index === 0 ? "is-active" : ""}" style="background:${color}" aria-label="Color option"></button>`)
        .join("")}</div>
      ${categoryIcons
        .map(
          ([group, icons]) => `<div class="icon-picker-label">${group}</div><div class="icon-picker">${icons
            .map(
              (glyph) => `<button class="icon-option ${state.selectedCategoryIcon === glyph ? "is-active" : ""}" type="button" data-category-icon="${glyph}" aria-label="Choose ${glyph} icon">${icon(glyph)}</button>`,
            )
            .join("")}</div>`,
        )
        .join("")}
      ${isBudget ? `<div class="icon-picker-label">Included transaction categories</div><div class="filter-chips" style="flex-wrap:wrap"><button class="chip is-active">Food ×</button><button class="chip is-active">Groceries ×</button><button class="chip is-active">Bills ×</button><button class="chip">+ Add category</button></div><p class="phone-subtitle">An explicitly assigned expense takes priority. Each expense can count toward one budget maximum.</p>` : ""}
      <button class="primary-button" type="button" data-go="${isBudget ? "budget-categories" : "categories"}" data-toast="${isBudget ? "Budget category" : "Transaction category"} saved">Save category</button>`,
    { noTabs: true },
  );
}

const renderers = {
  splash,
  welcome,
  preferences,
  privacy,
  home,
  transactions,
  filters,
  add,
  edit,
  "voice-listening": voiceListening,
  "voice-clarification": voiceClarification,
  "voice-review": voiceReview,
  budgets,
  "budget-editor": budgetEditor,
  "budget-detail": budgetDetail,
  splits,
  "split-type": splitType,
  "equal-split": equalSplit,
  loan,
  friend,
  "split-detail": splitDetail,
  settle,
  settings,
  backup,
  categories: (theme) => categoryList(theme, false),
  "category-editor": (theme) => categoryEditor(theme, false),
  "budget-categories": (theme) => categoryList(theme, true),
  "budget-category-editor": (theme) => categoryEditor(theme, true),
};

function renderNavigation(query = "") {
  const normalized = query.trim().toLowerCase();
  const nav = document.querySelector("#screen-nav");
  nav.innerHTML = screenGroups
    .map((group) => {
      const items = group.screens.filter(([, label]) => !normalized || label.toLowerCase().includes(normalized));
      if (!items.length) return "";
      return `<section class="nav-group"><h2>${group.label}</h2>${items
        .map(
          ([id, label, glyph]) => `<button class="screen-link ${state.screen === id ? "is-active" : ""}" type="button" data-screen="${id}">${icon(glyph)}<span>${label}</span></button>`,
        )
        .join("")}</section>`;
    })
    .join("");
}

function themePreview(theme) {
  const label = theme === "emerald" ? "Emerald direction" : "Purple direction";
  return `<div class="theme-preview"><span class="theme-caption"><span class="theme-dot ${theme}"></span>${label}</span>${renderers[state.screen](theme)}</div>`;
}

function renderPreview() {
  const [title, description] = screenMeta[state.screen];
  document.querySelector("#screen-title").textContent = title;
  document.querySelector("#screen-description").textContent = description;
  document.querySelector("#screen-count").textContent = `${allScreens.indexOf(state.screen) + 1} / ${allScreens.length}`;

  const themes = state.themeMode === "compare" ? ["emerald", "purple"] : [state.themeMode];
  document.querySelector("#preview-stage").innerHTML = themes.map(themePreview).join("");

  document.querySelectorAll("[data-theme-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeMode === state.themeMode);
  });

  const iconPath = state.themeMode === "purple" ? "../assets/walletwise-icon-purple-v1.png" : "../assets/walletwise-icon-emerald-v1.png";
  document.querySelector("#sidebar-icon").src = iconPath;
  renderNavigation(document.querySelector("#screen-search").value);
}

function setScreen(screen) {
  if (!renderers[screen]) return;
  state.screen = screen;
  renderPreview();
  const activeLink = document.querySelector(`.screen-link[data-screen="${screen}"]`);
  if (typeof activeLink?.scrollIntoView === "function") {
    activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function updateSavedPick() {
  const pick = localStorage.getItem("walletwise-design-pick");
  document.querySelector("#saved-pick").textContent = pick
    ? `${pick === "emerald" ? "Emerald" : "Purple"} selected on this browser`
    : "No theme selected yet";
  document.querySelectorAll("[data-pick]").forEach((button) => button.classList.toggle("is-picked", button.dataset.pick === pick));
}

document.addEventListener("click", (event) => {
  const screenButton = event.target.closest("[data-screen]");
  if (screenButton) {
    setScreen(screenButton.dataset.screen);
    return;
  }

  const themeButton = event.target.closest("[data-theme-mode]");
  if (themeButton) {
    state.themeMode = themeButton.dataset.themeMode;
    renderPreview();
    return;
  }

  const goButton = event.target.closest("[data-go]");
  if (goButton) {
    if (goButton.dataset.toast) showToast(goButton.dataset.toast);
    setScreen(goButton.dataset.go);
    return;
  }

  const monthButton = event.target.closest("[data-month]");
  if (monthButton) {
    state.monthOffset = Math.min(0, Math.max(-18, state.monthOffset + Number(monthButton.dataset.month)));
    renderPreview();
    return;
  }

  const iconButton = event.target.closest("[data-category-icon]");
  if (iconButton) {
    state.selectedCategoryIcon = iconButton.dataset.categoryIcon;
    renderPreview();
    showToast("Icon selected in both theme directions");
    return;
  }

  const pickButton = event.target.closest("[data-pick]");
  if (pickButton) {
    const pick = pickButton.dataset.pick;
    localStorage.setItem("walletwise-design-pick", pick);
    state.themeMode = pick;
    updateSavedPick();
    renderPreview();
    showToast(`${pick === "emerald" ? "Emerald" : "Purple"} saved as your preferred direction`);
    return;
  }

  const toastButton = event.target.closest("[data-toast]");
  if (toastButton) showToast(toastButton.dataset.toast);
});

document.querySelector("#screen-search").addEventListener("input", (event) => renderNavigation(event.target.value));

document.querySelector("#presentation-toggle").addEventListener("click", () => {
  document.body.classList.toggle("presentation");
  const active = document.body.classList.contains("presentation");
  document.querySelector("#presentation-toggle span").textContent = active ? "fullscreen_exit" : "fullscreen";
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
  const index = allScreens.indexOf(state.screen);
  if (event.key === "ArrowRight") setScreen(allScreens[(index + 1) % allScreens.length]);
  if (event.key === "ArrowLeft") setScreen(allScreens[(index - 1 + allScreens.length) % allScreens.length]);
  if (event.key.toLowerCase() === "e") {
    state.themeMode = "emerald";
    renderPreview();
  }
  if (event.key.toLowerCase() === "c") {
    state.themeMode = "compare";
    renderPreview();
  }
  if (event.key.toLowerCase() === "p") {
    state.themeMode = "purple";
    renderPreview();
  }
  if (event.key === "Escape" && document.body.classList.contains("presentation")) {
    document.body.classList.remove("presentation");
  }
});

updateSavedPick();
renderPreview();
