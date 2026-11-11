
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
      <main className="neumorphic-page flex min-h-screen items-center justify-center text-[#2d3436]">
        Checking your session...
      </main>
    );
}
  return (
    <main className="neumorphic-page min-h-screen text-[#2d3436]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 neumorphic-card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between p-8">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#5b5bf5]">
              ✦ STUDENT WORKSPACE
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#1e2224] sm:text-5xl">
              My Study Planner<span className="text-[#1e2224]">.</span>
            </h1>
            <p className="mt-2 text-sm text-[#6c7a89]">
              Organise your subjects. Prioritise your work. Track your progress.
            </p>
          </div>

          <div className="neumorphic-card rounded-[2rem] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6c7a89]">
              TODAY
            </p>
            <p className="mt-1 font-bold text-[#1e2224]">
              {today ? formatDeadline(today) : "Loading date..."}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 pt-3">
              <p className="min-w-0 truncate text-sm text-[#6c7a89]" title={userEmail}>
                {userEmail}
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="neumorphic-btn shrink-0 px-3 py-1.5 text-xs font-semibold"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {taskError && (
          <div
            role="alert"
            className="mb-6 neumorphic-inset rounded-[2rem] p-4 text-sm text-[#e74c3c] font-medium border border-transparent"
          >
            <p>{taskError}</p>
            <button
              type="button"
              onClick={() => setTaskError("")}
              className="shrink-0 font-semibold text-[#1e2224] ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total tasks" value={tasks.length} detail="All study tasks" />
          <StatCard
            label="Completed"
            value={completedCount}
            detail={`${progress}% overall progress`}
          />
          <StatCard
            label="Pending"
            value={pendingCount}
            detail={`${dueTodayCount} due today · ${dueSoonCount} due soon`}
          />
          <StatCard
            label="Overdue"
            value={overdueCount}
            detail="Past deadline, included in Pending"
          />
        </section>

        <section className="mb-6 neumorphic-card overflow-hidden p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="neumorphic-heading">Your progress</h2>
              <p className="neumorphic-subheading">Small steps lead to big results.</p>
            </div>
            <span className="text-3xl font-black text-[#5b5bf5]">{progress}%</span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-[#d7dbe0] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Study task completion"
          >
            <div
              className="animate-progress-fill relative h-full rounded-full neumorphic-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="neumorphic-card p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="neumorphic-heading">Subject analytics</h2>
                <p className="neumorphic-subheading">
                  Progress calculated from your saved tasks.
                </p>
              </div>
              <span className="neumorphic-badge text-[#5b5bf5]">
                {subjectAnalytics.length} subjects
              </span>
            </div>
            {subjectAnalytics.length ? (
              <div className="space-y-4">
                {subjectAnalytics.map((item) => (
                  <div key={item.subject}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-[#1e2224]">
                        {item.subject}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#6c7a89]">
                        {item.completed}/{item.total} · {item.percent}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#d7dbe0]">
                      <div
                        className="h-full rounded-full neumorphic-progress-bar"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="neumorphic-inset rounded-[2rem] px-4 py-8 text-center">
                <p className="font-semibold text-[#1e2224]">
                  Your analytics will appear here
                </p>
                <p className="mt-1 text-sm text-[#6c7a89]">
                  Add a few tasks to see progress by subject.
                </p>
              </div>
            )}
          </div>
          <div className="neumorphic-card p-5 sm:p-6">
            <h2 className="neumorphic-heading">Focus overview</h2>
            <p className="neumorphic-subheading">
              What needs your attention next.
            </p>
            <div className="mt-5 space-y-3">
              <div className="neumorphic-card p-4 border border-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#d3546f]">
                      High-priority pending
                    </p>
                    <p className="mt-0.5 text-xs text-[#6c7a89]">
                      Important tasks not finished
                    </p>
                  </div>
                  <span className="text-2xl font-black text-[#d3546f]">
                    {highPriorityPending}
                  </span>
                </div>
              </div>
              <div className="neumorphic-card p-4 border border-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#b8860b]">Due today</p>
                    <p className="mt-0.5 text-xs text-[#6c7a89]">
                      Tasks with today's deadline
                    </p>
                  </div>
                  <span className="text-2xl font-black text-[#b8860b]">
                    {dueTodayCount}
                  </span>
                </div>
              </div>
              <div className="neumorphic-card p-4 border border-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#8e44ad]">Overdue</p>
                    <p className="mt-0.5 text-xs text-[#6c7a89]">
                      Pending tasks past deadline
                    </p>
                  </div>
                  <span className="text-2xl font-black text-[#8e44ad]">
                    {overdueCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 neumorphic-card p-5 sm:p-6">
          <h2 className="neumorphic-heading">Add a study task</h2>
          <p className="neumorphic-subheading">
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
              className="neumorphic-input w-full min-w-0 px-4 py-3 text-sm sm:col-span-2 lg:col-span-1"
              required
            />

            <select
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              aria-label="Task subject"
              className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as Priority)}
              aria-label="Task priority"
              className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
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
              className="neumorphic-input w-full min-w-0 px-4 py-3 text-sm"
            />

            <button
              type="submit"
              disabled={taskSyncing}
              className="neumorphic-btn-primary w-full min-w-0 px-5 py-3 font-bold text-sm"
            >
              {taskSyncing ? "Adding..." : "+ Add task"}
            </button>
          </form>
        </section>

        <section className="mb-6 neumorphic-card p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="neumorphic-heading">Your tasks</h2>
                <p className="neumorphic-subheading">
                  {view === "list"
                    ? "Search, filter, edit, and manage your study plan."
                    : "See what is due each day of the week."}
                </p>
              </div>

              <div
                role="group"
                aria-label="Task view"
                className="neumorphic-segment inline-flex text-sm font-semibold"
              >
                {(["list", "week"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    aria-pressed={view === option}
                    className={`neumorphic-segment-item transition focus:outline-none focus:ring-2 focus:ring-[#5b5bf5]/40 ${
                      view === option ? "active" : "text-[#6c7a89] hover:text-[#1e2224]"
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
                  className="neumorphic-input w-full min-w-0 px-4 py-3 text-sm"
                />

                <select
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  aria-label="Filter by subject"
                  className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
                >
                  <option value="All">All subjects</option>
                  {Array.from(
                    new Set([...SUBJECTS, ...tasks.map((task) => task.subject)])
                  )
                    .filter((subject) => subject !== "All")
                    .map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                </select>

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  aria-label="Filter task status"
                  className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
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
                      className="space-y-3 rounded-[2rem] neumorphic-inset p-4 sm:p-5"
                    >
                      <h3 className="neumorphic-heading">Edit task</h3>

                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        aria-label="Edit task title"
                        className="neumorphic-input w-full min-w-0 px-4 py-3 text-sm"
                        required
                      />

                      <div className="grid gap-3 sm:grid-cols-3">
                        <select
                          value={editSubject}
                          onChange={(event) => setEditSubject(event.target.value)}
                          aria-label="Edit subject"
                          className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
                        >
                          {Array.from(
                            new Set([...SUBJECTS, editSubject])
                          ).map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editPriority}
                          onChange={(event) =>
                            setEditPriority(event.target.value as Priority)
                          }
                          aria-label="Edit priority"
                          className="neumorphic-select w-full min-w-0 px-4 py-3 text-sm"
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
                          className="neumorphic-input w-full min-w-0 px-4 py-3 text-sm"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          type="submit"
                          className="neumorphic-btn-primary px-5 py-2 font-semibold text-sm"
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="neumorphic-btn-ghost px-4 py-1.5 font-semibold text-sm"
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
                    className={`neumorphic-raised transition hover:translate-y-[-2px] focus-within:ring-2 focus-within:ring-[#5b5bf5]/40 focus-within:outline-none ${isOverdue ? "border-[#d3546f]" : "border-transparent"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                        aria-label={`Mark ${task.title} as completed`}
                        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#5b5bf5]"
                      />

                      <div className="min-w-0 flex-1">
                        <p
                          className={`break-words font-semibold ${task.completed ? "text-[#6c7a89] line-through" : "text-[#2d3436]"}`}
                        >
                          {task.title}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="neumorphic-chip px-2.5 py-1 text-xs font-bold text-[#6c7a89]">
                            {task.subject}
                          </span>

                          <span
                            className={`neumorphic-badge px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
                              task.priority === "Low"
                                ? "text-[#27ae60]"
                                : task.priority === "Medium"
                                  ? "text-[#d35400]"
                                  : "text-[#c0392b]"
                            }`}
                          >
                            {task.priority} priority
                          </span>

                          {task.deadline && (
                            <span className="text-xs font-medium text-[#6c7a89]">
                              {task.completed ? "Was due " : "Due "}
                              {formatDeadline(task.deadline)}
                            </span>
                          )}

                          {status === "overdue" && (
                            <span className="neumorphic-badge px-2.5 py-1 text-xs font-bold text-[#c0392b]">
                              Overdue
                            </span>
                          )}
                          {status === "today" && (
                            <span className="neumorphic-badge px-2.5 py-1 text-xs font-bold text-[#b8860b]">
                              Due today
                            </span>
                          )}
                          {status === "soon" && (
                            <span className="neumorphic-badge px-2.5 py-1 text-xs font-bold text-[#d35400]">
                              Due soon
                            </span>
                          )}

                          {task.completed && (
                            <span className="neumorphic-badge px-2.5 py-1 text-xs font-bold text-[#27ae60]">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => startEditing(task)}
                        aria-label={`Edit ${task.title}`}
                        className="neumorphic-btn-ghost px-3 py-1.5 text-sm font-semibold text-[#5b5bf5] underline underline-offset-4"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="neumorphic-btn-ghost px-3 py-1.5 text-sm font-semibold text-[#c0392b] underline underline-offset-4"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {visibleTasks.length === 0 && (
              <div className="rounded-[2rem] neumorphic-inset p-8 text-center">
                <p className="text-lg font-bold text-[#1e2224]">No matching tasks</p>
                <p className="mt-1 text-sm text-[#6c7a89]">
                  Try a different search or filter, or add a new study task.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("All");
                    setSubjectFilter("All");
                  }}
                  className="mt-4 neumorphic-btn-primary px-5 py-2 text-sm font-semibold"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          )}
        </section>

        <footer className="py-8 text-center text-sm text-[#6c7a89]">
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
    <div className="group relative overflow-hidden rounded-[2rem] neumorphic-card p-5 transition-all duration-300 hover:scale-[1.01] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold tracking-wide text-[#6c7a89]">
          {label}
        </p>

        <span className="h-2.5 w-2.5 rounded-full bg-[#5b5bf5] ring-4 ring-[#5b5bf5]/20 transition-transform duration-300 group-hover:scale-125" />
      </div>

      <p className="neumorphic-stat-value mt-5">{value}</p>

      <p className="mt-2 text-xs font-medium leading-relaxed text-[#6c7a89]">
        {detail}
      </p>

      <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#d7dbe0] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]">
        <div className="animate-progress-fill h-full w-1/3 rounded-full neumorphic-progress-bar" />
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
        const isToday = dateString === today;

        return (
          <section
            key={dateString}
            className={`neumorphic-raised min-h-[160px] p-3 transition hover:translate-y-[-2px] focus-within:ring-2 focus-within:ring-[#5b5bf5]/40 focus-within:outline-none ${
              isToday ? "border-[#5b5bf5]" : "border-transparent"
            }`}
            aria-label={date.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-[#1e2224]">
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </h3>
              <span className="text-[10px] font-medium text-[#6c7a89]">
                {date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="mt-1 space-y-2">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onEditTask(task)}
                  className="neumorphic-inset rounded-lg px-2 py-2 text-left text-xs leading-tight transition group-hover:scale-[1.01]"
                  title="Edit task"
                >
                  <span className="block truncate font-semibold text-[#1e2224]">
                    {task.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#6c7a89]">
                    {task.subject}
                  </span>
                </button>
              ))}
              {dayTasks.length === 0 && (
                <p className="pt-1 text-xs text-[#95a5a9]">No tasks due</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
