import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseCombatLog, combineCombatLogs } from "../../lib/domain/combat-log";
import { replayBoard } from "../../lib/domain/combat-replay";
import { tableFromReplay } from "../../lib/domain/table-top";

const api = "http://localhost:54329/rest/v1";
let createdIds: string[] = [];
async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/decks$/);
}
async function choice(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("menuitemradio", { name: value, exact: true }).click();
}
async function seed(request: APIRequestContext) {
  const own = readFileSync("tests/fixtures/paired-own.txt", "utf8"),
    other = readFileSync("tests/fixtures/paired-opponent.txt", "utf8");
  const paired = combineCombatLogs(own, other);
  if (paired.status !== "matched") throw Error(paired.message);
  const board = tableFromReplay(replayBoard(paired.log, 8));
  const existing = await (await request.get(`${api}/cards`)).json();
  const ids: Record<string, string> = {};
  async function card(name: string, type: string) {
    if (ids[name]) return ids[name];
    const found = existing.find((c: { name: string }) => c.name === name);
    if (found) return (ids[name] = found.id);
    const r = await request.post(`${api}/cards`, {
      data: { name, type },
      headers: { Accept: "application/vnd.pgrst.object+json" },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    const c = await r.json();
    createdIds.push(c.id);
    return (ids[name] = c.id);
  }
  const decks: string[] = [];
  for (const owner of ["Ciberbrian", "bastorz"]) {
    const counts = new Map<string, number>();
    for (const c of board.cards.filter((c) => c.owner === owner && c.name))
      counts.set(c.name!, (counts.get(c.name!) ?? 0) + 1);
    if (owner === "Ciberbrian") {
      counts.set("Rescue Board", 1);
      counts.set("Bravery Charm", 1);
      counts.set("Area Zero Underdepths", 1);
    }
    const energy =
      owner === "Ciberbrian" ? "Basic Fighting Energy" : "Basic Grass Energy";
    counts.set(
      energy,
      (counts.get(energy) ?? 0) +
        60 -
        [...counts.values()].reduce((s, n) => s + n, 0),
    );
    const rows = [];
    for (const [name, quantity] of counts) {
      const type = /Energy/.test(name)
        ? "energy_basic"
        : /Rescue Board|Bravery Charm/.test(name)
          ? "tool"
          : name === "Area Zero Underdepths"
            ? "stadium"
            : /Pad|Stamp|Orders|Gong|Set|Aid|Determination|Mountain|Vitality|Ball|Pro/.test(
                  name,
                )
              ? "item"
              : "basic";
      const id = await card(name, type);
      rows.push({
        card_id: id,
        quantity,
        printings: [
          {
            quantity,
            set_code: "TWM",
            collector_number: name === "Teal Mask Ogerpon ex" ? "25" : "1",
            image_url: "http://localhost:3100/card-back-classic.jpg",
            tera: name === "Teal Mask Ogerpon ex",
            tool: type === "tool",
            resolved_type: type,
          },
        ],
      });
    }
    const response = await request.post(`${api}/rpc/save_deck`, {
      data: {
        payload: {
          name: `Second iteration fixture ${owner}`,
          cards: rows,
          variants: [],
        },
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    decks.push(await response.json());
  }
  const log = parseCombatLog(own);
  const starter = ids[log.starters.Ciberbrian];
  const saved = await request.post(`${api}/rpc/save_match`, {
    data: {
      payload: {
        deck_id: decks[0],
        opponent_deck_id: decks[1],
        result: "loss",
        my_prizes: 1,
        opponent_prizes: 6,
        starter_id: starter,
        opponent_starter_id: ids[log.starters.bastorz],
        played_at: new Date().toISOString(),
        notes: "",
        combat_log: own,
        log_player: "Ciberbrian",
        prizes: [],
      },
    },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  const id = await saved.json();
  const pairedSave = await request.post(`${api}/rpc/save_complementary_log`, {
    data: { match_id: id, original_log: own, complementary_log: other },
  });
  expect(pairedSave.ok(), await pairedSave.text()).toBeTruthy();
  return decks;
}
test.afterEach(async ({ request }) => {
  const decks = await (await request.get(`${api}/decks`)).json();
  for (const d of decks)
    if (d.name.startsWith("Second iteration fixture"))
      await request.post(`${api}/rpc/delete_entity`, {
        data: { entity: "deck", entity_id: d.id },
      });
  for (const id of createdIds)
    await request.post(`${api}/rpc/delete_entity`, {
      data: { entity: "card", entity_id: id },
    });
  createdIds = [];
});

test("replay inspectors stay stable, prepared editor conserves cards and uses explicit attachment/damage controls", async ({
  page,
  request,
}) => {
  await seed(request);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          await items[0].getType("image/png");
          await new Promise((resolve) => setTimeout(resolve, 1500));
        },
      },
    });
  });
  await page.route("**/api/replay-cards", (route) =>
    route.fulfill({ json: { cards: [] } }),
  );
  await page.route("**/api/card-catalog**", (route) =>
    route.fulfill({ json: { cards: [] } }),
  );
  await login(page);
  await page.goto("/stats");
  await page
    .getByRole("row")
    .filter({ hasText: "Second iteration fixture Ciberbrian" })
    .getByRole("button", { name: /Details/ })
    .click();
  await page.getByRole("button", { name: "Match options" }).first().click();
  await page.getByRole("menuitem", { name: "Review match" }).click();
  await page.getByLabel("Replay action", { exact: true }).fill("8");
  await expect(
    page.getByRole("button", { name: "View Ciberbrian deck", exact: true }),
  ).toBeDisabled();
  const timelineBox = await page
    .locator(".study-timeline > input")
    .boundingBox();
  const playbackBox = await page.locator(".study-playback").boundingBox();
  expect(
    Math.abs(
      timelineBox!.x +
        timelineBox!.width / 2 -
        playbackBox!.x -
        playbackBox!.width / 2,
    ),
  ).toBeLessThan(2);
  const hand = page.locator(".study-bottom .study-hand .study-card-button");
  await hand.first().click();
  const inspection = page.locator(".study-inspection-modal");
  await expect(inspection).toBeVisible();
  await expect(inspection.getByRole("button")).toHaveCount(0);
  await expect(inspection.locator(".modal-header")).toHaveCount(0);
  await inspection.press("Escape");
  await expect(inspection).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Ciberbrian discard pile" })
    .click();
  const pile = page.getByRole("dialog", { name: "Discard pile", exact: true });
  const rect = await pile.boundingBox();
  for (const filter of ["Energy", "Trainers", "All"]) {
    await pile.getByRole("button", { name: filter, exact: true }).click();
    const next = await pile.boundingBox();
    expect(next!.height).toBe(rect!.height);
    expect(next!.y).toBe(rect!.y);
  }
  await pile.getByRole("button", { name: "Close dialog", exact: true }).click();
  await choice(page, "Replay speed", "x2");
  await expect(
    page.getByRole("button", { name: "Replay speed", exact: true }),
  ).toContainText("x2");
  await page.getByRole("button", { name: "Table Top", exact: true }).click();
  const setup = page.getByRole("dialog", {
    name: "Prepare Table Top",
    exact: true,
  });
  await expect(setup).toBeVisible();
  await setup
    .getByRole("button", { name: "Review card allocation", exact: true })
    .click();
  for (const selector of await setup
    .getByRole("button", { name: /^Allocate Ciberbrian prizes / })
    .all()) {
    await selector.click();
    await page
      .locator('[role="menu"][data-state="open"]')
      .getByRole("menuitemradio", {
        name: "Basic Fighting Energy",
        exact: true,
      })
      .click();
  }
  await setup
    .getByRole("checkbox", {
      name: "Use this allocation for the hypothetical scenario",
    })
    .check();
  await setup
    .getByRole("button", { name: "Enter Table Top", exact: true })
    .click();
  await expect(
    page.getByLabel("Replay action", { exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".study-bottom .study-bench-slot")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Move to player", exact: true }),
  ).toHaveCount(0);
  await page.locator(".study-bottom .study-active .study-card-button").click();
  await page
    .getByRole("button", { name: "Add 10 damage", exact: true })
    .click();
  await expect(page.locator(".study-bottom .study-damage")).toHaveText("10");
  await page
    .getByRole("button", { name: "Enter damage manually", exact: true })
    .click();
  await page.getByLabel("Manual damage", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".table-toolbar").getByRole("alert")).toContainText(
    "multiples of 10",
  );
  await page.getByLabel("Manual damage", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".study-bottom .study-damage")).toHaveText("1000");
  await expect(
    page.getByRole("button", { name: "Add 10 damage", exact: true }),
  ).toBeDisabled();
  await choice(page, "Attach from", "deck");
  await page
    .getByRole("button", { name: "Attach Basic Fighting Energy", exact: true })
    .click();
  await expect(
    page.locator(".study-bottom .study-active .study-attachment"),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Tool Rescue Board", exact: true })
    .click();
  await expect(
    page.locator(".study-bottom .study-active .study-attachment"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Tool Bravery Charm", exact: true })
    .click();
  await expect(
    page.locator(".study-bottom .study-active .study-attachment"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Tool Bravery Charm", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", {
        name: "Attach Basic Fighting Energy",
        exact: true,
      })
      .click();
  const stack = page.locator(".study-bottom .study-active .study-energy-stack");
  await expect(stack).toHaveText("5");
  await expect(
    page.locator(".study-bottom .study-active .study-attachment"),
  ).toHaveCount(2);
  await stack.click();
  const attached = page.getByRole("dialog", {
    name: "Attached energies",
    exact: true,
  });
  await expect(
    attached.getByRole("button", { name: "Return to hand" }),
  ).toHaveCount(5);
  await attached
    .getByRole("button", { name: "Return to hand" })
    .first()
    .click();
  await expect(
    attached.getByRole("button", { name: "Return to hand" }),
  ).toHaveCount(4);
  await attached.press("Escape");
  await expect(stack).toHaveCount(0);
  await page.getByRole("button", { name: "Screenshot", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Screenshot", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".study-toast")).toContainText(
    "Preparing board image",
  );
  await expect(page.locator(".study-toast")).toContainText(
    "Board image copied to clipboard",
  );
  await page
    .getByRole("button", { name: "Edit deck lists", exact: true })
    .click();
  const editLists = page.getByRole("dialog", {
    name: "Prepare Table Top",
    exact: true,
  });
  await editLists
    .getByLabel("Save deck name", { exact: true })
    .fill("Second iteration fixture edited variant");
  await editLists
    .getByRole("button", { name: "Save variant", exact: true })
    .click();
  await expect(editLists.getByRole("status")).toContainText("Deck saved");
  const savedDecks = await (await request.get(`${api}/decks`)).json();
  const parent = savedDecks.find(
      (d: { name: string }) => d.name === "Second iteration fixture Ciberbrian",
    ),
    variant = savedDecks.find(
      (d: { name: string }) =>
        d.name === "Second iteration fixture edited variant",
    );
  const relations = await (
    await request.get(`${api}/deck_variants?order=deck_id.asc,variant_id.asc`)
  ).json();
  expect(
    relations.some(
      (v: { deck_id: string; variant_id: string }) =>
        v.deck_id === parent.id && v.variant_id === variant.id,
    ),
  ).toBeTruthy();
  await editLists
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `test-results/table-top-${size.width}.png` });
    const boardBox = await page.locator(".study-board").boundingBox();
    const controlsBox = await page.locator(".study-timeline").boundingBox();
    expect(boardBox!.y + boardBox!.height).toBeLessThanOrEqual(controlsBox!.y);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "View Ciberbrian deck", exact: true })
    .click();
  const deck = page.getByRole("dialog", { name: "Deck", exact: true });
  await expect(deck.locator(".study-copy-count").first()).toBeVisible();
  const count = Number(
    await page.locator(".study-bottom .study-hand .study-count").innerText(),
  );
  await deck
    .getByRole("button", { name: "Area Zero Underdepths", exact: true })
    .click();
  await deck
    .getByRole("button", {
      name: "Select more Basic Fighting Energy",
      exact: true,
    })
    .click();
  await deck
    .getByRole("button", { name: "Move selected cards to hand (2)" })
    .click();
  await expect(
    page.locator(".study-bottom .study-hand .study-count"),
  ).toHaveText(String(count + 2));
  await page
    .locator(".study-bottom .study-hand")
    .getByRole("button", { name: "Area Zero Underdepths", exact: true })
    .click();
  await choice(page, "Move to zone", "stadium");
  await page
    .locator(".table-toolbar")
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await expect(page.locator(".study-top .study-bench-slot")).toHaveCount(8);
  await expect(page.locator(".study-bottom .study-bench-slot")).toHaveCount(5);
  const riolu = page
    .locator(".study-bottom .study-hand .study-card")
    .filter({ has: page.getByRole("button", { name: "Riolu", exact: true }) });
  await riolu.dragTo(page.locator(".study-bottom .study-bench-slot").first());
  await expect(
    page
      .locator(".study-bottom .study-bench-slot")
      .first()
      .getByRole("button", { name: "Riolu", exact: true }),
  ).toBeVisible();
  await page
    .locator(".study-bottom .study-bench-slot .study-card")
    .dragTo(page.locator(".study-top .study-bench-slot").first());
  await expect(
    page.locator(".study-bottom .study-bench .study-card"),
  ).toHaveCount(1);
  await expect(page.locator(".study-top .study-bench .study-card")).toHaveCount(
    0,
  );
  await page
    .locator(".study-stadium")
    .getByRole("button", { name: "Area Zero Underdepths", exact: true })
    .click();
  await choice(page, "Move to zone", "discard");
  await page
    .locator(".table-toolbar")
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await expect(page.locator(".study-top .study-bench-slot")).toHaveCount(5);
  await page.getByRole("button", { name: "pencil", exact: true }).click();
  const box = await page.locator(".study-board").boundingBox();
  await page.mouse.move(box!.x + 100, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + 200, box!.y + 150, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".table-annotations [data-mark]")).toHaveCount(1);
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await page
    .getByRole("button", { name: "Exit Table Top", exact: true })
    .click();
  await expect(page.getByLabel("Replay action", { exact: true })).toBeEnabled();
  await expect(page.locator(".table-annotations [data-mark]")).toHaveCount(0);
  expect(dialogs).toBe(0);
  await page.getByRole("button", { name: "Close replay", exact: true }).click();
});

