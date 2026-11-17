import Image from "next/image";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-6 pb-12 pt-4 sm:px-10">
          <div className="w-full max-w-md animate-slide-up">{children}</div>
        </main>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <Image src="/images/kitchen.jpg" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-md font-serif text-4xl italic leading-tight">
            “A good flatshare is less about square feet and more about the people you share them with.”
          </p>
          <p className="mt-4 text-sm text-white/70">The idea behind Rent &amp; Flatmate Finder</p>
        </div>
      </div>
    </div>
  );
}
