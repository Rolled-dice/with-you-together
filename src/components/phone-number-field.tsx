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
  const parsed = parsePhoneNumberFromString(clean, fallback);
  if (parsed && parsed.nationalNumber) {
    return {
      country: (parsed.country ?? fallback) as CountryCode,
      national: String(parsed.nationalNumber),
    };
  }
  if (clean.startsWith("+")) {
    const digits = clean.replace(/\D/g, "");
    const fallbackDial = getCountryCallingCode(fallback);
    if (digits.startsWith(fallbackDial)) {
      return {
        country: fallback,
        national: digits.slice(fallbackDial.length),
      };
    }
    for (const c of countryDialList) {
      if (digits.startsWith(c.dial)) {
        return {
          country: c.code as CountryCode,
          national: digits.slice(c.dial.length),
        };
      }
    }
    return { country: fallback, national: digits };
  }
  return { country: fallback, national: clean.replace(/\D/g, "") };
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
    const digits = raw.replace(/\D/g, "");
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
          emit(national, code);
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
