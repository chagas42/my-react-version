type PriorityLevel = 0 | 1 | 2;

interface scheduleCallbackProps {
  priorityLevel: PriorityLevel;
  callback: () => void;
}

interface Task {
  id: number;
  expiration: number;
  priorityLevel: PriorityLevel;
  callback: () => void;
  startTime: number;
  sortIndex: number;
}

//PRECISO AGENDAR TASKS, COM AS SEGUINTES CARACTERISTICAS:
// {
//   id,
//   expiration,
//   priorityLevel,
//   callback,
//   startTime,
//   sortIndex,
// }

const HIGH: PriorityLevel = 0;
const LOW: PriorityLevel = 1;
const NORMAL: PriorityLevel = 2;
const FRAME_INTERVAL = 5;

let LOGS = [];
let taskIdCounter = 1;
let startTimer = -1;

const PRIORITY_TO_MS = {
  [HIGH]: -1,
  [LOW]: 5000,
  [NORMAL]: 10000,
};

const TASKQUEUE: Array<Task> = [];

//enfileira as tasks em ordem de prioridade.
function scheduleCallback({
  priorityLevel,
  callback,
}: scheduleCallbackProps): Task {
  const currentTime = performance.now();
  const startTime = currentTime;
  let timeout = PRIORITY_TO_MS[priorityLevel] || NORMAL;

  let expirationTime = currentTime + timeout;

  let newTask: Task = {
    id: taskIdCounter++,
    expiration: expirationTime,
    callback,
    priorityLevel,
    sortIndex: -1,
    startTime,
  };

  newTask.sortIndex = expirationTime;

  push(TASKQUEUE, newTask);
  //TODO - Request host callback, schedule with browser another time to work
  return newTask;
}

function push(taskqueue: Array<Task>, task: Task) {
  //TODO - IMPL MINIHEAP TREE
  taskqueue.push(task);
  taskqueue.sort((a, b) => a.sortIndex - b.sortIndex);
}

const NewTask = (name: string, ms: number) => {
  return () => {
    LOGS.push(`start ${name}`);
    advanceTime(ms);
    LOGS.push(`end ${name}`);
  };
};

function advanceTime(ms: number) {
  const deadline = performance.now() + ms;

  while (performance.now() < deadline) {
    console.log("advanceTime");
  }
}

scheduleCallback({ priorityLevel: LOW, callback: NewTask("A", 100) });
scheduleCallback({ priorityLevel: HIGH, callback: NewTask("B", 5) });

function performWorkUntilDeadline() {
  let currentTime = performance.now();
  startTimer = currentTime;
  let hasMoreWork = true;

  try {
    hasMoreWork = flushWork(currentTime);
  } finally {
    if (hasMoreWork) {
      schedulePerformWorkUntilDeadline();
    }
  }
}

function workLoop(initialTimer: number): boolean {
  let currentTask = TASKQUEUE[0];
  let currentTime = initialTimer;

  while (currentTask != null) {
    if (currentTask.expiration > currentTime && shouldYeldToHost()) {
      return true;
    }

    const callback = currentTask.callback;

    callback();

    TASKQUEUE.shift();
    currentTime = performance.now();
    currentTask = TASKQUEUE[0];
  }

  return false;
}

function flushWork(initialTimer: number): boolean {
  try {
    return workLoop(initialTimer);
  } finally {
  }
}

function schedulePerformWorkUntilDeadline() {
  setImmediate(performWorkUntilDeadline);
}

function shouldYeldToHost() {
  let timeElapsed = performance.now() - startTimer;

  if (timeElapsed < FRAME_INTERVAL) {
    return false;
  }

  return true;
}
