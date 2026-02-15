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
let taskIdCounter = 1;

const PRIORITY_TO_MS = {
  [HIGH]: -1,
  [LOW]: 5000,
  [NORMAL]: 10000,
};

const TASKQUEUE: Array<Task> = [];

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

  return newTask;
}

function push(taskqueue: Array<Task>, task: Task) {
  //precisamos verificar qual o mais recente
  taskqueue.push(task);
  taskqueue.sort((a, b) => a.sortIndex - b.sortIndex);
}

scheduleCallback({ priorityLevel: LOW, callback: () => console.log("oi") });
scheduleCallback({ priorityLevel: HIGH, callback: () => console.log("oi") });
scheduleCallback({ priorityLevel: NORMAL, callback: () => console.log("oi") });
scheduleCallback({ priorityLevel: LOW, callback: () => console.log("oi") });

console.log({ TASKQUEUE });
