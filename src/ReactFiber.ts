import { NORMAL, scheduleCallback } from "./scheduler";

export type Lane = number;

export type Fiber = {
  key: string;
  type: string;
  lanes: Lane;
  childLanes: Lane;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
};

export const NoLanes = 0;
export const SyncLane = 1;

export function createFiber(
  key: string,
  type: string,
  lanes: Lane = NoLanes,
  childLanes: Lane = NoLanes,
): Fiber {
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

export function appendChild(parent: Fiber, child: Fiber): Fiber {
  child.return = parent;

  if (!parent.child) {
    parent.child = child;
    return child;
  }

  let sibling = parent.child;
  while (sibling.sibling) {
    sibling = sibling.sibling;
  }

  sibling.sibling = child;
  return child;
}

export function beginWork(fiber: Fiber): Fiber | null {
  if (fiber.lanes === NoLanes && fiber.childLanes === NoLanes) {
    return null;
  }

  fiber.lanes = NoLanes;
  return fiber.child;
}

export function completeWork(fiber: Fiber): void {
  fiber.childLanes = NoLanes;
}

export function performUnitOfWork(fiber: Fiber): Fiber | null {
  const next = beginWork(fiber);

  if (next) {
    return next;
  }

  let current: Fiber | null = fiber;
  while (current) {
    completeWork(current);

    if (current.sibling) {
      return current.sibling;
    }

    current = current.return;
  }

  return null;
}

export function workLoop(root: Fiber): void {
  let nextUnitOfWork: Fiber | null = root;

  while (nextUnitOfWork) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
}

export function scheduleUpdateOnFiber(fiber: Fiber, lane: Lane = SyncLane) {
  const root = markUpdateLaneFromFiberToRoot(fiber, lane);

  scheduleCallback({
    priorityLevel: NORMAL,
    callback: () => workLoop(root),
  });
}

function markUpdateLaneFromFiberToRoot(fiber: Fiber, lane: Lane): Fiber {
  fiber.lanes = mergeLanes(fiber.lanes, lane);

  let node = fiber;
  let parent = node.return;

  while (parent) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    node = parent;
    parent = node.return;
  }

  return node;
}

function mergeLanes(a: Lane, b: Lane): Lane {
  return a | b;
}
