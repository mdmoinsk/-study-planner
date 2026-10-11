
"use client";

import { useEffect, useMemo, useState } from "react";

type Priority = "Low" | "Medium" | "High";

type Task = {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  deadline: string;
  subject: string;
};

const DEFAULT_TASKS: Task[] = [
  {
    id: 1,
    title: "Revise Computer Networks",
    completed: false,
    priority: "High",
    deadline: "2026-10-15",
    subject: "Computer Networks",
  },
  {
    id: 2,
    title: "Practice JavaScript",
    completed: false,
    priority: "Medium",
    deadline: "2026-10-17",
    subject: "Web Development",
  },
];

const SUBJECTS = [
  "General",
  "Computer Networks",
  "DBMS",
  "Java",
  "Web Development",
  "Operating Systems",
  "Mathematics",
  "Other",
];

const priorityStyles: Record<Priority, string> = {
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  High: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeTask(value: unknown, index: number): Task | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;

  if (
    typeof item.title !== "string" ||
    typeof item.completed !== "boolean"
  ) {
    return null;
  }

  const priority: Priority =
    item.priority === "Low" ||
    item.priority === "Medium" ||
    item.priority === "High"
      ? item.priority
      : "Medium";

  return {
    id: typeof item.id === "number" ? item.id : Date.now() + index,
    title: item.title,
    completed: item.completed,
    priority,
    deadline: typeof item.deadline === "string" ? item.deadline : "",
    subject:
      typeof item.subject === "string" && item.subject.trim()
        ? item.subject
        : "General",
  };
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Medium");
  const [newSubject, setNewSubject] = useState("Computer Networks");
  const [newDeadline, setNewDeadline] = useState("");

  const [filter, setFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Medium");
  const [editSubject, setEditSubject] = useState("General");
  const [editDeadline, setEditDeadline] = useState("");

  const [today, setToday] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved tasks and support tasks created by the older version.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("studyTasks");

      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item, index) => normalizeTask(item, index))
            .filter((task): task is Task => task !== null);

          setTasks(normalized);
        }
      }
    } catch (error) {
      console.error("Could not load saved tasks:", error);
    } finally {
      setToday(getLocalDate());
      setIsLoaded(true);
    }
  }, []);

  // Save after loading, so initial rendering doesn't overwrite saved data.
  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem("studyTasks", JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks:", error);
    }
  }, [tasks, isLoaded]);

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTask.trim();
    if (!title) return;

    const task: Task = {
      id: Date.now(),
      title,
      completed: false,
      priority: newPriority,
      subject: newSubject,
      deadline: newDeadline,
    };

    setTasks((current) => [task, ...current]);
    setNewTask("");
    setNewPriority("Medium");
    setNewSubject("Computer Networks");
    setNewDeadline("");
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id: number) {
    setTasks((current) => current.filter((task) => task.id !== id));

    if (editingId === id) {
      setEditingId(null);
    }
  }

  function startEditing(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditSubject(task.subject);
    setEditDeadline(task.deadline);
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = editTitle.trim();
    if (!title || editingId === null) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === editingId
          ? {
              ...task,
              title,
              priority: editPriority,
              subject: editSubject,
              deadline: editDeadline,
            }
          : task
      )
    );

    setEditingId(null);
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;

  const overdueCount = tasks.filter(
    (task) => !task.completed && task.deadline && today && task.deadline < today
  ).length;

  const progress = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.subject.toLowerCase().includes(query);

      const matchesSubject =
        subjectFilter === "All" || task.subject === subjectFilter;

      let matchesStatus = true;

      if (filter === "Pending") matchesStatus = !task.completed;
      if (filter === "Completed") matchesStatus = task.completed;
      if (filter === "High") matchesStatus = task.priority === "High";
      if (filter === "Overdue") {
        matchesStatus =
          !task.completed &&
          Boolean(task.deadline) &&
          Boolean(today) &&
          task.deadline < today;
      }

      return matchesSearch && matchesSubject && matchesStatus;
    });

    const rank: Record<Priority, number> = {
      High: 0,
      Medium: 1,
      Low: 2,
    };

    return [...filtered].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      return (
        rank[a.priority] - rank[b.priority] ||
        (a.deadline || "9999-12-31").localeCompare(
          b.deadline || "9999-12-31"
        )
      );
    });
  }, [tasks, search, subjectFilter, filter, today]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">
              STUDENT WORKSPACE
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              My Study Planner<span className="text-indigo-600">.</span>
            </h1>
            <p className="mt-2 text-slate-500">
              Organize your subjects. Prioritize your work. Track your progress.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              TODAY
            </p>
            <p className="mt-1 font-bold">
              {today ? formatDate(today) : "Loading date..."}
            </p>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total tasks" value={tasks.length} detail="All study tasks" />
          <StatCard label="Completed" value={completedCount} detail={`${progress}% overall progress`} />
          <StatCard label="Pending" value={pendingCount} detail="Still to work on" />
          <StatCard label="Overdue" value={overdueCount} detail="Past deadline" />
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Your progress</h2>
              <p className="mt-1 text-sm text-slate-500">
                Small steps lead to big results.
              </p>
            </div>
            <span className="text-2xl font-black text-indigo-600">{progress}%</span>
          </div>

          <div
            className="h-3 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Study task completion"
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Add a study task</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a subject, priority, and optional deadline.
          </p>

          <form
            onSubmit={addTask}
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <input
              type="text"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="What do you need to study?"
              aria-label="Task title"
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:col-span-2 lg:col-span-1"
              required
            />

            <select
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              aria-label="Task subject"
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500"
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as Priority)}
              aria-label="Task priority"
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500"
            >
              <option value="Low">Low priority</option>
              <option value="Medium">Medium priority</option>
              <option value="High">High priority</option>
            </select>

            <input
              type="date"
              value={newDeadline}
              min={today || undefined}
              onChange={(event) => setNewDeadline(event.target.value)}
              aria-label="Task deadline"
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              + Add task
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold">Your tasks</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, filter, edit, and manage your study plan.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search task or subject..."
                aria-label="Search tasks"
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                aria-label="Filter by subject"
                className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
              >
                <option value="All">All subjects</option>
                {Array.from(new Set([...SUBJECTS, ...tasks.map((task) => task.subject)]))
                  .filter((subject) => subject !== "All")
                  .map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
              </select>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter task status"
                className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-500"
              >
                <option value="All">All tasks</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="High">High priority</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {visibleTasks.map((task) => {
              const isOverdue =
                !task.completed &&
                Boolean(task.deadline) &&
                Boolean(today) &&
                task.deadline < today;

              if (editingId === task.id) {
                return (
                  <form
                    key={task.id}
                    onSubmit={saveEdit}
                    className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4"
                  >
                    <h3 className="font-bold">Edit task</h3>

                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      aria-label="Edit task title"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
                      required
                    />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={editSubject}
                        onChange={(event) => setEditSubject(event.target.value)}
                        aria-label="Edit subject"
                        className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      >
                        {Array.from(new Set([...SUBJECTS, editSubject])).map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>

                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as Priority)}
                        aria-label="Edit priority"
                        className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <option value="Low">Low priority</option>
                        <option value="Medium">Medium priority</option>
                        <option value="High">High priority</option>
                      </select>

                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(event) => setEditDeadline(event.target.value)}
                        aria-label="Edit deadline"
                        className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <article
                  key={task.id}
                  className={`rounded-xl border p-4 transition hover:shadow-sm ${
                    isOverdue
                      ? "border-rose-200 bg-rose-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      aria-label={`Mark ${task.title} as completed`}
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600"
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className={`break-words font-semibold ${
                          task.completed ? "text-slate-400 line-through" : ""
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          {task.subject}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityStyles[task.priority]}`}
                        >
                          {task.priority} priority
                        </span>

                        {task.deadline && (
                          <span className={`text-xs font-medium ${
                            isOverdue ? "text-rose-700" : "text-slate-500"
                          }`}>
                            {isOverdue ? "⚠ Overdue · " : "Due · "}
                            {formatDate(task.deadline)}
                          </span>
                        )}

                        {task.completed && (
                          <span className="text-xs font-semibold text-emerald-600">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => startEditing(task)}
                        aria-label={`Edit ${task.title}`}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center">
                <p className="text-lg font-bold">No matching tasks</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try a different search or filter, or add a new study task.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("All");
                    setSubjectFilter("All");
                  }}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="py-8 text-center text-sm text-slate-400">
          Built step by step · Student Study Planner
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}
