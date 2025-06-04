import ReactDOM from "./ReactDOM";
import { mergeProps, isPromise } from "./helpers";
import type { Component, Props, SyncTag } from "./types";

type HookNode = {
  id: string;
  hooks: unknown[];
  hookIndex: number;
  children: Map<string, HookNode>;
  parent?: HookNode;
  contexts: Map<symbol, unknown>;
  updateQueue: (() => void)[];
};

export function React() {
  const rootNode: HookNode = createNode("root");
  let currentNode: HookNode = rootNode;
  enterComponent("root");

  function getCurrentNode() {
    if (!currentNode) {
      throw new Error(
        "No current node found. Ensure you are inside a component."
      );
    }

    return currentNode;
  }

  function debugComponentTree(node: HookNode = rootNode, depth = 0) {
    const indent = "  ".repeat(depth + 1);
    console.log(`
    ${indent}Component: ${node.id} ${node.parent ? `-> ${node.parent.id}` : ""}
    ${indent}   Hooks: ${node.hooks.length}
    ${indent}   Hook Index: ${node.hookIndex}
    ${indent}   Children: ${node.children.size}
    ${indent}   Contexts: ${node.contexts.size}
    ${indent}   Update Queue: ${node.updateQueue.length}
    `);

    for (const child of node.children.values()) {
      debugComponentTree(child, depth + 1);
    }
  }

  const suspenseMap: Map<
    string,
    Map<string | number, Promise<unknown> | unknown>
  > = new Map();

  function getCurrentSuspenseBoundary(hookNode: HookNode) {
    let _node = hookNode;
    const item = suspenseMap.get(hookNode?.id || "");

    if (item) {
      return item;
    }

    while (_node) {
      const item = suspenseMap.get(_node.id);
      if (item) {
        return item;
      }

      _node = _node.parent;
    }

    throw new Error(
      "No Suspense boundary found when calling getCurrentSuspenseBoundary"
    );
  }

  function createNode(id: string, parent?: HookNode): HookNode {
    return {
      id,
      hooks: [],
      hookIndex: 0,
      parent,
      children: new Map(),
      contexts: new Map(),
      updateQueue: [],
    };
  }

  function enterComponent(componentId: string) {
    let childNode = currentNode.children.get(componentId);
    if (!childNode) {
      childNode = createNode(componentId, currentNode);
      currentNode.children.set(componentId, childNode);
    }

    currentNode = childNode;
    currentNode.hookIndex = 0;
  }

  function exitComponent() {
    if (!currentNode) return;

    const parentNode = currentNode.parent;

    if (parentNode) {
      currentNode = parentNode;
    }
  }

  function createElement(
    tag: string | ((props: Props, children: Component[]) => Component),
    props: Props = {},
    ...children: Component[]
  ): Component {
    const isFunc = typeof tag === "function";
    if (!isFunc) return createDomElement(tag, props, children);
    return createReactElement(tag, props, children);
  }

  function createDomElement(
    tag: string,
    props: Props,
    children: Component[]
  ): Component {
    return {
      tag,
      props: mergeProps(props, { children }),
    };
  }

  function createReactElement(
    tag: (props: Props, children: Component[]) => Component,
    props: Props,
    children: Component[]
  ): Component {
    if (tag.name === "Suspense") {
      return createSuspenseElement(tag, props, children);
    }

    return {
      tag,
      props: mergeProps(props, { children }),
    };
  }

  function createSuspenseElement(
    tag: (props: Props, children: Component[]) => Component,
    props: Props,
    children: Component[]
  ) {
    const promiseCache = new Map();

    if (!suspenseMap.has(currentNode.id)) {
      suspenseMap.set(currentNode.id, promiseCache);
    }

    return {
      tag,
      props: mergeProps(props, { children }),
      __suspense: {
        id: currentNode.id,
        fallback: props.fallback,
        promiseCache,
      },
    };
  }

  function createResource<T>(
    promiseFn: () => Promise<T>,
    key: string | number,
    hookNode: HookNode
  ) {
    const promiseCache = getCurrentSuspenseBoundary(hookNode);

    if (!promiseCache.has(key)) {
      promiseCache.set(
        key,
        new Promise((resolve, reject) => {
          promiseFn()
            .then((data) => {
              promiseCache.set(key, data);
              ReactDOM.rerender();
              resolve(data);
            })
            .catch(reject);
        })
      );
    }

    const value = promiseCache.get(key);
    if (isPromise(value)) {
      throw { promise: value, key };
    }

    return value as T;
  }

  function enqueueUpdate(
    update: (arg0: unknown) => void,
    index: number,
    hookNode: HookNode
  ) {
    if (!hookNode) {
      throw new Error("enqueueUpdate called outside of component context");
    }

    hookNode.updateQueue.push(() => {
      const componentId = hookNode?.id;
      if (hookNode && componentId) {
        const newState = update(hookNode.hooks[index]);
        hookNode.hooks[index] = newState;
      }
    });
  }

  function directUpdate(
    update: (arg0: unknown) => void,
    index: number,
    hookNode: HookNode
  ) {
    if (hookNode) {
      const newState = update(hookNode.hooks[index]);
      hookNode.hooks[index] = newState;
    }
  }

  function flushUpdate() {
    processNodeUpdates(rootNode);
    resetHookIndices(rootNode);
  }

  function processNodeUpdates(node: HookNode | null) {
    if (!node) return;

    let update = node.updateQueue.pop();
    while (update) {
      update();
      update = node.updateQueue.pop();
    }

    for (const [_, child] of node.children) {
      processNodeUpdates(child);
    }
  }

  function resetHookIndices(node: HookNode | null) {
    if (!node) return;
    node.hookIndex = 0;
    for (const [_, child] of node.children) {
      resetHookIndices(child);
    }
  }

  function getHookIndex() {
    if (!currentNode) {
      throw new Error("getHookIndex called outside of component context");
    }
    const nextIndex = currentNode.hookIndex++;
    return nextIndex;
  }

  function getStateForIndex<T>(index: number) {
    if (!currentNode) {
      throw new Error("getStateForIndex called outside of component context");
    }
    return [currentNode.hooks[index] as T, currentNode] as const;
  }

  function setStateForIndex(
    index: number,
    newState: unknown,
    hookNode: HookNode
  ) {
    if (!hookNode) {
      throw new Error("setStateForIndex called outside of component context");
    }
    hookNode.hooks[index] = newState;
  }

  function setContextValue(
    contextId: symbol,
    value: unknown,
    hookNode: HookNode
  ) {
    if (!hookNode) {
      throw new Error("setContextValue called outside of component context");
    }
    hookNode.contexts.set(contextId, value);
  }

  function getClosestContextValue<T>(
    contextId: symbol,
    defaultValue: T,
    hookNode: HookNode
  ): T {
    let node = hookNode;
    while (node) {
      if (node.contexts.has(contextId)) {
        return node.contexts.get(contextId) as T;
      }
      node = node.parent;
    }

    return defaultValue;
  }

  return {
    Fragment: Symbol.for("react.fragment"),
    generateComponentId,
    debugComponentTree,
    mergeProps,
    createResource,
    createElement,
    getHookIndex,
    setStateForIndex,
    flushUpdate,
    enqueueUpdate,
    directUpdate,
    getStateForIndex,
    setContextValue,
    getClosestContextValue,
    getCurrentNode,
    enterComponent,
    exitComponent,
  };
}

const react = React();
globalThis.React = react;
export default react;

export const {
  createElement,
  getHookIndex,
  setStateForIndex,
  flushUpdate,
  enqueueUpdate,
  directUpdate,
  getStateForIndex,
} = react;

export {
  useEffect,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  use,
  useImperativeHandle,
  useContext,
  createContext,
} from "./ReactHooks";

export function generateComponentId(
  tag: SyncTag,
  props: Props,
  parentId: string
): string {
  const tagName = typeof tag === "function" ? tag.name || "Anonymous" : tag;
  const key = props.key;
  const result = [tagName, key, parentId].filter(Boolean).join("-");
  console.log(result)
  return hash(result);
}

function hash(str: string) {
  return str
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString();
}
