"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BedDouble, IndianRupee, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROOM_TYPE_LABEL } from "@/lib/format";
import type { RoomType } from "@/lib/types";

const BUDGETS = [
  { value: "", label: "Any budget" },
  { value: "8000", label: "Up to ₹8,000" },
  { value: "12000", label: "Up to ₹12,000" },
  { value: "18000", label: "Up to ₹18,000" },
  { value: "25000", label: "Up to ₹25,000" },
  { value: "40000", label: "Up to ₹40,000" },
];

export function HeroSearch({ cities }: { cities: string[] }) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [roomType, setRoomType] = useState<RoomType | "">("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (city.trim()) sp.set("city", city.trim());
    if (maxRent) sp.set("maxRent", maxRent);
    if (roomType) sp.set("roomType", roomType);
    router.push(`/listings${sp.size ? `?${sp}` : ""}`);
  };

  const cell = "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors focus-within:bg-accent hover:bg-accent/70";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const control = "w-full min-w-0 truncate bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/80";

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search homes"
      className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-2 shadow-lift md:flex-row md:items-center"
    >
      <label className={cell}>
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={label}>Location</span>
          <input
            className={control}
            placeholder="City or neighbourhood"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            list="hero-cities"
            autoComplete="off"
          />
          <datalist id="hero-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </span>
      </label>
      <div className="mx-1 hidden h-10 w-px bg-border md:block" aria-hidden />
      <label className={cell}>
        <IndianRupee className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={label}>Budget</span>
          <select className={`${control} cursor-pointer appearance-none`} value={maxRent} onChange={(e) => setMaxRent(e.target.value)}>
            {BUDGETS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </span>
      </label>
      <div className="mx-1 hidden h-10 w-px bg-border md:block" aria-hidden />
      <label className={cell}>
        <BedDouble className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={label}>Property type</span>
          <select className={`${control} cursor-pointer appearance-none`} value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType | "")}>
            <option value="">Any type</option>
            {Object.entries(ROOM_TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </span>
      </label>
      <Button type="submit" size="lg" className="h-14 rounded-2xl px-7 md:ml-1">
        <Search /> Search
      </Button>
    </form>
  );
}
