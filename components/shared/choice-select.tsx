"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
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
  clearable = false,
}: {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
    disabled?: boolean;
    description?: string;
  }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  clearable?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLDialogElement | undefined>();
  return (
    <div className="field-label min-w-0">
      {!hideLabel && <span>{label}</span>}
      <Menu.Root
        modal={false}
        onOpenChange={(open) => {
          if (open)
            setContainer(trigger.current?.closest("dialog") ?? undefined);
        }}
      >
        <Menu.Trigger asChild>
          <Button
            ref={trigger}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label}
            className="justify-between min-w-0 max-w-full"
          >
            <span className="min-w-0 truncate">
              {options.find((o) => o.value === value)?.label ?? placeholder}
            </span>
            <ChevronsUpDown size={14} />
          </Button>
        </Menu.Trigger>
        <Menu.Portal container={container}>
          <Menu.Content
            align="end"
            collisionPadding={12}
            className="z-50 max-h-[min(320px,var(--radix-dropdown-menu-content-available-height))] max-w-[calc(100vw-24px)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            sideOffset={4}
          >
            {clearable && (
              <DropdownMenuItem onSelect={() => onChange("")}>
                Clear selection
              </DropdownMenuItem>
            )}
            <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
              {options.map((o) => (
                <DropdownMenuRadioItem
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="whitespace-normal break-words"
                >
                  <span>
                    <span>{o.label}</span>
                    {o.description && (
                      <small className="block text-muted-foreground">
                        {o.description}
                      </small>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
