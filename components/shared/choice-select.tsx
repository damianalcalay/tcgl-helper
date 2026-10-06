"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

// Render inside the native dialog so the browser's top layer keeps it interactive.
export function ChoiceSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose",
  disabled = false,
  hideLabel = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <div className="field-label">
      {!hideLabel && <span>{label}</span>}
      <Menu.Root modal={false}>
        <Menu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label}
            className="justify-between"
          >
            {options.find((o) => o.value === value)?.label ?? placeholder}
            <ChevronsUpDown size={14} />
          </Button>
        </Menu.Trigger>
        <Menu.Content
          className="z-50 max-h-[min(320px,60dvh)] overflow-y-auto min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          sideOffset={4}
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </Menu.Content>
      </Menu.Root>
    </div>
  );
}
