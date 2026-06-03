import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-dark text-gray-400 border-t-4 border-brand-red mt-12">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        {/* Brand */}
        <div>
          <p className="text-white font-headline font-bold text-lg mb-2">BROWARD NEWS</p>
          <p className="leading-relaxed">
            Covering public safety and booking records for Fort Lauderdale and
            Broward County, Florida.
          </p>
          <p className="mt-3 text-xs">
            &copy; {year} Broward News. All rights reserved.
          </p>
        </div>

        {/* Source policy */}
        <div>
          <p className="text-white font-semibold mb-2 uppercase tracking-wide text-xs">Source Policy</p>
          <p className="leading-relaxed text-xs">
            All records are sourced from official public booking databases maintained
            by Broward County law enforcement agencies. Records are public information
            under Florida law. We do not independently verify the accuracy of booking
            records.
          </p>
        </div>

        {/* Legal + contact */}
        <div>
          <p className="text-white font-semibold mb-2 uppercase tracking-wide text-xs">Legal &amp; Contact</p>
          <p className="text-xs leading-relaxed mb-3">
            <strong className="text-yellow-400">Presumption of Innocence:</strong>{" "}
            An arrest or booking is not a conviction. All individuals named in
            these records are presumed innocent unless proven guilty in a court of law.
          </p>
          <ul className="space-y-1 text-xs">
            <li>
              <a href="mailto:corrections@browardnews.local" className="hover:text-white underline">
                Correction or removal request
              </a>
            </li>
            <li>
              <Link href="/corrections" className="hover:text-white underline">
                Corrections policy
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-white underline">
                About Broward News
              </Link>
            </li>
            <li>
              <a href="mailto:contact@browardnews.local" className="hover:text-white underline">
                Contact us
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
