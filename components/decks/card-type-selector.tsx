"use client";
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
      <label className="field-label">
        {label} · Category
        <select
          aria-label={`${label} category`}
          value={category}
          onChange={(e) =>
            onChange(
              (
                {
                  Pokemon: "basic",
                  Trainer: "item",
                  Energy: "energy_basic",
                } as const
              )[e.target.value as "Pokemon"],
            )
          }
        >
          <option value="" disabled>
            Choose category
          </option>
          {["Pokemon", "Trainer", "Energy"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {category === "Pokemon" && (
        <>
          <label className="field-label">
            Stage
            <select
              aria-label={`${label} stage`}
              value={stage}
              onChange={(e) =>
                onChange(
                  `${e.target.value}${suffix ? `_${suffix}` : ""}` as CardType,
                )
              }
            >
              {Object.entries(TCGDEX_STAGES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Suffix
            <select
              aria-label={`${label} suffix`}
              value={suffix}
              onChange={(e) =>
                onChange(
                  `${stage}${e.target.value ? `_${e.target.value}` : ""}` as CardType,
                )
              }
            >
              <option value="">None</option>
              {Object.entries(TCGDEX_SUFFIXES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {category === "Trainer" && (
        <div className="field-label">
          Trainer type
          <select
            aria-label={`${label} trainer type`}
            value={value === "ace_spec" ? "item" : value}
            onChange={(e) => onChange(e.target.value as CardType)}
          >
            {Object.entries(TCGDEX_TRAINERS).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              aria-label={`${label} ACE SPEC`}
              checked={value === "ace_spec"}
              onChange={(e) => onChange(e.target.checked ? "ace_spec" : "item")}
            />{" "}
            ACE SPEC rarity
          </label>
        </div>
      )}
      {category === "Energy" && (
        <label className="field-label">
          Energy type
          <select
            aria-label={`${label} energy type`}
            value={value === "energy" ? "energy_basic" : value}
            onChange={(e) => onChange(e.target.value as CardType)}
          >
            <option value="energy_basic">Normal (Basic)</option>
            <option value="energy_special">Special</option>
          </select>
        </label>
      )}
    </div>
  );
}
