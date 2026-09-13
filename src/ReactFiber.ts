import { NORMAL, scheduleCallback } from "./scheduler";
import type { Component, Props } from "./types";

export type Lane = number;
export type FiberTag =
  | "HostRoot"
  | "HostComponent"
  | "HostText"
  | "FunctionComponent"
  | "Fragment";

export type Fiber = {
  tag: FiberTag;
  type: unknown;
  key?: string | number;
  lanes: Lane;
  childLanes: Lane;
  pendingProps: Props;
  memoizedProps: Props | null;
  stateNode: HTMLElement | Text | null;
  alternate: Fiber | null;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
};

export const NoLanes = 0;
export const SyncLane = 1;

export function createFiber(
  tag: FiberTag,
  type: unknown,
  pendingProps: Props = {},
  key?: string | number,
): Fiber {
  return {
    tag,
    type,
    key,
    lanes: NoLanes,
    childLanes: NoLanes,
    pendingProps,
    memoizedProps: null,
    stateNode: null,
    alternate: null,
    return: null,
    child: null,
    sibling: null,
  };
}

export function createHostRootFiber(
  container: HTMLElement,
  children: Component[],
): Fiber {
  const root = createFiber("HostRoot", null, { children });
  root.stateNode = container;
  return root;
}

export function createFiberFromElement(
  component: Component | Component[] | null | undefined,
  returnFiber: Fiber | null,
): Fiber | null {
  if (component === null || component === undefined) return null;

  if (typeof component === "string" || typeof component === "number") {
    const fiber = createFiber("HostText", "TEXT_ELEMENT", {
      nodeValue: component.toString(),
    });
    fiber.return = returnFiber;
    return fiber;
  }

  if (Array.isArray(component)) {
    const fiber = createFiber("Fragment", Symbol.for("react.fragment"), {
      children: component,
    });
    fiber.return = returnFiber;
    return fiber;
  }

  const props = component.props || {};
  const key = props.key;
  const tag = getFiberTag(component.tag, props);
  const fiber = createFiber(tag, component.tag, props, key);
  fiber.return = returnFiber;
  return fiber;
}

export function createWorkInProgress(
  current: Fiber | null,
  pendingProps: Props,
): Fiber {
  if (!current) {
    return createFiber("HostRoot", null, pendingProps);
  }

  let workInProgress = current.alternate;

  if (!workInProgress) {
    workInProgress = createFiber(
      current.tag,
      current.type,
      pendingProps,
      current.key,
    );
    workInProgress.stateNode = current.stateNode;
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.child = null;
    workInProgress.sibling = null;
  }

  workInProgress.lanes = current.lanes;
  workInProgress.childLanes = current.childLanes;
  workInProgress.memoizedProps = current.memoizedProps;
  return workInProgress;
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
  if (
    fiber.alternate &&
    fiber.lanes === NoLanes &&
    fiber.childLanes === NoLanes
  ) {
    return null;
  }

  fiber.lanes = NoLanes;

  if (fiber.tag === "FunctionComponent") {
    updateFunctionComponent(fiber);
    return fiber.child;
  }

  reconcileChildren(fiber, getFiberChildren(fiber));
  return fiber.child;
}

export function reconcileChildren(
  returnFiber: Fiber,
  children: Component[],
): void {
  let previousFiber: Fiber | null = null;
  returnFiber.child = null;

  for (const child of children) {
    const newFiber = createFiberFromElement(child, returnFiber);
    if (!newFiber) continue;

    if (!previousFiber) {
      returnFiber.child = newFiber;
    } else {
      previousFiber.sibling = newFiber;
    }

    previousFiber = newFiber;
  }
}

export function completeWork(fiber: Fiber): void {
  fiber.memoizedProps = fiber.pendingProps;
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

export function renderFiberTree(root: Fiber): Fiber {
  root.lanes = mergeLanes(root.lanes, SyncLane);
  workLoop(root);
  return root;
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

function getFiberTag(type: unknown, props: Props): FiberTag {
  if (type === undefined && props.children) {
    return "Fragment";
  }

  if (typeof type === "function") {
    return "FunctionComponent";
  }

  return "HostComponent";
}

function getFiberChildren(fiber: Fiber): Component[] {
  if (
    fiber.tag !== "HostRoot" &&
    fiber.tag !== "HostComponent" &&
    fiber.tag !== "Fragment"
  ) {
    return [];
  }

  const children = fiber.pendingProps.children;

  if (!children) return [];
  if (Array.isArray(children)) return children;

  return [children];
}

function updateFunctionComponent(fiber: Fiber): void {
  if (typeof fiber.type !== "function") return;

  const children = fiber.type(fiber.pendingProps) as
    | Component
    | Component[]
    | null
    | undefined;

  reconcileChildren(fiber, normalizeChildren(children));
}

function normalizeChildren(
  children: Component | Component[] | null | undefined,
): Component[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;

  return [children];
}
