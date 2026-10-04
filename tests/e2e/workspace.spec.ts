import { test, expect, Page } from "@playwright/test";
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .getByRole("option")
    .filter({ has: page.getByText(option, { exact: true }) })
    .click();
}
async function createCard(page: Page, name: string, type: string) {
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  await page.getByLabel("Card name", { exact: true }).fill(name);
  await choose(page, "Card type", type);
  await page
    .getByRole("button", { name: "Create card", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
async function createDeck(page: Page, name: string, quantity: number) {
  await page.getByRole("button", { name: "Create deck", exact: true }).click();
  await page.getByLabel("Deck name", { exact: true }).fill(name);
  await choose(page, "Card", "Test Basic");
  await choose(page, "Copies to add", String(quantity));
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByLabel("Playstyle", { exact: true })
    .fill("A clear game plan.");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Remember your opening options.");
  await page
    .getByRole("button", { name: "Create deck", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name, exact: true }).first(),
  ).toBeVisible();
}
test("collection, regex, per-copy tracking, match forms, statistics and destructive dialogs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await expect(
    page.getByRole("heading", { name: "Your next great deck starts here" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Card library/ }).click();
  await createCard(page, "Test Basic", "Basic");
  await createCard(page, "Test Item", "Item");
  await createCard(page, "Test Evolution", "Stage 1");
  await page.getByRole("combobox", { name: "Find a card" }).click();
  await page.getByRole("searchbox").fill("[");
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Invalid regular expression",
  );
  await page.getByRole("searchbox").fill("Basic$");
  await expect(
    page.getByRole("option", { name: "Test Basic", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Test Item", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("searchbox").press("Escape");
  await page.getByRole("tab", { name: /My decks/ }).click();
  await createDeck(page, "Deck Alpha", 2);
  await page.getByRole("button", { name: "Edit deck", exact: true }).click();
  await choose(page, "Card", "Test Basic");
  await choose(page, "Copies to add", "3");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("1-4");
  await choose(page, "Card", "Test Item");
  await choose(page, "Copies to add", "4");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await choose(page, "Card", "Test Evolution");
  await choose(page, "Copies to add", "1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "deck.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open image of Deck Alpha", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await createDeck(page, "Deck Beta", 1);
  await page.getByRole("combobox", { name: "Find a deck" }).click();
  await page.getByRole("option", { name: "Deck Alpha", exact: true }).click();
  await page.getByRole("button", { name: "Edit deck", exact: true }).click();
  await choose(page, "Related variants", "Deck Beta");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Notebook", exact: true }).click();
  await choose(page, "Active deck", "Deck Alpha");
  await page.screenshot({
    path: "test-results/notebook-desktop.png",
    fullPage: true,
  });
  const first = page.getByRole("button", { name: /Test Basic copy 1:/ });
  const second = page.getByRole("button", { name: /Test Basic copy 2:/ });
  await expect(first).toHaveAttribute("aria-label", /Available/);
  await first.click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Prizes/,
  );
  await expect(second).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 2: Available/,
  );
  await first.click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Discard pile/,
  );
  await page.getByRole("button", { name: "Reset game", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Discard pile/,
  );
  await page.getByRole("button", { name: "Reset game", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset game", exact: true })
    .click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Available/,
  );
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every game tells you something" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Match", exact: true }).click();
  await choose(page, "Your deck", "Deck Alpha");
  await choose(page, "Opponent deck", "Deck Beta");
  await choose(page, "Result", "Win");
  await choose(page, "Your prizes taken", "6");
  await choose(page, "Opponent prizes taken", "3");
  await page
    .getByRole("combobox", { name: "Your starter Pokémon", exact: true })
    .click();
  await expect(page.getByRole("option", { name: /Test Item/ })).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: /Test Evolution/ }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: /^Test Basic/ }).click();
  await choose(page, "Opponent starter Pokémon", "Test Basic");
  await choose(page, "Prize 1", "Test Basic");
  await choose(page, "Prize 2", "Test Basic");
  await page.getByRole("combobox", { name: "Prize 3", exact: true }).click();
  await expect(
    page.getByRole("option", {
      name: "Test Basic 0 of 2 copies available",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("searchbox").press("Escape");
  for (let i = 3; i <= 6; i++) await choose(page, `Prize ${i}`, "Test Item");
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("100.0%", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Match history", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit match", exact: true }).click();
  await choose(page, "Result", "Draw");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".result-draw")).toHaveText("draw");
  await expect(page.getByText("0.0%", { exact: true }).first()).toBeVisible();
  await choose(page, "Entries per page", "All");
  await expect(page.getByText("Showing 1–1 of 1 matches")).toBeVisible();
  await page.getByRole("button", { name: "Delete match", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".result-draw")).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch color theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "Switch color theme", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Stats", exact: true }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/stats-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Deck Alpha", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "used by a deck or match",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Delete match", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every game tells you something" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("histories expand independently and paginate the newest games; card edits and deletion update the library", async ({
  page,
  request,
}) => {
  const endpoint = "http://localhost:54329/rest/v1";
  const cardResponse = await request.post(`${endpoint}/cards`, {
    data: { name: "History Basic", type: "basic" },
    headers: { Accept: "application/vnd.pgrst.object+json" },
  });
  expect(cardResponse.ok()).toBeTruthy();
  const card = await cardResponse.json();
  async function rpc(name: string, payload: Record<string, unknown>) {
    const response = await request.post(`${endpoint}/rpc/${name}`, {
      data: { payload },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const alpha = await rpc("save_deck", {
    name: "History Alpha",
    cards: [{ card_id: card.id, quantity: 1 }],
    variants: [],
  });
  const beta = await rpc("save_deck", {
    name: "History Beta",
    cards: [{ card_id: card.id, quantity: 1 }],
    variants: [],
  });
  const base = {
    deck_id: alpha,
    opponent_deck_id: beta,
    starter_id: card.id,
    opponent_starter_id: card.id,
    my_prizes: 6,
    opponent_prizes: 0,
    prizes: [],
    notes: "",
  };
  for (let i = 0; i < 25; i++)
    await rpc("save_match", {
      ...base,
      result: i < 5 ? "loss" : "win",
      played_at: new Date(Date.UTC(2026, 0, i + 1, 12)).toISOString(),
    });
  await rpc("save_match", {
    ...base,
    deck_id: beta,
    opponent_deck_id: alpha,
    result: "draw",
    played_at: "2026-02-01T12:00:00Z",
  });
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await page.getByRole("tab", { name: /Card library/ }).click();
  await createCard(page, "Editable card", "Item");
  await page
    .getByRole("button", { name: "Edit Editable card", exact: true })
    .click();
  await page.getByLabel("Card name", { exact: true }).fill("Edited card");
  await choose(page, "Card type", "Supporter");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Edited card", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Edited card", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByText("Edited card", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  const alphaRow = page
    .locator(".stats-table > tbody > tr")
    .filter({
      has: page
        .locator(".table-deck-name")
        .filter({ hasText: "History Alpha" }),
    });
  const betaRow = page
    .locator(".stats-table > tbody > tr")
    .filter({
      has: page.locator(".table-deck-name").filter({ hasText: "History Beta" }),
    });
  await expect(alphaRow).toContainText("80.0%");
  await expect(alphaRow).toContainText("100.0%");
  await alphaRow.getByRole("button", { name: "Details", exact: true }).click();
  await betaRow.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Match history", exact: true }),
  ).toHaveCount(2);
  const history = page.locator(`#history-${alpha}`);
  await expect(history.locator("tbody tr")).toHaveCount(10);
  await expect(history.locator("tbody tr").first()).toContainText(
    "25 Jan 2026",
  );
  await history.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(history.getByText("Showing 11–20 of 25 matches")).toBeVisible();
  await expect(history.locator("tbody tr").first()).toContainText(
    "15 Jan 2026",
  );
  await history
    .getByRole("combobox", { name: "Entries per page", exact: true })
    .click();
  await history.getByRole("option", { name: "All", exact: true }).click();
  await expect(history.locator("tbody tr")).toHaveCount(25);
  await expect(history.locator("tbody tr").last()).toContainText("1 Jan 2026");
  await expect(
    page.getByRole("heading", { name: "Match history", exact: true }),
  ).toHaveCount(2);
  await page.screenshot({
    path: "test-results/stats-expanded-desktop.png",
    fullPage: true,
  });
});
