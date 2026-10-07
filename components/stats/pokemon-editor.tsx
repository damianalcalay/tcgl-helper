"use client";
import { useState } from "react";
import { Minus, Plus, Pencil } from "lucide-react";
import {
  type TableState,
  type TableCard,
  moveTableCard,
  setTableDamage,
  isTableEnergy,
  isTableTool,
  addTableEnergy,
  removeTableEnergy,
  fullDeckCards,
} from "@/lib/domain/table-top";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { ReplayImage } from "./combat-log-view";

export function PokemonEditor({
  state,
  pokemon,
  commit,
  image,
}: {
  state: TableState;
  pokemon: TableCard;
  commit: (state: TableState) => void;
  image: (name: string) => string | undefined;
}) {
  const [source, setSource] = useState("deck"),
    [returnZone, setReturnZone] = useState("hand"),
    [manual, setManual] = useState(false),
    [damage, setDamage] = useState(""),
    [error, setError] = useState("");
  const own = state.cards.filter((c) => c.owner === pokemon.owner),
    energies = [
      ...new Set(
        [...own, ...fullDeckCards(state, pokemon.owner)]
          .filter(isTableEnergy)
          .map((c) => c.name),
      ),
    ],
    tools = [
      ...new Set(
        [...own, ...fullDeckCards(state, pokemon.owner)]
          .filter(isTableTool)
          .map((c) => c.name),
      ),
    ];
  function add(name: string | null, attachment: "energy" | "tool") {
    if (attachment === "energy") {
      commit(addTableEnergy(state, pokemon.id, name, source));
      return;
    }
    const c = own.find(
      (a) => a.name === name && a.zone === source && !a.parent,
    );
    if (!c) return;
    const next = moveTableCard(
      state,
      c.id,
      pokemon.owner,
      pokemon.zone,
      undefined,
      pokemon.id,
      attachment,
    );
    const previous = own.find(
      (a) => a.parent === pokemon.id && a.attachment === "tool",
    );
    commit(
      previous && attachment === "tool"
        ? moveTableCard(
            next,
            previous.id,
            pokemon.owner,
            returnZone as "hand" | "deck" | "discard",
          )
        : next,
    );
  }
  function remove(name: string | null, attachment: "energy" | "tool") {
    const c = own.find(
      (a) =>
        a.name === name &&
        a.parent === pokemon.id &&
        a.attachment === attachment,
    );
    if (c)
      commit(
        attachment === "energy"
          ? removeTableEnergy(state, c.id)
          : moveTableCard(
              state,
              c.id,
              pokemon.owner,
              returnZone as "hand" | "deck" | "discard",
            ),
      );
  }
  return (
    <div className="pokemon-editor">
      <span>Damage counters</span>
      <div className="damage-controls">
        <Button
          className="rounded-full"
          size="icon"
          variant="outline"
          aria-label="Remove 10 damage"
          disabled={pokemon.damage <= 0}
          onClick={() =>
            commit(setTableDamage(state, pokemon.id, pokemon.damage - 10))
          }
        >
          <Minus />
        </Button>
        <output aria-label="Pokémon damage">{pokemon.damage}</output>
        <Button
          className="rounded-full"
          size="icon"
          variant="outline"
          aria-label="Add 10 damage"
          disabled={pokemon.damage >= 1000}
          onClick={() =>
            commit(setTableDamage(state, pokemon.id, pokemon.damage + 10))
          }
        >
          <Plus />
        </Button>
        <Button
          className="rounded-full"
          size="icon"
          variant="ghost"
          aria-label="Enter damage manually"
          onClick={() => {
            setManual(!manual);
            setDamage(String(pokemon.damage));
          }}
        >
          <Pencil />
        </Button>
      </div>
      {manual && (
        <form
          className="damage-manual-form"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(damage);
            if (
              !damage.trim() ||
              !Number.isInteger(n) ||
              n < 0 ||
              n > 1000 ||
              n % 10
            ) {
              setError("Use multiples of 10 from 0 to 1000.");
              return;
            }
            commit(setTableDamage(state, pokemon.id, n));
            setManual(false);
            setError("");
          }}
        >
          <Input
            aria-label="Manual damage"
            inputMode="numeric"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
          />
          <Button size="sm" type="submit">
            Apply
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <ChoiceSelect
        label="Attach from"
        value={source}
        onChange={setSource}
        options={["hand", "deck", "discard"].map((value) => ({
          value,
          label: value[0].toUpperCase() + value.slice(1),
        }))}
      />
      {tools.length > 0 && (
        <ChoiceSelect
          label="Return attachments to"
          value={returnZone}
          onChange={setReturnZone}
          options={["hand", "deck", "discard"].map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
          }))}
        />
      )}
      <span>
        Energies (
        {
          own.filter(
            (c) => c.parent === pokemon.id && c.attachment === "energy",
          ).length
        }
        /15)
      </span>
      {energies.map((name) => {
        const count = own.filter(
          (c) =>
            c.name === name &&
            c.parent === pokemon.id &&
            c.attachment === "energy",
        ).length;
        return (
          <div key={name} className="attachment-control">
            <span className="attachment-art" title={name ?? "Energy"}>
              <ReplayImage
                name={name ?? undefined}
                src={name ? image(name) : undefined}
              />
            </span>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label={`Remove ${name}`}
              disabled={!count}
              onClick={() => remove(name, "energy")}
            >
              <Minus />
            </Button>
            <b>{count}</b>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label={`Attach ${name}`}
              disabled={
                own.filter(
                  (c) => c.parent === pokemon.id && c.attachment === "energy",
                ).length >= 15
              }
              onClick={() => add(name, "energy")}
            >
              <Plus />
            </Button>
          </div>
        );
      })}
      {tools.length > 0 && (
        <>
          <span>Tools</span>
          <div className="tool-choices">
            {tools.map((name) => {
              const attached = own.some(
                (c) =>
                  c.name === name &&
                  c.parent === pokemon.id &&
                  c.attachment === "tool",
              );
              return (
                <Button
                  key={name}
                  size="icon"
                  variant="outline"
                  className="attachment-art"
                  title={name ?? "Tool"}
                  aria-label={`Tool ${name}`}
                  aria-pressed={attached}
                  disabled={
                    !attached &&
                    !own.some(
                      (c) => c.name === name && c.zone === source && !c.parent,
                    )
                  }
                  onClick={() =>
                    attached ? remove(name, "tool") : add(name, "tool")
                  }
                >
                  <ReplayImage
                    name={name ?? undefined}
                    src={name ? image(name) : undefined}
                  />
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
