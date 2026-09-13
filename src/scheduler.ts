export type PriorityLevel = 0 | 1 | 2;
export type TaskCallback = () => TaskCallback | void;

export type ScheduleCallbackProps = {
  priorityLevel: PriorityLevel;
  callback: TaskCallback;
};

export type Task = {
  id: number;
  expiration: number;
  priorityLevel: PriorityLevel;
  callback: TaskCallback;
  startTime: number;
  sortIndex: number;
};

export const HIGH: PriorityLevel = 0;
export const LOW: PriorityLevel = 1;
export const NORMAL: PriorityLevel = 2;
const FRAME_INTERVAL = 5;

let taskIdCounter = 1;
let isScheduleRunning = false;
let startTimer = -1;

const PRIORITY_TO_MS = {
  [HIGH]: -1,
  [LOW]: 5000,
  [NORMAL]: 10000,
};

const TASKQUEUE: Array<Task> = [];

export function scheduleCallback({
  priorityLevel,
  callback,
}: ScheduleCallbackProps): Task {
  const currentTime = performance.now();
  const startTime = currentTime;
  const timeout = PRIORITY_TO_MS[priorityLevel] ?? PRIORITY_TO_MS[NORMAL];

  const expirationTime = currentTime + timeout;

  const newTask: Task = {
    id: taskIdCounter++,
    expiration: expirationTime,
    callback,
    priorityLevel,
    sortIndex: -1,
    startTime,
  };

  newTask.sortIndex = expirationTime;

  push(TASKQUEUE, newTask);
  if (!isScheduleRunning) {
    isScheduleRunning = true;
    schedulePerformWorkUntilDeadline();
  }
  return newTask;
}

function push(taskqueue: Array<Task>, task: Task) {
  taskqueue.push(task);
  taskqueue.sort((a, b) => a.sortIndex - b.sortIndex);
}

function performWorkUntilDeadline() {
  const currentTime = performance.now();
  startTimer = currentTime;
  let hasMoreWork = true;

  try {
    hasMoreWork = flushWork(currentTime);
  } finally {
    if (hasMoreWork) {
      schedulePerformWorkUntilDeadline();
    } else {
      isScheduleRunning = false;
    }
  }
}

/** Roda tasks da fila até acabar o tempo do frame ou a fila. */
function flushTaskQueue(initialTimer: number): boolean {
  let currentTask = TASKQUEUE[0];
  let currentTime = initialTimer;

  while (currentTask != null) {
    if (currentTask.expiration > currentTime && shouldYieldToHost()) {
      return true;
    }

    const callback = currentTask.callback;

    const continuationCallback = callback();

    if (typeof continuationCallback === "function") {
      currentTask.callback = continuationCallback;
      return true;
    } else {
      TASKQUEUE.shift();
    }

    currentTime = performance.now();
    currentTask = TASKQUEUE[0];
  }

  return false;
}

function flushWork(initialTimer: number): boolean {
  return flushTaskQueue(initialTimer);
}

function schedulePerformWorkUntilDeadline() {
  setTimeout(performWorkUntilDeadline, 0);
}

export function shouldYieldToHost() {
  const timeElapsed = performance.now() - startTimer;

  if (timeElapsed < FRAME_INTERVAL) {
    return false;
  }

  return true;
}
