const rules = [
  "Maintain sportsmanship and respect",
  "One-time Advance fee: $30",
  "Confirm attendance before match day",
  "Expenses are shared equally among players",
  " At End of Every month need to pay the expenses",
];

export function RulesSection() {
  return (
    <section id="rules" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          📝 Rules to Join UBISmashers
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <div
              key={rule}
              className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-700 sm:text-base">{rule}</p>
            </div>
          ))}
        </div>

        
      </div>
    </section>
  );
}