test("missing-image set audit lists missing cards only, keeps failures distinct and supports uploads", async ({
  page,
}) => {
  await page.route("**/api/card-catalog**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST")
      return route.fulfill({
        json: {
          cards: [
            { id: "sv06-025", status: "available" },
            { id: "sv06-026", status: "missing" },
            { id: "sv06-027", status: "unverified" },
          ],
        },
      });
    if (url.searchParams.has("sets"))
      return route.fulfill({
        json: { sets: [{ id: "sv06", name: "Twilight Masquerade" }] },
      });
    return route.fulfill({
      json: {
        cards: [
          {
            id: "sv06-025",
            name: "Available card",
            localId: "25",
            image: "/card-back-classic.jpg",
          },
          { id: "sv06-026", name: "Missing card", localId: "26" },
          { id: "sv06-027", name: "Unavailable source", localId: "27" },
        ],
      },
    });
  });
  await page.route("**/api/card-art", (route) =>
    route.fulfill({ json: { image: "/card-back-classic.jpg" } }),
  );
  await login(page);
  await page.getByRole("link", { name: "Card images", exact: true }).click();
  await choice(page, "Expansion", "Twilight Masquerade");
  await expect(page.getByText("Missing card", { exact: true })).toBeVisible();
  await expect(page.getByText("Available card", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Unavailable source", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "not listed as missing" }),
  ).toContainText("not listed as missing");
  await page.getByLabel("Upload Missing card sv06-026").setInputFiles({
    name: "art.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Image saved · replace image")).toBeVisible();
});

