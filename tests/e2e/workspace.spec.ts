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
  await selectCardType(page, "Card type", type);
  await page
    .getByRole("button", { name: "Create card", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
async function selectChoice(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
}
async function selectCardType(page: Page, label: string, type: string) {
  const trainer = ["Item", "Supporter", "Stadium", "Pokemon Tool"].includes(
    type,
  );
  await selectChoice(
    page,
    label + " category",
    trainer ? "Trainer" : "Pokemon",
  );
  if (trainer) await selectChoice(page, label + " trainer type", type);
  else {
    await selectChoice(
      page,
      label + " stage",
      type.startsWith("Stage 1")
        ? "Stage1"
        : type.startsWith("Stage 2")
          ? "Stage2"
          : "Basic",
    );
    await selectChoice(
      page,
      label + " suffix",
      type.endsWith(" ex") ? "ex" : "None",
    );
  }
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
  await page.locator(".combo-search").getByRole("searchbox").press("Escape");
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
  await expect(page.getByLabel("Deck reference image")).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Generated deck overview")).toBeVisible();
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
  const search = page.getByRole("searchbox", {
    name: "Search card names",
    exact: true,
  });
  await search.fill("basic$");
  await expect(page.locator(".tracker-row")).toHaveCount(1);
  await expect(page.locator(".tracker-row")).toContainText("Test Basic");
  await search.fill("[");
  await expect(page.locator(".tracker-search [role=alert]")).toContainText(
    "Invalid regular expression",
  );
  await search.fill("no-such-card");
  await expect(
    page.getByText("No cards match your search.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear card search", exact: true })
    .click();
  await expect(page.locator(".tracker-row")).toHaveCount(3);
  const first = page.getByRole("button", { name: /Test Basic copy 1:/ });
  const second = page.getByRole("button", { name: /Test Basic copy 2:/ });
  await expect(first).toHaveAttribute("aria-label", /Available/);
  await first.click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Discard pile/,
  );
  await expect(second).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 2: Available/,
  );
  await first.click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Prizes/,
  );
  await page.getByRole("button", { name: "Reset game", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Prizes/,
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
  await first.click();
  await first.click();
  await second.click();
  await second.click();
  await page
    .getByRole("button", { name: "Add Match", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  await page.mouse.click(10, 10);
  await expect(page.getByRole("dialog", { name: "Add a match" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Your deck", exact: true }),
  ).toContainText("Deck Alpha");
  await expect(
    page.getByRole("button", { name: "Remove prize 1: Test Basic" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove prize 2: Test Basic" }),
  ).toBeVisible();
  await choose(page, "Opponent deck", "Deck Beta");
  await page
    .getByRole("button", { name: "Your prizes: 6", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opponent prizes: 3", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Your starter Pokémon", exact: true })
    .click();
  await expect(page.getByRole("option", { name: /Test Item/ })).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: /Test Evolution/ }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: /^Test Basic/ }).click();
  await choose(page, "Opponent starter Pokémon", "Test Basic");
  await expect(
    page.getByRole("button", { name: "Add prize: Test Basic", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Remove prize 2: Test Basic" })
    .click();
  await page.getByRole("button", { name: "Add prize: Test Basic" }).click();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Add prize: Test Item", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Add prize: Test Item", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Match saved!" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(first).toHaveAttribute(
    "aria-label",
    /^Test Basic copy 1: Prizes/,
  );
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(page.getByText("100.0%", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Match history", exact: true }),
  ).toBeVisible();
  const matchRow = page.locator(".match-row").first();
  await expect(matchRow).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".match-expanded-details")).toHaveCount(0);
  await matchRow.click();
  await expect(matchRow).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".match-expanded-details")).toContainText(
    "Opening prize cards",
  );
  await page.locator(".match-expanded-details .prize-avatar").first().click();
  await expect(page.locator(".card-inspection")).toBeVisible();
  await page.getByRole("dialog").last().press("Escape");
  await matchRow.press("Enter");
  await expect(matchRow).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Match options" }).first().click();
  await page.getByRole("menuitem", { name: "Edit match", exact: true }).click();
  await page
    .getByRole("button", { name: "Opponent prizes: 6", exact: true })
    .click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".match-row-draw")).toBeVisible();
  await expect(page.getByText("0.0%", { exact: true }).first()).toBeVisible();
  await choose(page, "Entries per page", "All");
  await expect(page.getByText("Showing 1–1 of 1 matches")).toBeVisible();
  await page.getByRole("button", { name: "Match options" }).first().click();
  await page
    .getByRole("menuitem", { name: "Delete match", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".match-row-draw")).toBeVisible();
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
  const deleteConfirmation = page.getByRole("dialog");
  await expect(
    deleteConfirmation.getByRole("button", { name: "Close dialog" }),
  ).toHaveCount(0);
  await page.route("**/decks", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    deleteConfirmation.getByRole("button", {
      name: "Please wait…",
      exact: true,
    }),
  ).toBeDisabled();
  await deleteConfirmation.press("Escape");
  await expect(deleteConfirmation).toBeVisible();
  await expect(
    deleteConfirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete Deck Alpha", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Stats", exact: true }).click();
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
  await selectCardType(page, "Card type", "Supporter");
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
  const alphaRow = page.locator(".stats-table > tbody > tr").filter({
    has: page.locator(".table-deck-name").filter({ hasText: "History Alpha" }),
  });
  const betaRow = page.locator(".stats-table > tbody > tr").filter({
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

test("imports a deck, creates missing cards and saves thirteen Energy copies", async ({
  page,
}) => {
  await page.route("**/api/deck-import", async (route) => {
    await route.fulfill({
      json: {
        cards: [
          {
            name: "Imported Ogerpon ex",
            category: "pokemon",
            quantity: 4,
            printings: [
              {
                quantity: 2,
                set_code: "TWM",
                collector_number: "025",
                set_id: "sv06",
                tcgdex_id: "sv06-025",
                set_name: "Twilight Masquerade",
                regulation_mark: "H",
                series_name: "Scarlet & Violet",
                image_url: "https://assets.tcgdex.net/en/sv/sv06/025/high.webp",
                resolved_type: "basic_ex",
              },
              {
                quantity: 2,
                set_code: "TWM",
                collector_number: "211",
                set_id: "sv06",
                tcgdex_id: "sv06-211",
                set_name: "Twilight Masquerade",
                regulation_mark: "H",
                image_url: "https://assets.tcgdex.net/en/sv/sv06/211/high.webp",
                resolved_type: "basic_ex",
              },
            ],
          },
          {
            name: "Imported Ultra Ball",
            category: "trainer",
            quantity: 4,
            printings: [
              { quantity: 4, set_code: "MEG", collector_number: "131" },
            ],
          },
          {
            name: "Imported Grass Energy",
            category: "energy",
            quantity: 13,
            printings: [
              {
                quantity: 13,
                set_code: "MEE",
                collector_number: "9",
                resolved_type: "energy",
              },
            ],
          },
        ],
        warnings: ["Could not resolve Imported Ultra Ball; identifiers kept."],
      },
    });
  });
  await page.route("https://assets.tcgdex.net/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="#d9e8c7"/><text x="20" y="150">Test card image</text></svg>',
    }),
  );
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await page.getByRole("button", { name: "Create deck", exact: true }).click();
  await page.getByLabel("Deck name", { exact: true }).fill("Imported deck");
  await page.getByText("Import deck from text", { exact: true }).click();
  await page
    .getByLabel("Paste your Pokémon TCG Live deck list")
    .fill(
      "Pokémon: 4\n4 Imported Ogerpon ex TWM 25\nTrainer: 4\n4 Imported Ultra Ball MEG 131\nEnergy: 13\n13 Imported Grass Energy MEE 9",
    );
  await page
    .getByRole("button", { name: "Import deck list", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("21 / 60 cards", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Add image for Imported Grass Energy MEE 9")
    .setInputFiles({
      name: "grass.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Enlarge Imported Grass Energy MEE 9" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create deck", exact: true })
    .last()
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText("Choose a type");
  await selectCardType(page, "Type for Imported Ogerpon ex", "Basic ex");
  await selectCardType(page, "Type for Imported Ultra Ball", "Item");
  await expect(
    page.getByLabel("Type for Imported Grass Energy energy type"),
  ).toContainText("Normal (Basic)");
  await page
    .getByRole("button", { name: "Create deck", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit deck", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Enlarge Imported Grass Energy MEE 9" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("21 / 60 cards", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("x13", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/notebook");
  await choose(page, "Active deck", "Imported deck");
  await expect(
    page.getByRole("button", { name: "Enlarge Imported Grass Energy MEE 9" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Imported Grass Energy copy 1: Available/ })
    .click();
  await page
    .getByRole("button", { name: /Imported Grass Energy copy 1: Discard pile/ })
    .click();
  const manualPrize = page.getByRole("button", {
    name: "Remove Imported Grass Energy copy 1 from Prizes",
  });
  await expect(manualPrize.getByRole("img")).toHaveAttribute("src", /cards/);
  await manualPrize.click();
  await expect(page.locator(".tracker-group-heading")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Enlarge Imported Ogerpon ex TWM 025" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enlarge Imported Ogerpon ex TWM 025" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: /Imported Ogerpon ex copy 1: Available/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: /Imported Ogerpon ex copy 1: Discard pile/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Imported Ogerpon ex copy 1: Discard pile/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Imported Ogerpon ex copy 1: Prizes/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full screen game mode" }).click();
  await expect(page.locator(".notebook-workspace")).toHaveClass(
    /notebook-game-mode/,
  );
  await expect(
    page.getByRole("button", { name: /Imported Ogerpon ex copy 1: Prizes/ }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Prize cards" })).toBeVisible();
  const columns = await page
    .locator(".tracker-list")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(10);
  await page.screenshot({ path: "test-results/notebook-game-mode.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".notebook-workspace")).not.toHaveClass(
    /notebook-game-mode/,
  );
  const prizePanel = page.getByRole("region", { name: "Prize cards" });
  const removePrize = prizePanel.getByRole("button", {
    name: "Remove Imported Ogerpon ex copy 1 from Prizes",
  });
  await expect(removePrize.getByRole("img")).toBeVisible();
  await expect(prizePanel.getByText("1 / 6 prizes")).toBeVisible();
  await page
    .getByRole("button", { name: /Imported Ogerpon ex copy 3: Available/ })
    .click();
  await page
    .getByRole("button", { name: /Imported Ogerpon ex copy 3: Discard pile/ })
    .click();
  const removeOtherArt = prizePanel.getByRole("button", {
    name: "Remove Imported Ogerpon ex copy 3 from Prizes",
  });
  await expect(removeOtherArt.getByRole("img")).toHaveAttribute(
    "src",
    /211\/low.webp/,
  );
  await expect(prizePanel.getByText("2 / 6 prizes")).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search card names" })
    .fill("Ultra Ball");
  await expect(page.locator(".tracker-list .tracker-row")).toHaveCount(1);
  await expect(removePrize).toBeVisible();
  await removePrize.click();
  await expect(removeOtherArt).toBeVisible();
  await expect(prizePanel.getByText("1 / 6 prizes")).toBeVisible();
  await removeOtherArt.click();
  await expect(
    prizePanel.getByText("No copies marked as Prizes yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear card search" }).click();
  await expect(
    page.getByRole("button", { name: /Imported Ogerpon ex copy 1: Available/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/tcgdex-tracker.png",
    fullPage: true,
  });
  await page.reload();
  await choose(page, "Active deck", "Imported deck");
  await expect(
    page.getByRole("button", { name: "Enlarge Imported Ogerpon ex TWM 025" }),
  ).toBeVisible();
  await page.goto("/decks");
  await page
    .getByRole("button", { name: "Delete Imported deck", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
import { readFileSync } from "node:fs";

test("combat log inference, perspective correction, full-screen save and board replay", async ({
  page,
  request,
}) => {
  const endpoint = "http://localhost:54329/rest/v1";
  const names = [
    "Applin",
    "Fezandipiti ex",
    "Poké Pad",
    "Hydrapple ex",
    "Bug Catching Set",
    "Forest of Vitality",
    "Meganium",
    "Basic {G} Energy",
  ];
  const types = [
    "basic",
    "basic_ex",
    "item",
    "stage_2_ex",
    "item",
    "stadium",
    "stage_2",
    "energy_basic",
  ];
  const ids: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const response = await request.post(`${endpoint}/cards`, {
      data: { name: names[i], type: types[i] },
      headers: { Accept: "application/vnd.pgrst.object+json" },
    });
    expect(response.ok()).toBeTruthy();
    ids.push((await response.json()).id);
  }
  const deckResponse = await request.post(`${endpoint}/rpc/save_deck`, {
    data: {
      payload: {
        name: "Combat fixture deck",
        notes: "",
        cards: ids.map((id, i) => ({
          card_id: id,
          quantity: i === 7 ? 13 : i === 4 ? 2 : 1,
          printings: [
            {
              quantity: i === 7 ? 13 : i === 4 ? 2 : 1,
              set_code: "TWM",
              collector_number: String(i + 1),
              image_url: `https://assets.tcgdex.net/en/sv/sv06/${i + 1}/high.webp`,
            },
          ],
        })),
      },
    },
  });
  expect(deckResponse.ok(), await deckResponse.text()).toBeTruthy();
  const deck = await deckResponse.json();
  await page.route("https://assets.tcgdex.net/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="#abd5b9"/><circle cx="122" cy="110" r="65" fill="#417b54"/></svg>',
    }),
  );
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await page.goto(`/notebook?deck=${deck}`);
  await page.getByRole("button", { name: "Full screen game mode" }).click();
  await page
    .getByRole("region", { name: "Prize cards" })
    .getByRole("button", { name: "Add Match" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add a match" });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(
    (raw) => navigator.clipboard.writeText(raw),
    readFileSync("tests/fixtures/combat-log.txt", "utf8"),
  );
  await expect(
    dialog.getByRole("combobox", { name: "Result", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Opponent deck name", { exact: true })
    .fill("Opponent Hydrapple");
  await dialog.getByRole("button", { name: "Import combat log" }).click();
  await expect(
    dialog.getByRole("button", { name: "Your player", exact: true }),
  ).toContainText("Ciberbrian");
  await expect(dialog.locator(".import-match-summary")).toContainText("WIN");
  await selectChoice(page, "Your player", "bastorz");
  await expect(dialog.locator(".import-match-summary")).toContainText("LOSS");
  await expect(dialog.locator(".import-match-summary")).toContainText(
    "2" + String.fromCharCode(8211) + "6 prizes taken",
  );
  await expect(dialog.locator(".import-match-summary")).toContainText(
    "Starter: Fezandipiti ex",
  );
  await expect(dialog.locator(".import-match-summary")).toContainText(
    "Starter: Applin",
  );
  await expect(
    dialog.getByLabel("Inferred opening prize cards").locator(".prize-avatar"),
  ).toHaveCount(6);
  await expect(
    dialog.getByRole("combobox", { name: "Prize 1", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".notebook-workspace")).toHaveClass(
    /notebook-game-mode/,
  );
  await page
    .getByRole("dialog", { name: "Match saved!" })
    .getByRole("button", { name: "Play again", exact: true })
    .click();
  await expect(page.locator(".notebook-workspace")).toHaveClass(
    /notebook-game-mode/,
  );
  await page.goto("/stats");
  await expect(
    page.getByText("Start first rate", { exact: true }),
  ).toBeVisible();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Combat fixture deck" })
    .first();
  await row.getByRole("button", { name: /Details/ }).click();
  await page.getByRole("button", { name: "Match options" }).first().click();
  await page.getByRole("menuitem", { name: "Review match" }).click();
  const replay = page.getByRole("dialog", { name: "Match replay" });
  await expect(replay).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Board replay", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/replay-cards", (route) =>
    route.fulfill({ json: { cards: [] } }),
  );
  await page.route("**/api/replay-image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="#abd5b9"/></svg>',
    }),
  );
  await page.getByLabel("Replay action", { exact: true }).fill("14");
  await expect(page.locator(".study-board")).toBeVisible();
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        replay.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".study-controls")
          .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/replay-${viewport.width}.png`,
    });
  }
  await page.getByRole("button", { name: "Switch replay color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: "test-results/replay-dark.png" });
  await page.getByRole("button", { name: "Switch replay color theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "View Ciberbrian discard pile" })
    .click();
  const pile = page.getByRole("dialog", { name: "Discard pile", exact: true });
  await expect(pile).toBeVisible();
  await expect(
    pile.getByRole("button", { name: "All", exact: true }),
  ).toBeVisible();
  await pile.getByRole("button", { name: "Trainers", exact: true }).click();
  await pile.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Table Top", exact: true }).click();
  const setup = page.getByRole("dialog", {
    name: "Prepare Table Top",
    exact: true,
  });
  await expect(setup).toBeVisible();
  await expect(
    setup.getByRole("button", { name: "Review card allocation" }),
  ).toBeDisabled();
  await setup
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(page.getByLabel("Replay action", { exact: true })).toBeEnabled();
  await page
    .getByRole("button", { name: "Save boardstate", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(/copied|ready/);
  await page.getByRole("button", { name: "Close replay", exact: true }).click();
});
