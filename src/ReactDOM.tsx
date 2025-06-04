import React from "./React";
import { isFragment, isPrimitive, isSuspenseComponent } from "./helpers";
import type { Component, Props, SyncTag } from "./types";

type VNode = {
  type: string | ((props: unknown) => unknown) | symbol;
  props: Props;
  children?: VNode[];
  domElement?: HTMLElement | Text;
  key?: string | number;
};

let counter = 0;
function ReactDOM() {
  let _root: Component;
  let _container: HTMLElement;
  let _currentTree: VNode | null = null;

  function renderRoot(root: Component, container: HTMLElement) {
    if (!root) throw new Error("No root component provided");
    React.flushUpdate();

    _root = root;
    _container = container;

    const newTree = createVirtualTree(_root);


    if (newTree) renderToDOM(newTree, _currentTree, container);

    _currentTree = newTree;
  }

  const rerender = () => renderRoot(_root, _container);

  return {
    renderRoot,
    rerender,
  };
}

const _ReactDOM = ReactDOM();
export default _ReactDOM;

function createVirtualTree(component: Component): VNode | null {

  if (!component) return null;

  if (isPrimitive(component)) {
    // console.log(counter)
    return {
      type: "TEXT_ELEMENT",
      props: { nodeValue: component.toString() },
      children: [],
    };
  }

  if (Array.isArray(component)) {
    return {
      type: React.Fragment,
      props: {},
      children: component
        .map((child) => createVirtualTree(child))
        .filter((e) => e !== null),
    };
  }

  if (isFragment(component.tag, component.props)) {
    return {
      type: React.Fragment,
      props: component.props,
      children: component.props.children
        .map((child) => createVirtualTree(child))
        .filter((e) => e !== null),
    };
  }

  if (isSuspenseComponent(component)) {
    const parentId = React.getCurrentNode().id;
    const componentId = React.generateComponentId(
      component.tag as SyncTag,
      component.props,
      parentId
    );

    React.enterComponent(componentId);

    const children = [];

    for (const child of component.props.children) {
      try {
        const childTree = createVirtualTree(child);
        if (childTree) {
          children.push(childTree);
        }
      } catch (e) {
        const result = createVirtualTree(component.__suspense.fallback);
        return result;
      } finally {
        React.exitComponent();
      }
    }

    const result = {
      type: React.Fragment,
      props: component.props,
      children,
    };

    return result;
  }

  if (typeof component.tag === "function") {
    const parentId = React.getCurrentNode().id;
    const componentId = React.generateComponentId(
      component.tag as SyncTag,
      component.props,
      parentId
    );

    React.enterComponent(componentId);
    const el = component.tag(component.props) as Component;
    const result = createVirtualTree(el);
    React.exitComponent();
    return result;
  }

  return {
    type: component.tag,
    props: component.props,
    children: component.props.children
      .map((child) => createVirtualTree(child))
      .filter((e) => e !== null),
  };
}

function renderToDOM(
  newvnode: VNode | null,
  oldvnode: VNode | null,
  container: HTMLElement
): void {
  if (!newvnode) return;

  if (!oldvnode) {
    if (newvnode.type === "TEXT_ELEMENT") {
      const textNode = createTextNode(newvnode.props.nodeValue);
      newvnode.domElement = textNode;
      container.appendChild(textNode);
      return;
    }

    if (newvnode.type === React.Fragment) {
      newvnode.children?.forEach((child, index) =>
        renderToDOM(child, oldvnode?.children?.[index] || null, container)
      );
      return;
    }

    if (typeof newvnode.type === "string") {
      const domElement = createDomElement(newvnode.type, newvnode.props);
      newvnode.domElement = domElement;
      container.appendChild(domElement);

      for (const child of newvnode.children || []) {
        renderToDOM(
          child,
          oldvnode?.children?.find((c) => c.key === child.key) || null,
          domElement
        );
      }
    }
    return;
  }

  if (
    oldvnode.type !== newvnode.type ||
    !Object.is(oldvnode.props.value, newvnode.props.value) // make this better later
  ) {
    if (oldvnode?.domElement.parentNode) {
      oldvnode.domElement.parentNode.removeChild(oldvnode.domElement);
    }
    renderToDOM(newvnode, null, container);
    return;
  }

  if (newvnode.type === "TEXT_ELEMENT") {
    const textNode = oldvnode.domElement as Text;
    if (textNode.nodeValue !== newvnode.props.nodeValue) {
      textNode.nodeValue = newvnode.props.nodeValue;
    }
    newvnode.domElement = textNode;
    return;
  }

  if (typeof newvnode.type === "string") {
    const domElement = oldvnode.domElement as HTMLElement;
    newvnode.domElement = domElement;

    updateDomElement(newvnode.domElement, oldvnode.props, newvnode.props);

    const oldChildren = oldvnode.children || [];
    const newChildren = newvnode.children || [];

    reconcileChildren(oldChildren, newChildren, newvnode.domElement);
    return;
  }

  if (newvnode.type === React.Fragment) {
    const oldChildren = oldvnode.children || [];
    const newChildren = newvnode.children || [];

    reconcileChildren(oldChildren, newChildren, container);
    return;
  }
}

function reconcileChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  container: HTMLElement
): void {
  const oldChildrenMap: Map<string | number, VNode> = new Map();
  const oldChildrenWithoutKey: VNode[] = [];

  for (const child of oldChildren) {
    if (child.key != null) {
      oldChildrenMap.set(child.key, child);
    } else {
      oldChildrenWithoutKey.push(child);
    }
  }

  const processedOldNodes = new Set();

  newChildren.forEach((newChild, i) => {
    let oldChild = null;

    if (newChild.key != null && oldChildrenMap.has(newChild.key)) {
      oldChild = oldChildrenMap.get(newChild.key);
      processedOldNodes.add(oldChild);
    } else {
      oldChild = oldChildrenWithoutKey[i] || null;
      if (oldChild) processedOldNodes.add(oldChild);
    }

    renderToDOM(newChild, oldChild, container);
  });

  for (const oldChild of oldChildren) {
    if (!processedOldNodes.has(oldChild) && oldChild.domElement) {
      oldChild.domElement.parentNode?.removeChild(oldChild.domElement);
    }
  }
}

function createTextNode(value: string | number) {
  return document.createTextNode(value.toString());
}

function createDomElement(tag: string, props: Props): HTMLElement {
  return createOrUpdateDomElement(tag, props);
}

function updateDomElement(
  element: HTMLElement,
  oldProps: Props,
  newProps: Props
) {
  createOrUpdateDomElement(element, newProps, oldProps);
}

function createOrUpdateDomElement(
  tag: string | HTMLElement,
  newProps: Props,
  oldProps?: Props
): HTMLElement {
  const element =
    typeof tag === "string"
      ? document.createElement(tag)
      : (tag as HTMLElement);

  // Clean up old properties and event handlers
  if (oldProps) {
    // Remove old event handlers
    for (const key of Object.keys(oldProps)) {
      if (key.startsWith("on") && typeof oldProps[key] === "function") {
        const eventType = key.toLowerCase().substring(2);
        element.removeEventListener(eventType, oldProps[key]);
      }
    }

    // Remove attributes that don't exist in new props
    for (const key of Object.keys(oldProps).filter(
      (key) =>
        key !== "children" &&
        key !== "style" &&
        key !== "className" &&
        !key.startsWith("on") &&
        !(key in newProps)
    )) {
      element.removeAttribute(key.toLowerCase());
    }

    // Clear style if new props don't have it
    if (oldProps.style && !newProps.style) {
      element.removeAttribute("style");
    }

    // Clear className if new props don't have it
    if (oldProps.className && !newProps.className) {
      element.className = "";
    }
  }

  // Set new properties and event handlers
  for (const key of Object.keys(newProps).filter((key) => key !== "children")) {
    // Handle event listeners
    if (key.startsWith("on") && typeof newProps[key] === "function") {
      const eventType = key.toLowerCase().substring(2);
      if (oldProps && typeof oldProps[key] === "function") {
        element.removeEventListener(eventType, oldProps[key]);
      }
      element.addEventListener(eventType, newProps[key]);
    }
    // Handle regular attributes
    else if (key !== "style" && key !== "ref" && key !== "className") {
      // Handle boolean attributes properly
      if (typeof newProps[key] === "boolean") {
        if (newProps[key]) {
          element.setAttribute(key.toLowerCase(), "");
        } else {
          element.removeAttribute(key.toLowerCase());
        }
      } else {
        element.setAttribute(key.toLowerCase(), newProps[key]);
      }
    }
  }

  // Handle style separately
  if (newProps.style) {
    if (typeof newProps.style === "string") {
      element.style.cssText = newProps.style;
    } else if (typeof newProps.style === "object") {
      // Clear any old styles first if updating
      if (oldProps?.style && typeof oldProps.style === "object") {
        for (const styleKey of Object.keys(oldProps.style)) {
          if (!newProps.style[styleKey]) {
            element.style[styleKey] = "";
          }
        }
      }

      // Set new styles
      for (const styleKey of Object.keys(newProps.style)) {
        const styleValue = newProps.style[styleKey];
        if (styleValue !== undefined) {
          element.style[styleKey] = styleValue;
        }
      }
    }
  }

  // Handle className
  if (newProps.className !== undefined) {
    const classList = newProps.className
      .split(" ")
      .filter((e: string) => e !== "");
    if (classList.length > 0) {
      element.className = classList.join(" ");
    }
  }

  // Handle ref
  if (newProps.ref) {
    newProps.ref.current = element;
  }

  return element;
}
