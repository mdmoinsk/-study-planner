"use client";

import { useState } from "react";
type Priority = "Low" | "Medium" | "High";

type CalendarTask = {
  id: string | number;
  title: string;
  completed: boolean;
  priority: Priority;
  subject: string;
  deadline: string;
};

type WeeklyCalendarProps<T extends CalendarTask> = {
  tasks: T[];
  today: string;
  onEditTask: (task: T) => void;
};

function toLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

function addDays(value: string, amount: number): string | null {
  const date = toLocalDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(value: string): string | null {
  const date = toLocalDate(value);
  if (!date) return null;
  return addDays(value, -((date.getDay() + 6) % 7));
}

function getDeadlineStatus(
  task: Pick<CalendarTask, "deadline" | "completed">,
  today: string
): "overdue" | "today" | "upcoming" {
  if (task.deadline === today) return "today";
  return task.deadline < today ? "overdue" : "upcoming";
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

const PRIORITY_TEXT: Record<Priority, string> = {
  High: "text-rose-300",
  Medium: "text-amber-300",
  Low: "text-emerald-300",
};

function format(value: string, options: Intl.DateTimeFormatOptions) {
  return toLocalDate(value)?.toLocaleDateString("en-IN", options) ?? "";
}

export default function WeeklyCalendar<T extends CalendarTask>({
  tasks,
  today,
  onEditTask,
}: WeeklyCalendarProps<T>) {
  const [weekOffset, setWeekOffset] = useState(0);

  const thisWeekStart = today ? getWeekStart(today) : null;
  const weekStart = thisWeekStart
    ? addDays(thisWeekStart, weekOffset * 7)
    : null;

  if (!weekStart) return null;

  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  ).filter((day): day is string => day !== null);

  const weekEnd = days[days.length - 1];
  const sameYear = weekStart.slice(0, 4) === weekEnd.slice(0, 4);

  const rangeLabel = `${format(weekStart, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })} – ${format(weekEnd, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  const tasksForDay = (day: string) =>
    tasks
      .filter((task) => task.deadline === day)
      .sort(
        (a, b) =>
          Number(a.completed) - Number(b.completed) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.title.localeCompare(b.title)
      );

  const weekTaskCount = days.reduce(
    (total, day) => total + tasksForDay(day).length,
    0
  );
  const unscheduledCount = tasks.filter((task) => !task.deadline).length;

  const navButton =
    "rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold" aria-live="polite">
          {rangeLabel}
        </h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value - 1)}
            className={navButton}
          >
            Previous week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className={navButton}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value + 1)}
            className={navButton}
          >
            Next week
          </button>
        </div>
      </div>

      {weekTaskCount === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <p className="font-semibold">Nothing due this week</p>
          <p className="mt-1 text-sm text-slate-500">
            Tasks appear on this calendar on their deadline day.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-7">
          {days.map((day) => {
            const dayTasks = tasksForDay(day);
            const isToday = day === today;

            return (
              <section
                key={day}
                aria-label={format(day, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                className={`min-w-0 rounded-xl border p-3 ${
                  isToday
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-white/10 bg-slate-950/40"
                }`}
              >
                <p className="text-sm font-bold">
                  {format(day, { weekday: "short" })}
                  <span className="ml-2 font-medium text-slate-400">
                    {format(day, { day: "numeric", month: "short" })}
                  </span>
                </p>

                <ul className="mt-2 space-y-2">
                  {dayTasks.length === 0 && (
                    <li className="text-xs text-slate-500">No tasks</li>
                  )}

                  {dayTasks.map((task) => {
                    const status = getDeadlineStatus(task, today);

                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          aria-label={`Edit task: ${task.title}`}
                          className="w-full rounded-lg border border-white/10 bg-slate-900/80 p-2 text-left text-xs transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        >
                          <span
                            className={`block break-words font-semibold ${
                              task.completed
                                ? "text-slate-500 line-through"
                                : ""
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={PRIORITY_TEXT[task.priority]}>
                              {task.priority}
                            </span>
                            {task.completed && (
                              <span className="text-emerald-300">Done</span>
                            )}
                            {status === "overdue" && (
                              <span className="text-rose-300">Overdue</span>
                            )}
                            {status === "today" && (
                              <span className="text-amber-300">Due today</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {unscheduledCount > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {unscheduledCount} {unscheduledCount === 1 ? "task has" : "tasks have"}{" "}
          no deadline and {unscheduledCount === 1 ? "isn't" : "aren't"} shown
          here.
        </p>
      )}
    </div>
  );
}