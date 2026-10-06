import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test.afterEach(async ({ request }) => {
  const response = await request.get("http://localhost:54329/rest/v1/decks");
  for (const deck of await response.json())
    if (deck.name === "Paired personal fixture")
      await request.post("http://localhost:54329/rest/v1/rpc/delete_entity", {
        data: { entity: "deck", entity_id: deck.id },
      });
});

test("administrator catalogue publishing, anonymous paired replay and fixed hand perspectives", async ({
  page,
  browser,
}) => {
  await page.route("**/api/replay-cards", async (route) => {
    const { names } = route.request().postDataJSON();
    await route.fulfill({
      json: {
        cards: names.map((name: string) => ({
          name,
          image: "/card-back-classic.jpg",
          type: /Energy/.test(name)
            ? "energy_basic"
            : /Pad|Stamp|Orders|Gong|Set|Aid|Determination|Mountain|Vitality|Ball|Pro/.test(
                  name,
                )
              ? "item"
              : "basic",
        })),
      },
    });
  });
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await page.goto("/pro-tv");
  await page.getByRole("button", { name: "Add match", exact: true }).click();
  const form = page.getByRole("dialog", {
    name: "Add Pro TV match",
    exact: true,
  });
  await form
    .getByLabel("title", { exact: true })
    .fill("Paired analysis fixture");
  await form.getByLabel("player", { exact: true }).fill("Ciberbrian");
  await form.getByLabel("opponent", { exact: true }).fill("bastorz");
  await form.getByLabel("deck name", { exact: true }).fill("Mega Lucario");
  await form.getByLabel("opponent deck name", { exact: true }).fill("Ogerpon");
  await form
    .getByLabel("Combat log", { exact: true })
    .fill(readFileSync("tests/fixtures/paired-own.txt", "utf8"));
  await form
    .getByLabel("Complementary combat log (optional)", { exact: true })
    .fill(readFileSync("tests/fixtures/paired-opponent.txt", "utf8"));
  await form.getByLabel("Published", { exact: true }).check();
  await form.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page
    .getByRole("button", { name: "Watch Paired analysis fixture" })
    .click();
  const replay = page.getByRole("dialog", { name: "Match replay" });
  await expect(replay).toBeVisible();
  await page.getByLabel("Replay action", { exact: true }).fill("8");
  const own = page.locator(".study-bottom"),
    rival = page.locator(".study-top");
  await expect(
    own.locator(".study-hand .study-card-button").first(),
  ).toHaveAttribute("aria-label", "Premium Power Pro");
  await expect(
    rival.locator(".study-hand .study-card-button").first(),
  ).toHaveAttribute("aria-label", "Hidden card");
  const ownPosition = await own.boundingBox();
  await page
    .getByRole("button", { name: "Hand visibility: you", exact: true })
    .click();
  await expect(
    own.locator(".study-hand .study-card-button").first(),
  ).toHaveAttribute("aria-label", "Hidden card");
  await expect(
    rival.locator(".study-hand .study-card-button").first(),
  ).toHaveAttribute("aria-label", "Basic Grass Energy");
  await page
    .getByRole("button", { name: "Hand visibility: opponent", exact: true })
    .click();
  await expect(
    own.locator(".study-hand .study-card-button").first(),
  ).toHaveAttribute("aria-label", "Premium Power Pro");
  expect((await own.boundingBox())!.y).toBe(ownPosition!.y);
  await page.getByLabel("Replay action", { exact: true }).fill("70");
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(() =>
        replay.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      )
      .toBe(true);
    const prizes = await page.locator(".study-prizes").evaluateAll((nodes) =>
      nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    expect(prizes[0].bottom).toBeLessThanOrEqual(prizes[1].top);
    const cards = await own
      .locator(".study-hand .study-card")
      .evaluateAll((nodes) =>
        nodes.map((el) => el.getBoundingClientRect().top),
      );
    expect(new Set(cards).size).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/paired-replay-${size.width}.png`,
    });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Close replay", exact: true }).click();
  await page
    .getByRole("button", { name: "Launch catalogue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hide catalogue", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext();
  const anonymous = await context.newPage();
  await anonymous.route("**/api/replay-cards", (route) =>
    route.fulfill({ json: { cards: [] } }),
  );
  await anonymous.goto("http://localhost:3100/pro-tv");
  await expect(anonymous).toHaveURL(/\/pro-tv$/);
  await expect(
    anonymous.getByRole("button", { name: "Add match", exact: true }),
  ).toHaveCount(0);
  await anonymous
    .getByRole("button", { name: "Watch Paired analysis fixture" })
    .click();
  await expect(
    anonymous.getByRole("dialog", { name: "Match replay" }),
  ).toBeVisible();
  await context.close();
  await page
    .getByRole("button", { name: "Hide catalogue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Launch catalogue", exact: true }),
  ).toBeVisible();
});

test("personal complementary import rejects mismatches and persists a verified second perspective", async ({
  page,
  request,
}) => {
  const api = "http://localhost:54329/rest/v1";
  const card = await request.post(`${api}/cards`, {
    data: { name: "Solrock", type: "basic" },
    headers: { Accept: "application/vnd.pgrst.object+json" },
  });
  expect(card.ok()).toBeTruthy();
  const cardId = (await card.json()).id;
  const deck = await request.post(`${api}/rpc/save_deck`, {
    data: {
      payload: {
        name: "Paired personal fixture",
        notes: "",
        cards: [{ card_id: cardId, quantity: 1 }],
      },
    },
  });
  expect(deck.ok()).toBeTruthy();
  const deckId = await deck.json();
  const raw = readFileSync("tests/fixtures/paired-own.txt", "utf8"),
    secondary = readFileSync("tests/fixtures/paired-opponent.txt", "utf8");
  const saved = await request.post(`${api}/rpc/save_match`, {
    data: {
      payload: {
        deck_id: deckId,
        opponent_deck_id: null,
        opponent_starter_id: null,
        opponent_deck_name: "Ogerpon paired fixture",
        result: "loss",
        my_prizes: 1,
        opponent_prizes: 6,
        starter_id: cardId,
        played_at: new Date().toISOString(),
        notes: "",
        combat_log: raw,
        log_player: "Ciberbrian",
        prizes: [],
      },
    },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  const matchId = await saved.json();
  await page.route("**/api/replay-cards", (route) =>
    route.fulfill({ json: { cards: [] } }),
  );
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await page.goto("/stats");
  await page
    .getByRole("row")
    .filter({ hasText: "Paired personal fixture" })
    .getByRole("button", { name: /Details/ })
    .click();
  await page.getByRole("button", { name: "View combat log" }).click();
  await page.getByRole("button", { name: "Add complementary log" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Complementary combat log",
    exact: true,
  });
  await dialog
    .getByLabel("Complementary combat log", { exact: true })
    .fill(secondary.replace("for 240 damage", "for 999 damage"));
  await dialog.getByRole("button", { name: "Verify and save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("does not complement");
  await dialog
    .getByLabel("Complementary combat log", { exact: true })
    .fill(secondary);
  await dialog.getByRole("button", { name: "Verify and save" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("verified and saved");
  const read = await request.get(`${api}/matches?id=eq.${matchId}`, {
    headers: { Accept: "application/vnd.pgrst.object+json" },
  });
  expect((await read.json()).opponent_combat_log.replace(/\r\n/g, "\n")).toBe(
    secondary.replace(/\r\n/g, "\n"),
  );
  await page.getByLabel("Replay action", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Table Top", exact: true }).click();
  await page
    .getByRole("button", { name: "View Ciberbrian deck", exact: true })
    .click();
  const pile = page.getByRole("dialog", { name: "Deck", exact: true });
  await pile.locator(".study-card-button").first().click();
  await pile
    .getByRole("button", { name: "Move selected card to hand" })
    .click();
  await expect(pile).toHaveCount(0);
  await expect(
    page.locator(".study-bottom .study-hand .study-count"),
  ).toHaveText("7");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Close replay", exact: true }).click();
  const deleted = await request.post(`${api}/rpc/delete_entity`, {
    data: { entity: "deck", entity_id: deckId },
  });
  expect(deleted.ok()).toBeTruthy();
});
