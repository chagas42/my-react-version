import React from "./React";
import ReactDOM from "./ReactDOM";
import type { Children } from "./types";

type State<T> = T | (() => T);
type UpdateFunction<T> = (prevState: T) => T;
type Callback = () => undefined | (() => void);

export function useState<T>(
  initialState: State<T>
): readonly [T, (newState: T | ((prevState: T) => T)) => void] {
  const hookIndex = React.getHookIndex();
  let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

  if (typeof initialState === "function" && !state) {
    state = (initialState as () => T)();
  } else if (!state) {
    state = initialState as T;
    React.setStateForIndex(hookIndex, state, hookNode);
  }

  function setState(newState: T | UpdateFunction<T>) {
    if (typeof newState === "function") {
      React.enqueueUpdate(newState as UpdateFunction<T>, hookIndex, hookNode);
    } else {
      React.directUpdate(() => newState, hookIndex, hookNode);
      state = newState;
    }

    ReactDOM.rerender();
  }

  return [state, setState];
}

export function useEffect(callback: Callback, dependencies: unknown[]) {
  const hookIndex = React.getHookIndex();
  const [prevState, hookNode] = React.getStateForIndex<
    [unknown[], ReturnType<Callback> | undefined, boolean]
  >(hookIndex) || [[], undefined, false];

  const [prevDependencies, prevCleanupFunction, isMounted] = prevState || [];
  if (dependenciesChanged(prevDependencies, dependencies) || !isMounted) {
    if (prevCleanupFunction) {
      prevCleanupFunction();
    }

    const newCleanupFunction = callback();
    React.setStateForIndex(
      hookIndex,
      [dependencies, newCleanupFunction, true],
      hookNode
    );
  }
}

function dependenciesChanged(
  prevDependencies: unknown[],
  dependencies: unknown[]
) {
  if (!prevDependencies || prevDependencies.length !== dependencies.length) {
    return true;
  }

  if (prevDependencies.length === 0) return false;
  if (!prevDependencies) return true;

  return !dependencies.every(
    (dependency, index) => dependency === prevDependencies[index]
  );
}

export function useRef<T>(initialValue: T) {
  const hookIndex = React.getHookIndex();
  let [ref, hookNode] = React.getStateForIndex(hookIndex);

  if (!ref) {
    ref = { current: initialValue };
    React.setStateForIndex(hookIndex, ref, hookNode);
  }

  return ref as { current: T };
}

export function use<T>(
  resource: ReturnType<typeof createContext<T>> | (() => Promise<T>),
  key: string
): T {
  const hookNode = React.getCurrentNode();
  if (typeof resource === "function") {
    return React.createResource(resource, key, hookNode);
  }

  return useContext(resource);
}

export function useReducer<T, A>(
  reducer: (state: T, action: A) => T,
  initialState: T
): [T, (action: A) => void] {
  const hookIndex = React.getHookIndex();
  let [state, hookNode] = React.getStateForIndex<T>(hookIndex);

  if (!state) {
    state = initialState;
    React.setStateForIndex(hookIndex, state, hookNode);
  }

  function dispatch(action: A) {
    const newState = reducer(state, action);
    React.enqueueUpdate(() => newState, hookIndex, hookNode);
    state = newState;
    ReactDOM.rerender();
  }

  return [state, dispatch];
}

export function useMemo<T>(factory: () => T, dependencies: unknown[]): T {
  const hookIndex = React.getHookIndex();
  const [prevState, hookNode] =
    React.getStateForIndex<[unknown[], T]>(hookIndex);

  const [prevDependencies, memoizedValue] = prevState || [[], factory()];
  if (dependenciesChanged(prevDependencies, dependencies)) {
    const value = factory();
    React.setStateForIndex(hookIndex, [dependencies, value], hookNode);
    return value;
  }

  return memoizedValue;
}

// biome-ignore lint/suspicious/noExplicitAny: This is a custom implementation
export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: unknown[]
): T {
  return useMemo(() => callback, dependencies);
}

export function createContext<T>(defaultValue: T) {
  const contextId = Symbol("context");

  return {
    _contextId: contextId,
    _currentValue: defaultValue,
    Provider(props: { children?: Children; value: T }) {
      const hookNode = React.getCurrentNode();
      React.setContextValue(contextId, props.value ?? defaultValue, hookNode);
      return props.children ?? [];
    },
  };
}

export function useContext<T>(context: {
  _contextId: symbol;
  _currentValue: T;
}): T {
  const hookNode = React.getCurrentNode();
  return React.getClosestContextValue<T>(
    context._contextId,
    context._currentValue,
    hookNode
  );
}

export function useImperativeHandle<T>(
  ref: { current: T | null },
  createHandle: () => T,
  dependencies?: unknown[]
) {
  const hookIndex = React.getHookIndex();
  const [prevDependencies, hookNode] =
    React.getStateForIndex<unknown[]>(hookIndex);
  if (dependenciesChanged(prevDependencies, dependencies)) {
    React.setStateForIndex(hookIndex, dependencies, hookNode);
    ref.current = createHandle();
  }
}
