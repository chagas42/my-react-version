import { describe, expect, it } from "vitest";
import React from "./React";
import {
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

describe("commit phase", () => {
  it("puts the tree in the container", () => {
    const { container } = render(h("div", { id: "a" }, h("span", {}, "oi")));

    expect(container.innerHTML).toBe('<div id="a"><span>oi</span></div>');
  });

});

