import { tasksType } from "~/server/db/schema";

export function AddNewTask({
  onNewTask = () => {},
}: {
  onNewTask?: (task: tasksType) => void;
}) {
  const addTask = (name: string) => {
    fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((res) => {
      if (res.ok) {
        res.json().then((task) => {
          onNewTask(task);
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black">
      <input
        placeholder="Add new task"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            addTask(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
