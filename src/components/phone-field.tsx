import { useMemo, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Turn an ISO 3166-1 alpha-2 country code (e.g. "IN") into its flag emoji by
 * mapping each letter to a Regional Indicator Symbol. No image assets or extra
 * deps needed — the OS renders the pair as a flag.
 */
function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  const base = 0x1f1e6; // Regional Indicator Symbol Letter A
  const chars = code
    .toUpperCase()
    .split("")
    .map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...chars);
}

// A readable country name from the ISO code, so the list shows "India" not "IN".
const REGION_NAMES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryName(code: string): string {
  return REGION_NAMES?.of(code) ?? code;
}

export interface PhoneFieldProps {
  /** ISO country code driving the dial code, e.g. "IN". */
  country: CountryCode;
  /** The local (national) number the user types, without the country code. */
  nationalNumber: string;
  onCountryChange: (country: CountryCode) => void;
  onNationalNumberChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Mobile number field with a searchable, scrollable country picker (flag +
 * country name + dial code) beside a local-number input. The user only types
 * the local number; the country selector supplies the code, so we never ask
 * them to type "+91" by hand. Compose the E.164 value with `toE164`.
 */
export function PhoneField({
  country,
  nationalNumber,
  onCountryChange,
  onNationalNumberChange,
  id,
  disabled,
  className,
}: PhoneFieldProps) {
  const [open, setOpen] = useState(false);

  const countryOptions = useMemo(
    () =>
      getCountries()
        .map((c) => ({
          code: c,
          name: countryName(c),
          dial: `+${getCountryCallingCode(c)}`,
          flag: flagEmoji(c),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const selected = countryOptions.find((c) => c.code === country);

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select country code"
            disabled={disabled}
            className="w-[116px] shrink-0 justify-between rounded-brand px-3"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span aria-hidden className="text-base leading-none">
                {selected?.flag}
              </span>
              <span className="text-sm">{selected?.dial}</span>
            </span>
            <CaretUpDownIcon className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] rounded-brand p-0" align="start">
          <Command
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search country or code…" />
            <CommandList className="max-h-64">
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countryOptions.map((c) => (
                  <CommandItem
                    key={c.code}
                    // Searchable by name, ISO code, and dial code.
                    value={`${c.name} ${c.code} ${c.dial}`}
                    onSelect={() => {
                      onCountryChange(c.code);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <span aria-hidden className="text-base leading-none">
                      {c.flag}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.dial}</span>
                    <CheckIcon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        c.code === country ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={nationalNumber}
        onChange={(e) => onNationalNumberChange(e.target.value)}
        placeholder="98765 43210"
        className="min-w-0 flex-1 rounded-brand"
      />
    </div>
  );
}

/**
 * Compose a country + typed local number into an E.164 string (e.g.
 * "+919876543210"), or null when the number isn't a valid number for that
 * country. Use this before saving/verifying.
 */
export function toE164(country: CountryCode, nationalNumber: string): string | null {
  if (!nationalNumber.trim()) return null;
  const parsed = parsePhoneNumberFromString(nationalNumber, country);
  return parsed?.isValid() ? parsed.number : null;
}

/**
 * Split a stored E.164 value back into { country, national } so the field can
 * be seeded from an existing profile. Falls back to the given default country.
 */
export function fromE164(
  e164: string | null | undefined,
  fallbackCountry: CountryCode,
): { country: CountryCode; national: string } {
  if (!e164) return { country: fallbackCountry, national: "" };
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return { country: fallbackCountry, national: e164 };
  return {
    country: (parsed.country as CountryCode) ?? fallbackCountry,
    national: parsed.nationalNumber ?? "",
  };
}
