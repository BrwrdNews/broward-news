import Link from "next/link";

const NAV_LINKS = [
  { label: "Home",           href: "/" },
  { label: "Latest",         href: "/?section=latest" },
  { label: "Fort Lauderdale",href: "/?city=fort-lauderdale" },
  { label: "Broward County", href: "/?city=broward" },
  { label: "Agencies",       href: "/?section=agencies" },
  { label: "Charges",        href: "/?section=charges" },
  { label: "Corrections",    href: "/corrections" },
  { label: "About",          href: "/about" },
];

export default function SiteHeader() {
  return (
    <header className="bg-brand-dark text-white border-b-4 border-brand-red">
      {/* Masthead */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-2xl md:text-3xl font-headline font-bold tracking-tight shrink-0">
          BROWARD NEWS
        </Link>
        <div className="text-right">
          <p className="text-xs text-gray-400 leading-tight">Fort Lauderdale &amp; Broward County, FL</p>
          <p className="text-xs text-gray-500 leading-tight">Public Booking Records</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="border-t border-gray-700 overflow-x-auto">
        <ul className="max-w-7xl mx-auto px-4 flex items-center gap-0 text-sm whitespace-nowrap">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block px-3 py-2.5 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
