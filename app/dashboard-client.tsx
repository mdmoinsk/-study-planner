
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

type Priority = "Low" | "Medium" | "High";

type Task = {
  id: string | number;
  title: string;
  completed: boolean;
  priority: Priority;
  deadline: string;
  subject: string;
};

function getLocalDateString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDeadline(deadline: string): string {
  const date = new Date(`${deadline}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? deadline
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function getDeadlineStatus(
  task: Pick<Task, "deadline" | "completed">,
  today: string
): "overdue" | "today" | "soon" | "none" {
  if (!task.deadline || task.completed) return "none";
  if (task.deadline < today) return "overdue";
  if (task.deadline === today) return "today";

  const todayDate = new Date(`${today}T00:00:00`);
  const deadlineDate = new Date(`${task.deadline}T00:00:00`);
  const daysUntilDeadline =
    (deadlineDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000);
  return daysUntilDeadline <= 7 ? "soon" : "none";
}

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
  Low: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  Medium: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  High: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
};

type DatabaseTask = {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  deadline: string | null;
  subject: string;
};

function fromDatabaseTask(row: DatabaseTask): Task {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    priority: row.priority,
    deadline: row.deadline ?? "",
    subject: row.subject || "General",
  };
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Medium");
  const [newSubject, setNewSubject] = useState("Computer Networks");
  const [newDeadline, setNewDeadline] = useState("");

  const [view, setView] = useState<"list" | "week">("list");
  const [filter, setFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Medium");
  const [editSubject, setEditSubject] = useState("General");
  const [editDeadline, setEditDeadline] = useState("");

  const [today, setToday] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const router = useRouter();
const supabase = useMemo(() => createClient(), []);

const [authChecking, setAuthChecking] = useState(true);
const [userEmail, setUserEmail] = useState("");
const [userId, setUserId] = useState("");
const [taskSyncing, setTaskSyncing] = useState(false);
const [taskError, setTaskError] = useState("");

useEffect(() => {
  let active = true;

  async function initialize() {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        router.replace("/auth");
        return;
      }

      const user = authData.user;
      setUserEmail(user.email ?? "");
      setUserId(user.id);

      // Load existing tasks belonging to this user.
      const { data: rows, error: loadError } = await supabase
        .from("tasks")
        .select("id, title, completed, priority, deadline, subject")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (loadError) throw loadError;
      if (!active) return;

      const loadedTasks = ((rows ?? []) as DatabaseTask[]).map(
        fromDatabaseTask
      );

      if (!active) return;

      setTasks(loadedTasks);
      setToday(getLocalDateString());
      setIsLoaded(true);
      setAuthChecking(false);
    } catch (error) {
      if (!active) return;

      console.error("Could not initialize study planner:", error);
      setTaskError(
        error instanceof Error
          ? error.message
          : "Could not load your tasks."
      );
      setAuthChecking(false);
    }
  }

  initialize();

  return () => {
    active = false;
  };
}, [router, supabase]);

  // Save after loading, so initial rendering doesn't overwrite saved data.
  useEffect(() => {
    if (!isLoaded || !userId) return;

    try {
      localStorage.setItem(`studyTasks:${userId}`, JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks:", error);
    }
  }, [tasks, isLoaded, userId]);

async function addTask(event?: React.FormEvent<HTMLFormElement>) {
  event?.preventDefault();

  if (!newTask.trim()) return;

  if (!userId) {
    setTaskError("User session not found. Please log in again.");
    return;
  }

  setTaskError("");
  setTaskSyncing(true);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: newTask.trim(),
      completed: false,
      priority: newPriority,
      subject: newSubject,
      deadline: newDeadline || null,
    })
    .select("id, title, completed, priority, deadline, subject")
    .single();

  setTaskSyncing(false);

  if (error) {
    setTaskError(error.message);
    return;
  }

  setTasks((current) => [fromDatabaseTask(data as DatabaseTask), ...current]);
  setNewTask("");
  setNewPriority("Medium");
  setNewSubject("General");
  setNewDeadline("");
}

async function toggleTask(id: string | number) {
  const task = tasks.find((item) => item.id === id);

  if (!task || typeof id !== "string") {
    setTaskError("This task needs to be synced with the database first.");
    return;
  }

  setTaskError("");

  const { error } = await supabase
    .from("tasks")
    .update({ completed: !task.completed })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    setTaskError(error.message);
    return;
  }

  setTasks((current) =>
    current.map((item) =>
      item.id === id
        ? { ...item, completed: !item.completed }
        : item
    )
  );
}

async function deleteTask(id: string | number) {
  if (typeof id !== "string") {
    setTaskError("This task needs to be synced with the database first.");
    return;
  }

  setTaskError("");

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    setTaskError(error.message);
    return;
  }

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

async function saveEdit(event?: React.FormEvent<HTMLFormElement>) {
  event?.preventDefault();

  if (editingId === null || !editTitle.trim()) return;

  if (typeof editingId !== "string") {
    setTaskError("This task needs to be synced with the database first.");
    return;
  }

  setTaskError("");

  const { error } = await supabase
    .from("tasks")
    .update({
      title: editTitle.trim(),
      priority: editPriority,
      subject: editSubject,
      deadline: editDeadline || null,
    })
    .eq("id", editingId)
    .eq("user_id", userId);

  if (error) {
    setTaskError(error.message);
    return;
  }

  setTasks((current) =>
    current.map((task) =>
      task.id === editingId
        ? {
            ...task,
            title: editTitle.trim(),
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

  const countByStatus = (status: string) =>
    tasks.filter((task) => getDeadlineStatus(task, today) === status).length;

  // Overdue tasks are also counted as Pending (they are not finished).
  const overdueCount = countByStatus("overdue");
  const dueTodayCount = countByStatus("today");
  const dueSoonCount = countByStatus("soon");

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
        matchesStatus = getDeadlineStatus(task, today) === "overdue";
      }
      if (filter === "Today") {
        matchesStatus = getDeadlineStatus(task, today) === "today";
      }
      if (filter === "Soon") {
        matchesStatus = getDeadlineStatus(task, today) === "soon";
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

  async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  router.replace("/auth");
  router.refresh();
}

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Checking your session...
      </main>
    );
}
  return (
    <main className="min-h-screen bg-[#080d1b] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-white/10 bg-gradient-to-r from-violet-500/10 via-slate-900/80 to-cyan-500/5 p-6 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-violet-300">
              ✦ STUDENT WORKSPACE
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              My Study Planner<span className="text-violet-300">.</span>
            </h1>
            <p className="mt-2 text-slate-500">
              Organize your subjects. Prioritize your work. Track your progress.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              TODAY
            </p>
            <p className="mt-1 font-bold">
              {today ? formatDeadline(today) : "Loading date..."}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <p className="min-w-0 truncate text-xs text-slate-400" title={userEmail}>
                {userEmail}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {taskError && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            <p>{taskError}</p>
            <button
              type="button"
              onClick={() => setTaskError("")}
              className="shrink-0 font-semibold hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total tasks" value={tasks.length} detail="All study tasks" />
          <StatCard label="Completed" value={completedCount} detail={`${progress}% overall progress`} />
          <StatCard label="Pending" value={pendingCount} detail={`${dueTodayCount} due today · ${dueSoonCount} due soon`} />
          <StatCard label="Overdue" value={overdueCount} detail="Past deadline, included in Pending" />
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-900/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Your progress</h2>
              <p className="mt-1 text-sm text-slate-500">
                Small steps lead to big results.
              </p>
            </div>
            <span className="text-2xl font-black text-violet-300">{progress}%</span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Study task completion"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-900/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
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
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 sm:col-span-2 lg:col-span-1"
              required
            />

            <select
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              aria-label="Task subject"
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-violet-400"
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as Priority)}
              aria-label="Task priority"
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-violet-400"
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
              className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-violet-400"
            />

            <button
              type="submit"
              disabled={taskSyncing}
              className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {taskSyncing ? "Adding..." : "+ Add task"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/10 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Your tasks</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {view === "list"
                    ? "Search, filter, edit, and manage your study plan."
                    : "See what is due each day of the week."}
                </p>
              </div>

              <div
                role="group"
                aria-label="Task view"
                className="inline-flex rounded-xl border border-white/10 bg-slate-950/60 p-1 text-sm font-semibold"
              >
                {(["list", "week"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    aria-pressed={view === option}
                    className={`rounded-lg px-4 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
                      view === option
                        ? "bg-violet-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {option === "list" ? "List" : "Week"}
                  </button>
                ))}
              </div>
            </div>

            {view === "list" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search task or subject..."
                aria-label="Search tasks"
                className="min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />

              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                aria-label="Filter by subject"
                className="min-w-0 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-violet-400"
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
                className="min-w-0 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 outline-none focus:border-violet-400"
              >
                <option value="All">All tasks</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="High">High priority</option>
                <option value="Overdue">Overdue</option>
                <option value="Today">Due today</option>
                <option value="Soon">Due soon</option>
              </select>
            </div>
            )}
          </div>

          {view === "week" && (
            <WeeklyCalendar
              tasks={tasks}
              today={today}
              onEditTask={(task) => {
                // Clear filters so the task is visible in the list for editing.
                setSearch("");
                setFilter("All");
                setSubjectFilter("All");
                setView("list");
                startEditing(task);
              }}
            />
          )}

          {view === "list" && (
          <div className="mt-5 space-y-3">
            {visibleTasks.map((task) => {
              const status = getDeadlineStatus(task, today);
              const isOverdue = status === "overdue";

              if (editingId === task.id) {
                return (
                  <form
                    key={task.id}
                    onSubmit={saveEdit}
                    className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-500/10 p-4"
                  >
                    <h3 className="font-bold">Edit task</h3>

                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      aria-label="Edit task title"
                      className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2.5 outline-none focus:border-violet-400"
                      required
                    />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={editSubject}
                        onChange={(event) => setEditSubject(event.target.value)}
                        aria-label="Edit subject"
                        className="min-w-0 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2.5"
                      >
                        {Array.from(new Set([...SUBJECTS, editSubject])).map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>

                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as Priority)}
                        aria-label="Edit priority"
                        className="min-w-0 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2.5"
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
                        className="min-w-0 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2.5"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-white/10 bg-slate-900/70 px-4 py-2 font-semibold hover:bg-slate-950/70"
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
                  className={`rounded-xl border p-4 transition hover:shadow-xl shadow-black/10 ${
                    isOverdue
                      ? "border-rose-400/20 bg-rose-400/5"
                      : "border-white/10 bg-slate-900/70"
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
                          task.completed ? "text-slate-500 line-through" : ""
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-bold text-violet-200">
                          {task.subject}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityStyles[task.priority]}`}
                        >
                          {task.priority} priority
                        </span>

                        {task.deadline && (
                          <span className="text-xs font-medium text-slate-400">
                            {task.completed ? "Was due " : "Due "}
                            {formatDeadline(task.deadline)}
                          </span>
                        )}

                        {status === "overdue" && (
                          <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-bold text-rose-300 ring-1 ring-inset ring-rose-400/20">
                            Overdue
                          </span>
                        )}
                        {status === "today" && (
                          <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-inset ring-amber-400/20">
                            Due today
                          </span>
                        )}
                        {status === "soon" && (
                          <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-300 ring-1 ring-inset ring-sky-400/20">
                            Due soon
                          </span>
                        )}

                        {task.completed && (
                          <span className="text-xs font-semibold text-emerald-300">
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
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/15 px-4 py-12 text-center">
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
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          )}
        </section>

        <footer className="py-8 text-center text-sm text-slate-500">
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
}) 
{
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-900/60 p-5 shadow-xl shadow-black/20 transition duration-200 hover:-translate-y-1 hover:border-violet-400/30">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function WeeklyCalendar({
  tasks,
  today,
  onEditTask,
}: {
  tasks: Task[];
  today: string;
  onEditTask: (task: Task) => void;
}) {
  const anchor = today ? new Date(`${today}T00:00:00`) : new Date();
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - mondayOffset);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return { date, dateString };
  });

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map(({ date, dateString }) => {
        const dayTasks = tasks.filter((task) => task.deadline === dateString);

        return (
          <section
            key={dateString}
            className={`min-h-36 rounded-xl border p-3 ${
              dateString === today
                ? "border-violet-400/40 bg-violet-500/10"
                : "border-white/10 bg-slate-950/40"
            }`}
          >
            <h3 className="font-bold">
              {date.toLocaleDateString(undefined, { weekday: "short" })}
              <span className="ml-2 text-sm font-medium text-slate-400">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </h3>
            <div className="mt-2 space-y-2">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onEditTask(task)}
                  className={`block w-full rounded-lg border border-white/10 px-2.5 py-2 text-left text-xs hover:border-violet-400/40 ${
                    task.completed ? "text-slate-500 line-through" : "text-slate-200"
                  }`}
                  title="Edit task"
                >
                  <span className="block truncate font-semibold">{task.title}</span>
                  <span className="mt-1 block truncate text-slate-400">{task.subject}</span>
                </button>
              ))}
              {dayTasks.length === 0 && (
                <p className="pt-2 text-xs text-slate-600">No tasks due</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
