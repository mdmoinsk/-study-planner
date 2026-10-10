
export default function Home() {
  return (
    <main className="min-h-screen bg-blue-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-yellow-600">
            Student Workspace
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            My Study Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Plan your studies. Track your progress. Achieve your goals.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">My Subjects</h2>
            <p className="mt-2 text-3xl font-bold text-blue-600">0</p>
            <p className="mt-1 text-sm text-slate-500">
              Subjects added
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Pending Tasks</h2>
            <p className="mt-2 text-3xl font-bold text-amber-600">0</p>
            <p className="mt-1 text-sm text-slate-500">
              Tasks to complete
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Completed Tasks</h2>
            <p className="mt-2 text-3xl font-bold text-emerald-600">0</p>
            <p className="mt-1 text-sm text-slate-500">
              Tasks finished
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Welcome to your workspace</h2>
          <p className="mt-2 text-slate-600">
            Your study journey starts here. Soon, you will be able to
            manage subjects, organize assignments, and plan study sessions.
          </p>
        </section>
      </div>
    </main>
  );
}