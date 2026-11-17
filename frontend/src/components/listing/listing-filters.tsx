"use client";

import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/primitives";
import { AMENITIES, FURNISHING_LABEL, GENDER_LABEL, humanize, ROOM_TYPE_LABEL } from "@/lib/format";

export interface Filters {
  q: string;
  city: string;
  locality: string;
  minRent: string;
  maxRent: string;
  roomType: string;
  furnishingStatus: string;
  genderPreference: string;
  amenities: string[];
  availableBy: string;
  sort: string;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  city: "",
  locality: "",
  minRent: "",
  maxRent: "",
  roomType: "",
  furnishingStatus: "",
  genderPreference: "",
  amenities: [],
  availableBy: "",
  sort: "newest",
};

export function countActive(f: Filters) {
  return (
    [f.city, f.locality, f.minRent, f.maxRent, f.roomType, f.furnishingStatus, f.genderPreference, f.availableBy].filter(Boolean)
      .length + f.amenities.length
  );
}

const section = "space-y-3 border-b border-border pb-6 last:border-0 last:pb-0";
const heading = "text-sm font-semibold";

export function ListingFilters({
  value,
  onChange,
  idPrefix = "f",
}: {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  idPrefix?: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  const toggleAmenity = (a: string) =>
    onChange({ amenities: value.amenities.includes(a) ? value.amenities.filter((x) => x !== a) : [...value.amenities, a] });

  return (
    <div className="space-y-6">
      <div className={section}>
        <h3 className={heading}>Location</h3>
        <div className="space-y-1.5">
          <Label htmlFor={id("city")} className="text-xs text-muted-foreground">City</Label>
          <Input id={id("city")} placeholder="e.g. Mumbai" value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("locality")} className="text-xs text-muted-foreground">Locality</Label>
          <Input id={id("locality")} placeholder="e.g. Andheri West" value={value.locality} onChange={(e) => onChange({ locality: e.target.value })} />
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Monthly rent (₹)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={id("min")} className="text-xs text-muted-foreground">Minimum</Label>
            <Input id={id("min")} inputMode="numeric" placeholder="0" value={value.minRent} onChange={(e) => onChange({ minRent: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("max")} className="text-xs text-muted-foreground">Maximum</Label>
            <Input id={id("max")} inputMode="numeric" placeholder="Any" value={value.maxRent} onChange={(e) => onChange({ maxRent: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Room type</h3>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!value.roomType} onClick={() => onChange({ roomType: "" })}>Any</Chip>
          {Object.entries(ROOM_TYPE_LABEL).map(([k, l]) => (
            <Chip key={k} selected={value.roomType === k} onClick={() => onChange({ roomType: value.roomType === k ? "" : k })}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Furnishing</h3>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!value.furnishingStatus} onClick={() => onChange({ furnishingStatus: "" })}>Any</Chip>
          {Object.entries(FURNISHING_LABEL).map(([k, l]) => (
            <Chip key={k} selected={value.furnishingStatus === k} onClick={() => onChange({ furnishingStatus: value.furnishingStatus === k ? "" : k })}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      <div className={section}>
        <div className="space-y-1.5">
          <Label htmlFor={id("gender")} className={heading}>Flatmate preference</Label>
          <Select id={id("gender")} value={value.genderPreference} onChange={(e) => onChange({ genderPreference: e.target.value })}>
            <option value="">Any listing</option>
            <option value="FEMALE">Open to female tenants</option>
            <option value="MALE">Open to male tenants</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            For shared homes, as stated by the lister. {GENDER_LABEL.ANY} listings are always included.
          </p>
        </div>
      </div>

      <div className={section}>
        <div className="space-y-1.5">
          <Label htmlFor={id("movein")} className={heading}>Move in by</Label>
          <Input id={id("movein")} type="date" value={value.availableBy} onChange={(e) => onChange({ availableBy: e.target.value })} />
        </div>
      </div>

      <div className={section}>
        <h3 className={heading}>Amenities</h3>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => (
            <Chip key={a} selected={value.amenities.includes(a)} onClick={() => toggleAmenity(a)}>
              {humanize(a)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
