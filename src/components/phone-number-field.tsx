import { useEffect, useMemo, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const countries = getCountries()
  .map((code) => ({ code, dial: `+${getCountryCallingCode(code)}` }))
  .sort((a, b) => a.code.localeCompare(b.code));

const countryDialList = getCountries()
  .map((code) => ({ code, dial: getCountryCallingCode(code) }))
  .sort((a, b) => b.dial.length - a.dial.length);

export function splitPhone(value: string, fallback: CountryCode = "IN"): { country: CountryCode; national: string } {
  if (!value) return { country: fallback, national: "" };
  const clean = value.trim();
  const dial = getCountryCallingCode(fallback);
  const rawDigits = clean.replace(/\D/g, "");

  // If the raw digits are strictly the dial code itself (e.g. "91", "509", "592")
  if (rawDigits === dial) {
    return { country: fallback, national: "" };
  }

  const parsed = parsePhoneNumberFromString(clean, fallback);
  if (parsed && parsed.nationalNumber) {
    const nat = String(parsed.nationalNumber);
    const parsedDial = parsed.country ? getCountryCallingCode(parsed.country) : dial;
    if (nat === dial || nat === parsedDial) {
      return { country: (parsed.country ?? fallback) as CountryCode, national: "" };
    }
    return {
      country: (parsed.country ?? fallback) as CountryCode,
      national: nat,
    };
  }

  if (clean.startsWith("+")) {
    if (rawDigits.startsWith(dial)) {
      const rest = rawDigits.slice(dial.length);
      return { country: fallback, national: rest === dial ? "" : rest };
    }
    for (const c of countryDialList) {
      if (rawDigits.startsWith(c.dial)) {
        const rest = rawDigits.slice(c.dial.length);
        return { country: c.code as CountryCode, national: rest === c.dial ? "" : rest };
      }
    }
    return { country: fallback, national: rawDigits === dial ? "" : rawDigits };
  }

  // If user entered country code + phone without + (e.g. 919876543210 where 91 is dial and 10 digits follow)
  if (rawDigits.startsWith(dial) && rawDigits.length >= 11) {
    return { country: fallback, national: rawDigits.slice(dial.length) };
  }

  return { country: fallback, national: rawDigits === dial ? "" : rawDigits };
}

export function phoneToE164(national: string, country: CountryCode) {
  const digits = national.replace(/\D/g, "");
  return digits ? `+${getCountryCallingCode(country)}${digits}` : "";
}

export function PhoneNumberField({
  value,
  country = "IN",
  onChange,
  id,
  disabled,
  className,
}: {
  value: string;
  country?: string | null;
  onChange: (e164: string, country: CountryCode) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const fallbackCountry = (country || "IN") as CountryCode;
  const initial = useMemo(() => splitPhone(value, fallbackCountry), []);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const next = splitPhone(value, (country || selectedCountry) as CountryCode);
    if (next.country !== selectedCountry) setSelectedCountry(next.country);
    if (next.national !== national) setNational(next.national);
  }, [value, country]);

  function emit(nextNational: string, nextCountry = selectedCountry) {
    let raw = nextNational.trim();
    let targetCountry = nextCountry;
    if (raw.startsWith("+")) {
      const parsed = splitPhone(raw, targetCountry);
      raw = parsed.national;
      targetCountry = parsed.country;
      setSelectedCountry(targetCountry);
    }
    const dial = getCountryCallingCode(targetCountry);
    let digits = raw.replace(/\D/g, "");
    if (digits === dial) {
      digits = "";
    } else if (digits.startsWith(dial) && digits.length >= 11) {
      digits = digits.slice(dial.length);
    }
    setNational(digits);
    onChange(phoneToE164(digits, targetCountry), targetCountry);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={selectedCountry}
        disabled={disabled}
        onValueChange={(next) => {
          const code = next as CountryCode;
          setSelectedCountry(code);
          const oldDial = getCountryCallingCode(selectedCountry);
          const newDial = getCountryCallingCode(code);
          const nextNational = national === oldDial || national === newDial ? "" : national;
          setNational(nextNational);
          emit(nextNational, code);
        }}
      >
        <SelectTrigger aria-label="Country code" className="w-[84px] shrink-0 px-2 sm:w-[92px] sm:px-2.5 rounded-brand text-xs sm:text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {countries.map(({ code, dial }) => (
            <SelectItem key={code} value={code}>{code} {dial}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={national}
        disabled={disabled}
        onChange={(event) => emit(event.target.value)}
        placeholder="Mobile number"
        maxLength={15}
        className="min-w-0 flex-1 px-2.5 sm:px-3 text-sm rounded-brand"
      />
    </div>
  );
}
