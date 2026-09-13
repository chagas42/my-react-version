import { scheduleUpdateOnFiber } from "./ReactFiber";
import type { Fiber } from "./ReactFiber";
import type { Component, Props } from "./types";

export type Hook = {
  memoizedState: unknown;
  next: Hook | null;
};

type Effect = {
  callback: () => void | (() => void);
  cleanup: (() => void) | undefined;
};

let currentlyRendering: Fiber | null = null;
let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;
let pendingEffects: Effect[] = [];

export function isRenderingWithFiber(): boolean {
  return currentlyRendering !== null;
}

export function renderWithHooks(
  fiber: Fiber,
  Component: (props: Props) => Component | Component[] | null | undefined,
  props: Props,
) {
  currentlyRendering = fiber;
  currentHook = (fiber.alternate?.memoizedState as Hook | null) ?? null;
  workInProgressHook = null;
  fiber.memoizedState = null;

  try {
    return Component(props);
  } finally {
    currentlyRendering = null;
    currentHook = null;
    workInProgressHook = null;
  }
}

function nextHook(): Hook {
  const fiber = currentlyRendering;
  if (!fiber) {
    throw new Error("hook chamado fora do render de um componente");
  }

  const hook: Hook = {
    memoizedState: currentHook ? currentHook.memoizedState : null,
    next: null,
  };

  if (workInProgressHook) {
    workInProgressHook.next = hook;
  } else {
    fiber.memoizedState = hook;
  }

  workInProgressHook = hook;
  currentHook = currentHook?.next ?? null;
  return hook;
}

type Cell<T> = { value: T };

function isCell<T>(state: unknown): state is Cell<T> {
  return typeof state === "object" && state !== null && "value" in state;
}

export function useState<T>(
  initial: T | (() => T),
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  return useReducer<T, T | ((prev: T) => T)>(
    (prev, action) =>
      typeof action === "function" ? (action as (p: T) => T)(prev) : action,
    initial as T,
  );
}

export function useReducer<T, A>(
  reducer: (state: T, action: A) => T,
  initial: T | (() => T),
): readonly [T, (action: A) => void] {
  const hook = nextHook();
  const fiber = currentlyRendering as Fiber;

  if (!isCell<T>(hook.memoizedState)) {
    const value =
      typeof initial === "function" ? (initial as () => T)() : initial;
    hook.memoizedState = { value } satisfies Cell<T>;
  }

  const cell = hook.memoizedState as Cell<T>;

  function dispatch(action: A) {
    cell.value = reducer(cell.value, action);
    scheduleUpdateOnFiber(fiber);
  }

  return [cell.value, dispatch] as const;
}

export function useRef<T>(initial: T): { current: T } {
  const hook = nextHook();

  if (!isCell<{ current: T }>(hook.memoizedState)) {
    hook.memoizedState = { value: { current: initial } };
  }

  return (hook.memoizedState as Cell<{ current: T }>).value;
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const hook = nextHook();
  const previous = hook.memoizedState as Cell<[unknown[], T]> | null;

  if (isCell<[unknown[], T]>(previous) && !depsChanged(previous.value[0], deps)) {
    return previous.value[1];
  }

  const value = factory();
  hook.memoizedState = { value: [deps, value] };
  return value;
}

export function useEffect(
  callback: () => void | (() => void),
  deps?: unknown[],
): void {
  const hook = nextHook();
  const previous = hook.memoizedState as Cell<
    [unknown[] | undefined, (() => void) | undefined]
  > | null;

  const prevDeps = isCell(previous) ? previous.value[0] : undefined;
  const cleanup = isCell(previous) ? previous.value[1] : undefined;
  const shouldRun = !isCell(previous) || depsChanged(prevDeps, deps);

  hook.memoizedState = { value: [deps, cleanup] };

  if (shouldRun) {
    pendingEffects.push({ callback, cleanup });
    effectTargets.set(pendingEffects[pendingEffects.length - 1], hook);
  }
}

const effectTargets = new WeakMap<Effect, Hook>();

export function flushPassiveEffects(): void {
  const effects = pendingEffects;
  pendingEffects = [];

  for (const effect of effects) {
    effect.cleanup?.();
    const cleanup = effect.callback() || undefined;

    const hook = effectTargets.get(effect);
    if (hook && isCell(hook.memoizedState)) {
      const cell = hook.memoizedState as Cell<
        [unknown[] | undefined, (() => void) | undefined]
      >;
      cell.value = [cell.value[0], cleanup];
    }
  }
}

function depsChanged(previous?: unknown[], next?: unknown[]): boolean {
  if (!previous || !next) return true;
  if (previous.length !== next.length) return true;
  return next.some((dep, i) => dep !== previous[i]);
}

export function useImperativeHandle<T>(
  ref: { current: T | null },
  createHandle: () => T,
  deps?: unknown[],
): void {
  const hook = nextHook();
  const previous = hook.memoizedState as Cell<unknown[] | undefined> | null;

  if (!isCell(previous) || depsChanged(previous.value, deps)) {
    hook.memoizedState = { value: deps };
    ref.current = createHandle();
  }
}
