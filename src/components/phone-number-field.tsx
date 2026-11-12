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

function split(value: string, fallback: CountryCode) {
  const parsed = parsePhoneNumberFromString(value || "", fallback);
  return {
    country: parsed?.country ?? fallback,
    national: parsed?.nationalNumber ?? value.replace(/\D/g, ""),
  };
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
  const initial = useMemo(() => split(value, (country || "IN") as CountryCode), []);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const next = split(value, (country || selectedCountry) as CountryCode);
    if (next.country !== selectedCountry) setSelectedCountry(next.country);
    if (next.national !== national) setNational(next.national);
  }, [value, country]);

  function emit(nextNational: string, nextCountry = selectedCountry) {
    const digits = nextNational.replace(/\D/g, "");
    setNational(digits);
    onChange(phoneToE164(digits, nextCountry), nextCountry);
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
        <SelectTrigger aria-label="Country code" className="w-[126px] shrink-0 rounded-brand">
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
        className="min-w-0 flex-1 rounded-brand"
      />
    </div>
  );
}
