
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
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  High: "bg-rose-50 text-rose-700 ring-rose-200",
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

  const highPriorityPending = tasks.filter(
    (task) => task.priority === "High" && !task.completed
  ).length;
  const subjectAnalytics = useMemo(() => {
    const grouped = new Map<string, { total: number; completed: number }>();
    for (const task of tasks) {
      const current = grouped.get(task.subject) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (task.completed) current.completed += 1;
      grouped.set(task.subject, current);
    }
    return [...grouped.entries()]
      .map(([subject, counts]) => ({
        subject,
        ...counts,
        percent: counts.total ? Math.round((counts.completed / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject))
      .slice(0, 5);
  }, [tasks]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] text-[#171a2b]">
        Checking your session...
      </main>
    );
}
  return (
    <main className="min-h-screen bg-[#f7f8fc] text-[#171a2b]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-[#e8eaf2] bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#6658f5]">
              ✦ STUDENT WORKSPACE
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              My Study Planner<span className="text-[#171a2b]">.</span>
            </h1>
            <p className="mt-2 text-[#777c91]">
              Organize your subjects. Prioritize your work. Track your progress.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8eaf2] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#777c91]">
              TODAY
            </p>
            <p className="mt-1 font-bold">
              {today ? formatDeadline(today) : "Loading date..."}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e8eaf2] pt-3">
              <p className="min-w-0 truncate text-xs text-[#777c91]" title={userEmail}>
                {userEmail}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-lg border border-[#e8eaf2] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f8fc]"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {taskError && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <p>{taskError}</p>
            <button
              type="button"
              onClick={() => setTaskError("")}
              className="shrink-0 font-semibold hover:text-[#171a2b]"
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

        <section className="mb-6 overflow-hidden rounded-3xl border border-[#e8eaf2] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Your progress</h2>
              <p className="mt-1 text-sm text-[#777c91]">
                Small steps lead to big results.
              </p>
            </div>
            <span className="text-2xl font-black text-[#6658f0]">{progress}%</span>
          </div>
          <div
            className="h-4 overflow-hidden rounded-full bg-[#f0efff] ring-1 ring-inset ring-[#e8eaf2]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Study task completion"
          >
            <div
              className="animate-progress-fill relative h-full rounded-full bg-gradient-to-r from-[#6658f5] via-[#8b7cff] to-[#c8f169] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-[#e8eaf2] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#171a2b]">Subject analytics</h2>
                <p className="mt-1 text-sm text-[#777c91]">Progress calculated from your saved tasks.</p>
              </div>
              <span className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">{subjectAnalytics.length} subjects</span>
            </div>
            {subjectAnalytics.length ? (
              <div className="space-y-4">
                {subjectAnalytics.map((item) => (
                  <div key={item.subject}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-[#34364a]">{item.subject}</span>
                      <span className="shrink-0 text-xs font-semibold text-[#777c91]">{item.completed}/{item.total} · {item.percent}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#f0efff]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#6658f5] to-[#a69cff] transition-all duration-700" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d9dbea] px-4 py-8 text-center">
                <p className="font-semibold text-[#34364a]">Your analytics will appear here</p>
                <p className="mt-1 text-sm text-[#777c91]">Add a few tasks to see progress by subject.</p>
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-[#e8eaf2] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-[#171a2b]">Focus overview</h2>
            <p className="mt-1 text-sm text-[#777c91]">What needs your attention next.</p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
                <div><p className="text-sm font-semibold text-rose-800">High-priority pending</p><p className="mt-0.5 text-xs text-rose-700">Important tasks not finished</p></div>
                <span className="text-2xl font-black text-rose-700">{highPriorityPending}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                <div><p className="text-sm font-semibold text-amber-800">Due today</p><p className="mt-0.5 text-xs text-amber-700">Tasks with today's deadline</p></div>
                <span className="text-2xl font-black text-amber-700">{dueTodayCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3">
                <div><p className="text-sm font-semibold text-violet-800">Overdue</p><p className="mt-0.5 text-xs text-violet-700">Pending tasks past deadline</p></div>
                <span className="text-2xl font-black text-violet-700">{overdueCount}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-[#e8eaf2] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Add a study task</h2>
          <p className="mt-1 text-sm text-[#777c91]">
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
              className="min-w-0 rounded-xl border border-[#e8eaf2] bg-white px-4 py-3 text-[#171a2b] outline-none transition placeholder:text-[#969aab] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 sm:col-span-2 lg:col-span-1"
              required
            />

            <select
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              aria-label="Task subject"
              className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400"
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as Priority)}
              aria-label="Task priority"
              className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400"
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
              className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400"
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

        <section className="rounded-2xl border border-[#e8eaf2] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Your tasks</h2>
                <p className="mt-1 text-sm text-[#777c91]">
                  {view === "list"
                    ? "Search, filter, edit, and manage your study plan."
                    : "See what is due each day of the week."}
                </p>
              </div>

              <div
                role="group"
                aria-label="Task view"
                className="inline-flex rounded-xl border border-[#e8eaf2] bg-[#f7f8fc] p-1 text-sm font-semibold"
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
                        : "text-[#777c91] hover:text-[#171a2b]"
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
                className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />

              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                aria-label="Filter by subject"
                className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400"
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
                className="min-w-0 rounded-xl border border-[#e1e3ee] bg-white px-4 py-3 text-[#171a2b] outline-none focus:border-violet-400"
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
                    className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4"
                  >
                    <h3 className="font-bold">Edit task</h3>

                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      aria-label="Edit task title"
                      className="w-full rounded-lg border border-[#e1e3ee] bg-white px-3 py-2.5 text-[#171a2b] outline-none focus:border-violet-400"
                      required
                    />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={editSubject}
                        onChange={(event) => setEditSubject(event.target.value)}
                        aria-label="Edit subject"
                        className="min-w-0 rounded-lg border border-[#e1e3ee] bg-white px-3 py-2.5 text-[#171a2b]"
                      >
                        {Array.from(new Set([...SUBJECTS, editSubject])).map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>

                      <select
                        value={editPriority}
                        onChange={(event) => setEditPriority(event.target.value as Priority)}
                        aria-label="Edit priority"
                        className="min-w-0 rounded-lg border border-[#e1e3ee] bg-white px-3 py-2.5 text-[#171a2b]"
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
                        className="min-w-0 rounded-lg border border-[#e1e3ee] bg-white px-3 py-2.5 text-[#171a2b]"
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
                        className="rounded-lg border border-[#e8eaf2] bg-white px-4 py-2 font-semibold hover:bg-white"
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
                      ? "border-rose-200 bg-rose-50"
                      : "border-[#e8eaf2] bg-white"
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
                          task.completed ? "text-[#777c91] line-through" : ""
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                          {task.subject}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityStyles[task.priority]}`}
                        >
                          {task.priority} priority
                        </span>

                        {task.deadline && (
                          <span className="text-xs font-medium text-[#777c91]">
                            {task.completed ? "Was due " : "Due "}
                            {formatDeadline(task.deadline)}
                          </span>
                        )}

                        {status === "overdue" && (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                            Overdue
                          </span>
                        )}
                        {status === "today" && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                            Due today
                          </span>
                        )}
                        {status === "soon" && (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 ring-1 ring-inset ring-sky-200">
                            Due soon
                          </span>
                        )}

                        {task.completed && (
                          <span className="text-xs font-semibold text-emerald-700">
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
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-[#6658f5] hover:bg-violet-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-[#777c91] hover:bg-rose-50 hover:text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#d9dbea] px-4 py-12 text-center">
                <p className="text-lg font-bold">No matching tasks</p>
                <p className="mt-1 text-sm text-[#777c91]">
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

        <footer className="py-8 text-center text-sm text-[#777c91]">
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
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-[#e8eaf2] bg-white p-5 shadow-[0_4px_20px_rgba(25,30,60,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[#d8d2ff] hover:shadow-[0_14px_35px_rgba(80,65,180,0.09)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold tracking-wide text-[#777c91]">
          {label}
        </p>

        <span className="h-2.5 w-2.5 rounded-full bg-[#c8f169] ring-4 ring-[#c8f169]/20 transition-transform duration-300 group-hover:scale-125" />
      </div>

      <p className="mt-5 text-4xl font-black tracking-[-0.06em] text-[#171a2b] sm:text-[2.75rem]">
        {value}
      </p>

      <p className="mt-2 text-xs font-medium leading-relaxed text-[#777c91]">
        {detail}
      </p>

      <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#f0efff]">
        <div className="animate-progress-fill h-full w-1/3 rounded-full bg-[#6658f5]" />
      </div>
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
                ? "border-violet-400/40 bg-violet-50"
                : "border-[#e8eaf2] bg-white"
            }`}
          >
            <h3 className="font-bold">
              {date.toLocaleDateString(undefined, { weekday: "short" })}
              <span className="ml-2 text-sm font-medium text-[#777c91]">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </h3>
            <div className="mt-2 space-y-2">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onEditTask(task)}
                  className={`block w-full rounded-lg border border-[#e8eaf2] px-2.5 py-2 text-left text-xs hover:border-violet-400/40 ${
                    task.completed ? "text-[#777c91] line-through" : "text-[#171a2b]"
                  }`}
                  title="Edit task"
                >
                  <span className="block truncate font-semibold">{task.title}</span>
                  <span className="mt-1 block truncate text-[#777c91]">{task.subject}</span>
                </button>
              ))}
              {dayTasks.length === 0 && (
                <p className="pt-2 text-xs text-[#969aab]">No tasks due</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