test("deck variants add cards from the full Standard regex catalog without changing the base", async ({
  page,
  request,
}) => {
  const decks = await seed(request);
  await page.route("**/api/card-catalog**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: url.searchParams.has("id")
        ? {
            name: "Arven",
            type: "supporter",
            printing: {
              quantity: 1,
              set_code: "SVI",
              collector_number: "166",
              tcgdex_id: "sv01-166",
              resolved_type: "supporter",
              tera: false,
              tool: false,
            },
          }
        : {
            cards: [
              { id: "sv01-166", name: "Arven", localId: "166" },
              { id: "sv01-175", name: "Iono", localId: "175" },
            ],
          },
    });
  });
  await login(page);
  await page.goto(`/decks?deck=${decks[0]}`);
  await page
    .getByRole("button", { name: "Create variant", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: "Create deck variant",
    exact: true,
  });
  await form
    .getByLabel("Variant name", { exact: true })
    .fill("Second iteration fixture Standard variant");
  await form
    .getByRole("button", {
      name: "Remove one Basic Fighting Energy",
      exact: true,
    })
    .click();
  await form
    .getByRole("combobox", { name: "Add a Standard card", exact: true })
    .click();
  await form
    .getByRole("searchbox", { name: "Search Add a Standard card", exact: true })
    .fill("^Arv.*166$");
  await form.getByRole("option", { name: /Arven/ }).click();
  await expect(
    form.getByRole("button", { name: "Remove Arven", exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Save variant", exact: true }).click();
  await expect(form).toHaveCount(0);
  const saved = await (await request.get(`${api}/decks`)).json();
  const variant = saved.find(
    (d: { name: string }) =>
      d.name === "Second iteration fixture Standard variant",
  );
  expect(variant).toBeTruthy();
  const baseCards = await (
      await request.get(
        `${api}/deck_cards?deck_id=eq.${decks[0]}&order=deck_id.asc`,
      )
    ).json(),
    variantCards = await (
      await request.get(
        `${api}/deck_cards?deck_id=eq.${variant.id}&order=deck_id.asc`,
      )
    ).json();
  expect(
    baseCards.reduce((s: number, c: { quantity: number }) => s + c.quantity, 0),
  ).toBe(60);
  expect(variantCards.length).toBe(baseCards.length + 1);
  const all = await (await request.get(`${api}/cards`)).json();
  const arven = all.find((c: { name: string }) => c.name === "Arven");
  if (arven) createdIds.push(arven.id);
});
