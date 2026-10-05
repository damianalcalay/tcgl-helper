"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceSelect } from "@/components/shared/choice-select";
import {
  TCGDEX_STAGES,
  TCGDEX_SUFFIXES,
  TCGDEX_TRAINERS,
  type CardType,
} from "@/types/domain";

export function CardTypeSelector({
  value,
  onChange,
  label = "Card type",
}: {
  value: string;
  onChange: (type: CardType) => void;
  label?: string;
}) {
  const energy = value.startsWith("energy");
  const trainer = value in TCGDEX_TRAINERS || value === "ace_spec";
  const category = energy
    ? "Energy"
    : trainer
      ? "Trainer"
      : value
        ? "Pokemon"
        : "";
  const legacy = value.replace(/^mega_(basic|stage_[12])_ex$/, "$1_ex");
  const stage =
    Object.keys(TCGDEX_STAGES)
      .sort((a, b) => b.length - a.length)
      .find((s) => legacy === s || legacy.startsWith(`${s}_`)) ?? "";
  const suffix = stage ? legacy.slice(stage.length + 1) : "";
  return (
    <div className="form-stack card-type-fields">
      <ChoiceSelect
        label={label + " category"}
        value={category}
        placeholder="Choose category"
        options={["Pokemon", "Trainer", "Energy"].map((c) => ({
          value: c,
          label: c,
        }))}
        onChange={(v) =>
          onChange(
            (
              {
                Pokemon: "basic",
                Trainer: "item",
                Energy: "energy_basic",
              } as const
            )[v as "Pokemon"],
          )
        }
      />
      {category === "Pokemon" && (
        <>
          <ChoiceSelect
            label={label + " stage"}
            value={stage}
            options={Object.entries(TCGDEX_STAGES).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(v) =>
              onChange((v + (suffix ? "_" + suffix : "")) as CardType)
            }
          />
          <ChoiceSelect
            label={label + " suffix"}
            value={suffix}
            options={[
              { value: "", label: "None" },
              ...Object.entries(TCGDEX_SUFFIXES).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(v) => onChange((stage + (v ? "_" + v : "")) as CardType)}
          />
        </>
      )}
      {category === "Trainer" && (
        <>
          <ChoiceSelect
            label={label + " trainer type"}
            value={value === "ace_spec" ? "item" : value}
            options={Object.entries(TCGDEX_TRAINERS).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(v) => onChange(v as CardType)}
          />
          <label className="flex items-center gap-2">
            <Checkbox
              aria-label={label + " ACE SPEC"}
              checked={value === "ace_spec"}
              onCheckedChange={(checked) =>
                onChange(checked ? "ace_spec" : "item")
              }
            />
            ACE SPEC rarity
          </label>
        </>
      )}
      {category === "Energy" && (
        <ChoiceSelect
          label={label + " energy type"}
          value={value === "energy" ? "energy_basic" : value}
          options={[
            { value: "energy_basic", label: "Normal (Basic)" },
            { value: "energy_special", label: "Special" },
          ]}
          onChange={(v) => onChange(v as CardType)}
        />
      )}
    </div>
  );
}
