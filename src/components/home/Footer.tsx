import { Link } from "react-router-dom";
import { Phone, Mail, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-emerald-100 bg-slate-950 px-4 py-8 text-slate-200 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Contact</p>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <a href="tel:+6586152500" className="flex items-center gap-2 hover:text-emerald-300">
              <Phone className="h-4 w-4" />
              +65 86152500
            </a>
            <a href="mailto:Ubismashers@gmail.com" className="flex items-center gap-2 hover:text-emerald-300">
              <Mail className="h-4 w-4" />
              Ubismashers@gmail.com
            </a>
            <a
              href="https://www.instagram.com/ubi_smashers?igsh=MWc1YXZxOGhzYWNrbA=="
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-emerald-300"
            >
              <Instagram className="h-4 w-4" />
              @ubi_smashers
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <img src="/icon.jpeg" alt="UBISmashers icon" className="h-9 w-9 rounded-lg object-cover" />
            <p className="text-sm font-medium">UBISmashers (c) 2026</p>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/admin-login" className="transition hover:text-emerald-300">
              Admin Login
            </Link>
            <Link to="/member-bills" className="transition hover:text-emerald-300">
              Member Bills
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
