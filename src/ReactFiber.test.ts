import { describe, expect, it } from "vitest";
import React from "./React";
import {
  NoLanes,
  SyncLane,
  createHostRootFiber,
  beginWork,
  commitFiberTree,
  createWorkInProgress,
  renderFiberRoot,
  renderFiberTree,
} from "./ReactFiber";
import type { Fiber } from "./ReactFiber";
import type { Component } from "./types";

const h = (tag: any, props: any = {}, ...children: any[]) =>
  React.createElement(tag, props, ...children) as Component;

function shape(fiber: Fiber | null, depth = 0): string {
  if (!fiber) return "";
  const name =
    typeof fiber.type === "function"
      ? (fiber.type as { name: string }).name
      : String(fiber.type);

  return (
    "  ".repeat(depth) +
    `${fiber.tag}(${name})\n` +
    shape(fiber.child, depth + 1) +
    shape(fiber.sibling, depth)
  );
}

function render(component: Component) {
  const container = document.createElement("div");
  const root = renderFiberRoot(component, container);
  return { root, container };
}

describe("render phase", () => {
  it("links children and siblings in JSX order", () => {
    const { root } = render(h("div", {}, h("span"), h("b"), h("i")));

    expect(shape(root)).toBe(
      [
        "HostRoot(null)",
        "  HostComponent(div)",
        "    HostComponent(span)",
        "    HostComponent(b)",
        "    HostComponent(i)",
        "",
      ].join("\n"),
    );
  });

  it("calls the component and descends into what it returns", () => {
    function Greeting(props: { name: string }) {
      return h("p", {}, `oi ${props.name}`);
    }

    const { root } = render(h(Greeting, { name: "celso" }));

    expect(shape(root)).toBe(
      [
        "HostRoot(null)",
        "  FunctionComponent(Greeting)",
        "    HostComponent(p)",
        "      HostText(TEXT_ELEMENT)",
        "",
      ].join("\n"),
    );
  });

});

describe("bailout", () => {
  function skipFiber(childLanes: number) {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, [h("div", {}, h("span"))]);
    renderFiberTree(first);

    const firstDiv = first.child as Fiber;
    const wip = createWorkInProgress(firstDiv, firstDiv.memoizedProps as never);
    wip.lanes = NoLanes;
    wip.childLanes = childLanes;

    return { firstDiv, wip, next: beginWork(wip) };
  }

  it("keeps the subtree when there is no work below", () => {
    const { firstDiv, wip, next } = skipFiber(NoLanes);

    expect(next).toBeNull();
    expect(wip.child).toBe(firstDiv.child);
  });

  it("clones the children when there is work below", () => {
    const { firstDiv, next } = skipFiber(SyncLane);

    expect(next).not.toBeNull();
    expect(next?.alternate).toBe(firstDiv.child);
    expect(next?.flags.has("Update")).toBe(false);
  });

  it("descends and reconciles when props changed", () => {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, [h("div", { id: "a" })]);
    renderFiberTree(first);

    const second = createWorkInProgress(first, {
      children: [h("div", { id: "b" })],
    });
    renderFiberTree(second);

    expect(second.child?.pendingProps.id).toBe("b");
  });
});

describe("commit phase", () => {
  it("puts the tree in the container", () => {
    const { container } = render(h("div", { id: "a" }, h("span", {}, "oi")));

    expect(container.innerHTML).toBe('<div id="a"><span>oi</span></div>');
  });

  it("consumes the flags on commit", () => {
    const { root } = render(h("div", {}, h("span")));

    expect([...root.child!.flags]).toEqual([]);
  });
});

describe("keyed reconciliation", () => {
  const list = (ids: number[]) =>
    ids.map((id) => h("li", { key: id }, `item ${id}`));

  function commitTwice(initial: number[], next: number[]) {
    const container = document.createElement("div");

    const first = createHostRootFiber(container, list(initial));
    renderFiberTree(first);
    commitFiberTree(first);
    const before = [...container.children];

    const second = createWorkInProgress(first, { children: list(next) });
    second.stateNode = container;
    renderFiberTree(second);
    commitFiberTree(second);

    return { container, before };
  }

  it("moves the node instead of recreating it", () => {
    const { container, before } = commitTwice([1, 2, 3], [3, 1, 2]);

    expect(container.children[0]).toBe(before[2]);
  });

  it("inserts in the middle instead of appending", () => {
    const { container } = commitTwice([1, 3], [1, 2, 3]);

    expect(container.textContent).toBe("item 1item 2item 3");
  });

});

describe("deletions", () => {
  function commitTwice(initial: Component[], next: Component[]) {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, initial);
    renderFiberTree(first);
    commitFiberTree(first);

    const second = createWorkInProgress(first, { children: next });
    second.stateNode = container;
    renderFiberTree(second);
    commitFiberTree(second);

    return container;
  }

  it("removes a deeply nested child from the DOM", () => {
    const container = commitTwice(
      [h("ul", {}, h("li", {}, "a"), h("li", {}, "b"))],
      [h("ul", {}, h("li", {}, "a"))],
    );

    expect(container.querySelectorAll("li").length).toBe(1);
    expect(container.textContent).toBe("a");
  });

  it("empties a whole list", () => {
    const container = commitTwice(
      [h("ul", {}, h("li", { key: 1 }), h("li", { key: 2 }))],
      [h("ul")],
    );

    expect(container.querySelectorAll("li").length).toBe(0);
  });

  it("a child that turns null leaves the DOM", () => {
    const container = commitTwice(
      [h("div", {}, h("span", {}, "oi"), h("b", {}, "fixo"))],
      [h("div", {}, null as never, h("b", {}, "fixo"))],
    );

    expect(container.textContent).toBe("fixo");
  });

  it("the sibling of a nulled child is reused, not recreated", () => {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, [
      h("div", {}, h("span", {}, "oi"), h("b", {}, "fixo")),
    ]);
    renderFiberTree(first);
    commitFiberTree(first);
    const before = container.querySelector("b");

    const second = createWorkInProgress(first, {
      children: [h("div", {}, null as never, h("b", {}, "fixo"))],
    });
    second.stateNode = container;
    renderFiberTree(second);
    commitFiberTree(second);

    expect(container.querySelector("b")).toBe(before);
  });
});
