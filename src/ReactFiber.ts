import { flushPassiveEffects, renderWithHooks } from "./ReactFiberHooks";
import { NORMAL, scheduleCallback, shouldYieldToHost } from "./scheduler";
import type { TaskCallback } from "./scheduler";
import type { Component, Props } from "./types";

export type Lane = number;
export type FiberTag =
  | "HostRoot"
  | "HostComponent"
  | "HostText"
  | "FunctionComponent"
  | "Fragment";
export type EffectFlag = "Placement" | "Update" | "Deletion";

export type Fiber = {
  tag: FiberTag;
  type: unknown;
  key?: string | number;
  lanes: Lane;
  childLanes: Lane;
  pendingProps: Props;
  memoizedProps: Props | null;
  /** Lista encadeada de hooks deste fiber. Ver ReactFiberHooks. */
  memoizedState: unknown;
  stateNode: HTMLElement | Text | null;
  alternate: Fiber | null;
  flags: Set<EffectFlag>;
  deletions: Fiber[];
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
    memoizedState: null,
    stateNode: null,
    alternate: null,
    flags: new Set(),
    deletions: [],
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

export function renderFiberRoot(
  rootComponent: Component,
  container: HTMLElement,
  previous: Fiber | null = null,
): Fiber {
  // Reusar o root da render anterior é o que dá um alternate a cada fiber —
  // sem isso toda render é a primeira, nada é reconciliado e o container
  // acumula uma árvore nova por cima da outra.
  const root = previous
    ? createWorkInProgress(previous, { children: [rootComponent] })
    : createHostRootFiber(container, [rootComponent]);

  root.stateNode = container;

  renderFiberTree(root);
  commitFiberTree(root);
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
    workInProgress.flags.clear();
    workInProgress.deletions = [];
  }

  workInProgress.lanes = current.lanes;
  workInProgress.childLanes = current.childLanes;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
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

/**
 * Recria os filhos do fiber a partir do alternate, sem reprocessá-los.
 *
 * É o que permite pular um fiber sem perder o que está abaixo dele: a subárvore
 * entra na work-in-progress tree já pronta, e a fase de commit continua achando
 * os nós. Sem isso, pular um fiber some com tudo que ele contém.
 */
function cloneChildFibers(fiber: Fiber): void {
  const current = fiber.alternate;
  if (!current?.child) return;

  let child: Fiber | null = current.child;
  let previous: Fiber | null = null;

  while (child) {
    const clone = createWorkInProgress(child, child.pendingProps);
    clone.return = fiber;

    if (previous) {
      previous.sibling = clone;
    } else {
      fiber.child = clone;
    }

    previous = clone;
    child = child.sibling;
  }
}

export function beginWork(fiber: Fiber): Fiber | null {
  // props novos significam trabalho real, mesmo sem lane marcada. o JSX cria um
  // objeto por render, então isto só é verdade quando o pai reusou os props —
  // que é exatamente quando dá para pular.
  const sameProps = fiber.alternate?.memoizedProps === fiber.pendingProps;

  if (fiber.alternate && sameProps && fiber.lanes === NoLanes) {
    // nada a fazer neste fiber. se também não há trabalho abaixo, a subárvore
    // inteira fica como está; senão, clona os filhos e desce até quem tem.
    if (fiber.childLanes === NoLanes) {
      fiber.child = fiber.alternate.child;
      return null;
    }

    cloneChildFibers(fiber);
    return fiber.child;
  }

  fiber.lanes = NoLanes;
  // as flags deste fiber foram marcadas pelo reconcileChildren do PAI e são
  // lidas na fase de commit. limpá-las aqui as apagaria antes do commit ver.
  // quem zera é o createWorkInProgress, ao reusar o fiber para a próxima render.
  fiber.deletions = [];

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
  // Quem tem key é procurado pela key; quem não tem, pela posição. É o que
  // permite reordenar uma lista sem destruir e recriar cada nó: o fiber da
  // key 3 é reencontrado mesmo tendo saído do fim para o começo.
  const byKey = new Map<string | number, Fiber>();
  const byPosition: Fiber[] = [];
  const oldIndex = new Map<Fiber, number>();

  let oldFiber = returnFiber.alternate?.child ?? null;
  let index = 0;
  while (oldFiber) {
    oldIndex.set(oldFiber, index++);

    if (oldFiber.key != null) {
      byKey.set(oldFiber.key, oldFiber);
    } else {
      byPosition.push(oldFiber);
    }
    oldFiber = oldFiber.sibling;
  }

  const reused = new Set<Fiber>();
  let previousFiber: Fiber | null = null;
  let position = 0;
  // maior posição antiga já colocada. quem vinha de antes dela andou para
  // frente na lista e precisa ser movido no DOM, não só atualizado.
  let lastPlaced = -1;

  returnFiber.child = null;

  for (const child of children) {
    const created = createFiberFromElement(child, returnFiber);
    if (!created) continue;

    const candidate =
      created.key != null ? byKey.get(created.key) : byPosition[position++];

    let newFiber = created;

    if (candidate && !reused.has(candidate) && canReuseFiber(candidate, created)) {
      newFiber = createWorkInProgress(candidate, created.pendingProps);
      newFiber.return = returnFiber;
      newFiber.flags.add("Update");
      reused.add(candidate);

      const previousIndex = oldIndex.get(candidate) ?? 0;
      if (previousIndex < lastPlaced) {
        newFiber.flags.add("Placement");
      } else {
        lastPlaced = previousIndex;
      }
    } else {
      newFiber.flags.add("Placement");
    }

    if (previousFiber) {
      previousFiber.sibling = newFiber;
    } else {
      returnFiber.child = newFiber;
    }

    previousFiber = newFiber;
  }

  if (previousFiber) previousFiber.sibling = null;

  for (const old of [...byKey.values(), ...byPosition]) {
    if (reused.has(old)) continue;
    old.flags.add("Deletion");
    returnFiber.deletions.push(old);
  }
}

export function completeWork(fiber: Fiber): void {
  if (fiber.tag === "HostText" && !fiber.stateNode) {
    fiber.stateNode = document.createTextNode(
      fiber.pendingProps.nodeValue?.toString() || "",
    );
  }

  const shouldCreateHostNode =
    fiber.tag === "HostComponent" &&
    !fiber.stateNode &&
    typeof fiber.type === "string";

  if (shouldCreateHostNode && typeof fiber.type === "string") {
    fiber.stateNode = document.createElement(fiber.type);
    setInitialHostProps(fiber.stateNode, fiber.pendingProps);
  }

  if (fiber.tag === "HostComponent" && fiber.stateNode instanceof HTMLElement) {
    appendHostChildren(fiber.stateNode, fiber.child);
  }

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

/** Nunca cede: o laço vai até o fim numa tacada só. */
const runToCompletion = () => false;

/**
 * Processa fibers um a um e devolve onde parou.
 *
 * `shouldYield` entra por parâmetro em vez de ser lido de um relógio global —
 * é o que torna a interrupção testável: um teste passa `() => true` e recebe
 * de volta a próxima unidade de trabalho, sem depender de timing real.
 *
 * O predicado é consultado DEPOIS de cada unidade, então toda chamada avança
 * pelo menos um fiber. Consultar antes poderia devolver o mesmo ponto para
 * sempre e travar o laço.
 *
 * Devolve `null` quando terminou a árvore, ou o próximo fiber quando cedeu.
 */
export function workLoop(
  root: Fiber,
  shouldYield: () => boolean = runToCompletion,
): Fiber | null {
  let nextUnitOfWork: Fiber | null = root;

  do {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  } while (nextUnitOfWork && !shouldYield());

  return nextUnitOfWork;
}

export function renderFiberTree(root: Fiber): Fiber {
  root.lanes = mergeLanes(root.lanes, SyncLane);
  workLoop(root);
  return root;
}

/**
 * Renderiza em fatias, cedendo o controle ao host entre elas.
 *
 * Cada fatia devolve uma continuação — a função que retoma do ponto exato onde
 * parou. O scheduler reagenda essa continuação, e o commit só acontece quando
 * a árvore inteira terminou: uma render pela metade nunca chega ao DOM.
 */
export function renderFiberTreeConcurrent(
  root: Fiber,
  onComplete: (root: Fiber) => void,
  shouldYield: () => boolean = shouldYieldToHost,
): void {
  root.lanes = mergeLanes(root.lanes, SyncLane);

  const sliceFrom = (from: Fiber): TaskCallback => {
    return () => {
      const next = workLoop(from, shouldYield);

      if (!next) {
        onComplete(root);
        return;
      }

      // devolver uma função é o contrato do scheduler para "ainda tem trabalho":
      // ele guarda esta continuação e a chama no próximo frame.
      return sliceFrom(next);
    };
  };

  scheduleCallback({ priorityLevel: NORMAL, callback: sliceFrom(root) });
}

export function commitFiberTree(root: Fiber): void {
  if (root.tag !== "HostRoot" || !(root.stateNode instanceof HTMLElement)) {
    return;
  }

  commitDeletions(root.deletions);
  commitWork(root.child);

  // efeitos rodam depois do commit: eles podem ler o DOM, e antes do commit
  // o DOM ainda não reflete esta render.
  flushPassiveEffects();
}

/**
 * Ponto de entrada de uma atualização vinda de dentro da árvore — um setState.
 *
 * Marca a lane do fiber até o root, monta a work-in-progress a partir dele e
 * renderiza. As lanes são o que faz o bailout pular tudo que não está no
 * caminho: só quem foi marcado, e os ancestrais dele, são reprocessados.
 *
 * Síncrono por enquanto; ceder o controle ao scheduler vem depois.
 */
export function scheduleUpdateOnFiber(fiber: Fiber, lane: Lane = SyncLane) {
  const current = markUpdateLaneFromFiberToRoot(fiber, lane);
  const root = createWorkInProgress(current, current.pendingProps);
  root.stateNode = current.stateNode;

  renderFiberTree(root);
  commitFiberTree(root);
  return root;
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

  const children = renderWithHooks(
    fiber,
    fiber.type as (props: Props) => Component | Component[] | null | undefined,
    fiber.pendingProps,
  );

  reconcileChildren(fiber, normalizeChildren(children));
}

function normalizeChildren(
  children: Component | Component[] | null | undefined,
): Component[] {
  if (!children) return [];
  if (Array.isArray(children)) return children;

  return [children];
}

function appendHostChildren(parent: HTMLElement, child: Fiber | null): void {
  let node = child;

  while (node) {
    if (node.stateNode) {
      parent.appendChild(node.stateNode);
    } else if (node.child) {
      appendHostChildren(parent, node.child);
    }

    node = node.sibling;
  }
}

function commitDeletions(deletions: Fiber[]): void {
  for (const fiber of deletions) {
    commitDeletion(fiber);
  }
}

function commitWork(fiber: Fiber | null): void {
  if (!fiber) return;

  if (fiber.flags.has("Placement")) {
    commitPlacement(fiber);
  }

  if (fiber.flags.has("Update")) {
    commitUpdate(fiber);
  }

  // flags são consumidas pelo commit. um fiber pulado por bailout é
  // compartilhado entre as duas árvores; sem limpar, ele seria recommitado na
  // render seguinte e o nó reinserido no DOM.
  fiber.flags.clear();

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

/**
 * O primeiro nó de DOM depois deste fiber que já está no lugar certo.
 *
 * É a âncora do insertBefore. Sem ela todo insert vira append e o nó vai parar
 * no fim da lista, mesmo quando devia entrar no meio. Fibers marcados com
 * Placement são pulados: eles próprios ainda vão se mover, então não servem
 * de referência.
 */
function getHostSibling(fiber: Fiber): HTMLElement | Text | null {
  let node: Fiber | null = fiber;

  while (node) {
    // sobe até achar um irmão, parando no host parent
    while (!node.sibling) {
      node = node.return;
      if (!node || node.stateNode instanceof HTMLElement) return null;
    }

    node = node.sibling;

    // desce por componentes sem nó próprio até um host fiber
    while (node && !node.stateNode) {
      if (node.flags.has("Placement")) break;
      node = node.child;
    }

    if (node?.stateNode && !node.flags.has("Placement")) {
      return node.stateNode;
    }
  }

  return null;
}

function commitPlacement(fiber: Fiber): void {
  const parent = getHostParent(fiber);
  if (!parent) return;

  const before = getHostSibling(fiber);

  if (before) {
    insertHostNode(parent, fiber, before);
    return;
  }

  appendHostNode(parent, fiber);
}

function insertHostNode(
  parent: HTMLElement,
  fiber: Fiber,
  before: HTMLElement | Text,
): void {
  if (fiber.stateNode) {
    parent.insertBefore(fiber.stateNode, before);
    return;
  }

  for (let child = fiber.child; child; child = child.sibling) {
    insertHostNode(parent, child, before);
  }
}

function getHostParent(fiber: Fiber): HTMLElement | null {
  let parent = fiber.return;

  while (parent) {
    if (parent.stateNode instanceof HTMLElement) {
      return parent.stateNode;
    }

    parent = parent.return;
  }

  return null;
}

function appendHostNode(parent: HTMLElement, fiber: Fiber): void {
  if (fiber.stateNode) {
    parent.appendChild(fiber.stateNode);
    return;
  }

  appendHostChildren(parent, fiber.child);
}

function commitUpdate(fiber: Fiber): void {
  if (fiber.tag === "HostText" && fiber.stateNode instanceof Text) {
    updateHostText(fiber);
    return;
  }

  if (fiber.tag === "HostComponent" && fiber.stateNode instanceof HTMLElement) {
    updateHostProps(
      fiber.stateNode,
      fiber.alternate?.memoizedProps || {},
      fiber.pendingProps,
    );
  }
}

function updateHostText(fiber: Fiber): void {
  if (!(fiber.stateNode instanceof Text)) return;

  const nextValue = fiber.pendingProps.nodeValue?.toString() || "";

  if (fiber.stateNode.nodeValue !== nextValue) {
    fiber.stateNode.nodeValue = nextValue;
  }
}

function commitDeletion(fiber: Fiber): void {
  if (fiber.stateNode?.parentNode) {
    fiber.stateNode.parentNode.removeChild(fiber.stateNode);
    return;
  }

  if (fiber.child) {
    commitDeletion(fiber.child);
  }
}

function setInitialHostProps(element: HTMLElement, props: Props): void {
  for (const key of Object.keys(props)) {
    const value = props[key];

    if (
      value == null ||
      key === "children" ||
      key === "__self" ||
      key === "__source"
    ) {
      continue;
    }

    if (key === "className") {
      element.className = value || "";
      continue;
    }

    if (key === "style") {
      setInitialStyle(element, value);
      continue;
    }

    if (key === "ref" && typeof value === "object" && "current" in value) {
      value.current = element;
      continue;
    }

    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.toLowerCase().substring(2), value);
      continue;
    }

    if (typeof value === "boolean") {
      if (value) {
        element.setAttribute(key.toLowerCase(), "");
      }
      continue;
    }

    element.setAttribute(key.toLowerCase(), value);
  }
}

function updateHostProps(
  element: HTMLElement,
  oldProps: Props,
  newProps: Props,
): void {
  removeOldHostProps(element, oldProps, newProps);
  setInitialHostProps(element, newProps);
}

function removeOldHostProps(
  element: HTMLElement,
  oldProps: Props,
  newProps: Props,
): void {
  for (const key of Object.keys(oldProps)) {
    const value = oldProps[key];

    if (key === "children" || key === "__self" || key === "__source") {
      continue;
    }

    if (key.startsWith("on") && typeof value === "function") {
      element.removeEventListener(key.toLowerCase().substring(2), value);
      continue;
    }

    if (key === "style") {
      removeOldStyle(element, value, newProps.style);
      continue;
    }

    if (key === "className" && newProps.className == null) {
      element.className = "";
      continue;
    }

    if (key === "ref" && typeof value === "object" && "current" in value) {
      value.current = null;
      continue;
    }

    if (typeof value === "boolean" && newProps[key] !== true) {
      element.removeAttribute(key.toLowerCase());
      continue;
    }

    if (!(key in newProps)) {
      element.removeAttribute(key.toLowerCase());
    }
  }
}

function setInitialStyle(element: HTMLElement, style: unknown): void {
  if (typeof style === "string") {
    element.style.cssText = style;
    return;
  }

  if (!style || typeof style !== "object") return;

  for (const key of Object.keys(style)) {
    element.style[key] = style[key];
  }
}

function removeOldStyle(
  element: HTMLElement,
  oldStyle: unknown,
  newStyle: unknown,
): void {
  if (!newStyle) {
    element.removeAttribute("style");
    return;
  }

  if (
    !oldStyle ||
    typeof oldStyle !== "object" ||
    typeof newStyle !== "object"
  ) {
    return;
  }

  for (const key of Object.keys(oldStyle)) {
    if (!(key in newStyle)) {
      element.style[key] = "";
    }
  }
}

function canReuseFiber(current: Fiber, next: Fiber): boolean {
  return current.type === next.type && current.key === next.key;
}
