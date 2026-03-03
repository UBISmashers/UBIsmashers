import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-10 text-center shadow-sm sm:px-10">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Ready to Join the Game?</h2>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="#rules"
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg"
          >
            Join Now
          </a>
          <Link
            to="/member-bills"
            className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-800 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            View Member Bills
          </Link>
        </div>
      </div>
    </section>
  );
}

