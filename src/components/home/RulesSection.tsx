const rules = [
  "The weekly players list or voting poll (usually created on Sunday) is the reference for court booking. If your name is on the list and you withdraw at the last moment, it is still counted as played and you must share the session cost.",
  "If you want to withdraw from the players list, it is your responsibility to find a replacement. Otherwise, it will be considered as played.",
  "Maintain sportsmanship and respect.",
  "One-time advance fee: $30.",
  "Confirm attendance before match day.",
  "Expenses are shared equally among players.",
  "At the end of every month, expenses must be paid.",
];

export function RulesSection() {
  return (
    <section id="rules" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          📝 Rules to Join UBISmashers
        </h2>

        <div className="mt-8 grid gap-4">
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
