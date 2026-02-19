type Fiber = {
  key: string;
  type: string;
  lanes: number;
  childLanes: number;

  //parents
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
};

const NoLanes = 0;
const SyncLane = 1;

function createFiber(key, type, lanes = NoLanes, childLanes = NoLanes): Fiber {
  return {
    key,
    type,
    lanes,
    childLanes,
    return: null,
    child: null,
    sibling: null,
  };
}

const root = createFiber("root", "HostRoot", NoLanes, SyncLane);
const app = createFiber("app", "App", NoLanes, NoLanes);
const section = createFiber("section", "div", NoLanes, SyncLane);
const button = createFiber("button", "button", SyncLane, NoLanes);
const text = createFiber("text", "span", NoLanes, NoLanes);

root.child = app;
app.return = root;
app.child = section;
section.return = app;
section.child = button;
button.return = section;
button.sibling = text;
text.return = section;

const RENDERED_NODES = [];

function beginWork(fiber: Fiber): Fiber {
  if (fiber.lanes === NoLanes && fiber.childLanes === NoLanes) {
    //bailout
    return null;
  }

  RENDERED_NODES.push(fiber.key);
  return fiber.child;
}

function workLoop(fiber: Fiber) {
  let nextUnitOfWork = fiber;
  while (nextUnitOfWork) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
}

function performUnitOfWork(fiber: Fiber): Fiber {
  const next = beginWork(fiber);

  if (next) {
    return next;
  }

  return fiber.sibling;
}

workLoop(root);

console.log(RENDERED_NODES);
