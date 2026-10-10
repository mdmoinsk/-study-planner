"use client";

import { useState } from "react";

type Task = {
  id: number;
  title: string;
  completed: boolean;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: "Revise Computer Networks", completed: false },
    { id: 2, title: "Practice JavaScript", completed: false },
  ]);

  const [newTask, setNewTask] = useState("");

  function addTask() {
    if (newTask.trim() === "") return;

    const task: Task = {
      id: Date.now(),
      title: newTask.trim(),
      completed: false,
    };

    setTasks([...tasks, task]);
    setNewTask("");
  }

  function toggleTask(id: number) {
    setTasks(
      tasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  }

  function deleteTask(id: number) {
    setTasks(tasks.filter((task) => task.id !== id));
  }

  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase text-blue-600">
            Student Workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Student Study Planner
          </h1>

          <p className="mt-2 text-slate-600">
            Organize your tasks and stay on track.
          </p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Tasks</p>
            <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {completedCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">My Study Tasks</h2>

          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              addTask();
            }}
          >
            <input
              type="text"
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              placeholder="Enter a study task..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3"
            />

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Add Task
            </button>
          </form>

          <ul className="mt-6 space-y-3">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="h-5 w-5"
                />

                <span
                  className={`flex-1 ${
                    task.completed ? "text-slate-400 line-through" : ""
                  }`}
                >
                  {task.title}
                </span>

                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  className="text-sm font-medium text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          {tasks.length === 0 && (
            <p className="mt-6 text-center text-slate-500">
              No tasks yet. Add your first study task above!
            </p>
          )}
        </div>
      </div>
    </main>
  );
}