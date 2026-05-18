"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useUserTasks,
  useCreateTask,
  useUpdateTask,
  useTaskCounts,
  UserTask,
} from "@/hooks/useApi";
import {
  Phone,
  Send,
  FileText,
  Search,
  Settings,
  Plus,
  X,
  Clock,
  Check,
  MoreHorizontal,
  GripVertical,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { withFlagGate } from "@/components/ui/flag-gate";
import { useFeatureFlag } from "@/context/FeatureFlagContext";

type ColumnKey = "reach_out" | "follow_up" | "prepare" | "investigate" | "admin";

const COLUMNS: { key: ColumnKey; label: string; icon: typeof Phone }[] = [
  { key: "reach_out", label: "Reach Out", icon: Phone },
  { key: "follow_up", label: "Follow Up", icon: Send },
  { key: "prepare", label: "Prepare", icon: FileText },
  { key: "investigate", label: "Investigate", icon: Search },
  { key: "admin", label: "Admin", icon: Settings },
];

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-l-red-400",
  medium: "border-l-amber-400",
  low: "border-l-slate-300",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

type AccountGroup = {
  account_id: string | null;
  account_name: string | null;
  tasks: UserTask[];
  highestPriority: "high" | "medium" | "low";
};

function AccountGroupHeader({ group, expanded, onToggle }: {
  group: AccountGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
    >
      <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[group.highestPriority]}`} />
      <Link
        href={`/accounts/${group.account_id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate hover:text-sky-600"
      >
        {group.account_name}
      </Link>
      <span className="ml-auto text-[10px] text-slate-400 font-medium">{group.tasks.length}</span>
    </button>
  );
}

function TaskCard({
  task,
  onComplete,
  onDismiss,
  onSnooze,
  onDragStart,
}: {
  task: UserTask;
  onComplete: (taskId: string, note: string) => void;
  onDismiss: (taskId: string) => void;
  onSnooze: (taskId: string, preset: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}) {
  const [showComplete, setShowComplete] = useState(false);
  const [note, setNote] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.task_id)}
      className={`group relative border-l-4 ${PRIORITY_BORDER[task.priority]} rounded-md bg-white dark:bg-slate-800 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 mt-0.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        <div className="flex-1 min-w-0">
          {task.account_name && (
            <Link
              href={`/accounts/${task.account_id}`}
              className="text-xs text-sky-600 hover:underline truncate block"
            >
              {task.account_name}
            </Link>
          )}
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug mt-0.5">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
            {task.source && (
              <span className="text-[10px] text-slate-400 truncate">
                {task.source.replace("signal:", "").replace("gong:", "").replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setShowComplete(true)}
            className="p-1 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
            title="Complete"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDismiss(task.task_id)}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 z-20 bg-white dark:bg-slate-800 border rounded-md shadow-lg py-1 w-36">
                <button
                  onClick={() => { onSnooze(task.task_id, "tomorrow"); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Clock className="w-3 h-3 inline mr-1.5" />Snooze — tomorrow
                </button>
                <button
                  onClick={() => { onSnooze(task.task_id, "3d"); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Clock className="w-3 h-3 inline mr-1.5" />Snooze — 3 days
                </button>
                <button
                  onClick={() => { onSnooze(task.task_id, "1wk"); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Clock className="w-3 h-3 inline mr-1.5" />Snooze — 1 week
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showComplete && (
        <div className="mt-2 border-t pt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note (optional)"
            className="w-full text-xs border rounded p-1.5 resize-none h-14 bg-slate-50 dark:bg-slate-900"
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => { onComplete(task.task_id, note); setShowComplete(false); setNote(""); }}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Done
            </button>
            <button
              onClick={() => { setShowComplete(false); setNote(""); }}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAdd({ columnType, onCreate }: { columnType: ColumnKey; onCreate: (title: string, col: ColumnKey) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    if (title.trim()) {
      onCreate(title.trim(), columnType);
      setTitle("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors"
      >
        <Plus className="w-3 h-3" /> Add task
      </button>
    );
  }

  return (
    <div className="p-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") { setOpen(false); setTitle(""); } }}
        placeholder="Task title..."
        className="w-full text-xs border rounded px-2 py-1.5 bg-white dark:bg-slate-900"
      />
      <div className="flex gap-1.5 mt-1.5">
        <button onClick={handleSubmit} className="px-2 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700">Add</button>
        <button onClick={() => { setOpen(false); setTitle(""); }} className="px-2 py-1 text-xs text-slate-500">Cancel</button>
      </div>
    </div>
  );
}

function TasksPage() {
  useFeatureFlag("page_tasks");
  const { data: tasks = [], isLoading } = useUserTasks("open");
  const { data: counts } = useTaskCounts();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<ColumnKey, UserTask[]> = {
      reach_out: [],
      follow_up: [],
      prepare: [],
      investigate: [],
      admin: [],
    };
    for (const t of tasks) {
      if (grouped[t.column_type]) {
        grouped[t.column_type].push(t);
      }
    }
    return grouped;
  }, [tasks]);

  const groupedByColumn = useMemo(() => {
    const result: Record<ColumnKey, AccountGroup[]> = {
      reach_out: [], follow_up: [], prepare: [], investigate: [], admin: [],
    };
    for (const col of Object.keys(tasksByColumn) as ColumnKey[]) {
      const byAccount = new Map<string, UserTask[]>();
      for (const t of tasksByColumn[col]) {
        const key = t.account_id ?? "__none__";
        if (!byAccount.has(key)) byAccount.set(key, []);
        byAccount.get(key)!.push(t);
      }
      result[col] = Array.from(byAccount.entries()).map(([accId, accTasks]) => ({
        account_id: accId === "__none__" ? null : accId,
        account_name: accTasks[0].account_name,
        tasks: accTasks,
        highestPriority: accTasks.some(t => t.priority === "high") ? "high"
          : accTasks.some(t => t.priority === "medium") ? "medium" : "low",
      }));
    }
    return result;
  }, [tasksByColumn]);

  const handleComplete = useCallback((taskId: string, resolutionNote: string) => {
    updateTask.mutate({ task_id: taskId, status: "done", resolution_note: resolutionNote || undefined });
  }, [updateTask]);

  const handleDismiss = useCallback((taskId: string) => {
    updateTask.mutate({ task_id: taskId, status: "dismissed" });
  }, [updateTask]);

  const handleSnooze = useCallback((taskId: string, preset: string) => {
    updateTask.mutate({ task_id: taskId, snooze_preset: preset });
  }, [updateTask]);

  const handleCreate = useCallback((title: string, columnType: ColumnKey) => {
    createTask.mutate({ title, column_type: columnType });
  }, [createTask]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetColumn: ColumnKey) => {
    e.preventDefault();
    if (draggedId) {
      updateTask.mutate({ task_id: draggedId, column_type: targetColumn });
      setDraggedId(null);
    }
  }, [draggedId, updateTask]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Task Board</h1>
          {counts && (
            <span className="text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
              {counts.total_open} open
            </span>
          )}
        </div>
        {counts && counts.high_priority > 0 && (
          <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
            {counts.high_priority} high priority
          </span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto min-h-0">
        {COLUMNS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, key)}
            className="flex flex-col bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-slate-200/60 dark:border-slate-700/60 min-h-[300px]"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
              <Icon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {tasksByColumn[key].length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {groupedByColumn[key].map((group) => {
                if (group.tasks.length === 1) {
                  return (
                    <TaskCard
                      key={group.tasks[0].task_id}
                      task={group.tasks[0]}
                      onComplete={handleComplete}
                      onDismiss={handleDismiss}
                      onSnooze={handleSnooze}
                      onDragStart={handleDragStart}
                    />
                  );
                }
                const groupKey = `${key}-${group.account_id}`;
                const isExpanded = expandedGroups.has(groupKey);
                return (
                  <div key={groupKey} className="space-y-1">
                    <AccountGroupHeader
                      group={group}
                      expanded={isExpanded}
                      onToggle={() => toggleGroup(groupKey)}
                    />
                    {isExpanded && group.tasks.map(task => (
                      <TaskCard
                        key={task.task_id}
                        task={task}
                        onComplete={handleComplete}
                        onDismiss={handleDismiss}
                        onSnooze={handleSnooze}
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-200/60 dark:border-slate-700/60">
              <QuickAdd columnType={key} onCreate={handleCreate} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default withFlagGate(TasksPage, "page_tasks");
