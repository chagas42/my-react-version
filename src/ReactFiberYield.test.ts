import { describe, expect, it } from "vitest";
import React from "./React";
import {
  commitFiberTree,
  createHostRootFiber,
  renderFiberTreeConcurrent,
  workLoop,
} from "./ReactFiber";
import type { Fiber } from "./ReactFiber";
import type { Component } from "./types";

const h = (tag: any, props: any = {}, ...children: any[]) =>
  React.createElement(tag, props, ...children) as Component;

function tree() {
  const container = document.createElement("div");
  const root = createHostRootFiber(container, [
    h("div", {}, h("span", {}, "a"), h("b", {}, "c")),
  ]);
  return { container, root };
}

describe("yielding", () => {
  it("does one unit per slice when told to always yield", () => {
    const { root } = tree();

    const next = workLoop(root, () => true);

    expect(next).not.toBeNull();
    expect(next).toBe(root.child);
  });

  it("slicing yields the same tree as running at once", () => {
    const sliced = tree();
    let next: Fiber | null = sliced.root;
    while (next) next = workLoop(next, () => true);
    commitFiberTree(sliced.root);

    const atOnce = tree();
    workLoop(atOnce.root);
    commitFiberTree(atOnce.root);

    expect(sliced.container.innerHTML).toBe(atOnce.container.innerHTML);
  });

  it("runs to completion by default", () => {
    const { root } = tree();

    expect(workLoop(root)).toBeNull();
  });
});

describe("concurrent render", () => {
  it("commits once the whole tree is done", async () => {
    const { container, root } = tree();

    await new Promise<void>((resolve) => {
      renderFiberTreeConcurrent(root, () => resolve(), () => true);
    });

    expect(container.innerHTML).toBe("<div><span>a</span><b>c</b></div>");
  });

});
