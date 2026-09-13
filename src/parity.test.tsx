import { beforeEach, describe, expect, it, vi } from "vitest";

declare const React: typeof import("./React").default;

let container: HTMLElement;
let ReactDOM: typeof import("./ReactDOM").default;

beforeEach(async () => {
  vi.resetModules();
  ReactDOM = (await import("./ReactDOM")).default;

  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

function normalize(node: Element): string {
  const attrs = [...node.attributes]
    .map((a) => `${a.name}="${a.value}"`)
    .sort()
    .join(" ");

  const children = [...node.childNodes]
    .map((child) =>
      child.nodeType === Node.ELEMENT_NODE
        ? normalize(child as Element)
        : child.textContent,
    )
    .join("");

  return `<${node.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ""}>${children}</${node.tagName.toLowerCase()}>`;
}

function bothPaths(element: unknown) {
  const legacy = document.createElement("div");
  ReactDOM.renderRoot(element as never, legacy);

  const fiber = document.createElement("div");
  ReactDOM.renderRootWithFiber(element as never, fiber);

  return { legacy: normalize(legacy), fiber: normalize(fiber) };
}

describe("parity between reconcilers", () => {

  it("a list built from map", () => {
    const { legacy, fiber } = bothPaths(
      <ul>
        {[1, 2, 3].map((id) => (
          <li key={id}>item {id}</li>
        ))}
      </ul>,
    );

    expect(fiber).toBe(legacy);
  });

  it("style as a string", () => {
    const { legacy, fiber } = bothPaths(<div style="color: red" />);

    expect(fiber).toBe(legacy);
  });

  it("the whole App, with the examples", async () => {
    const { App } = await import("../app");

    const { legacy, fiber } = bothPaths(<App />);

    expect(fiber).toBe(legacy);
  });

  it("wires event handlers", () => {
    let clicks = 0;
    const fiberContainer = document.createElement("div");

    ReactDOM.renderRootWithFiber(
      (<button onClick={() => (clicks += 1)}>ok</button>) as never,
      fiberContainer,
    );
    (fiberContainer.firstElementChild as HTMLElement).click();

    expect(clicks).toBe(1);
  });
});
