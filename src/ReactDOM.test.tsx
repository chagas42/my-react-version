import { beforeEach, describe, expect, it, vi } from "vitest";

declare const React: typeof import("./React").default;

let container: HTMLElement;
let ReactDOM: typeof import("./ReactDOM").default;
let useState: typeof import("./React").useState;

beforeEach(async () => {
  vi.resetModules();
  useState = (await import("./React")).useState;
  ReactDOM = (await import("./ReactDOM")).default;

  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("props", () => {

  it("wires event handlers", () => {
    let clicks = 0;
    ReactDOM.renderRoot(
      <button onClick={() => (clicks += 1)}>ok</button>,
      container,
    );

    (container.firstElementChild as HTMLElement).click();

    expect(clicks).toBe(1);
  });
});

describe("keyed reconciliation", () => {
  const list = (ids: number[]) => (
    <ul>
      {ids.map((id) => (
        <li key={id}>item {id}</li>
      ))}
    </ul>
  );

  it("reuses the node at the position, not the node with the key", () => {
    ReactDOM.renderRoot(list([1, 2, 3]), container);
    const before = [...container.querySelectorAll("li")];

    ReactDOM.renderRoot(list([3, 1, 2]), container);
    const after = [...container.querySelectorAll("li")];

    expect(after[0]).toBe(before[0]);
    expect(after[0]).not.toBe(before[2]);
  });

  it("leaks key as a DOM attribute", () => {
    ReactDOM.renderRoot(list([1]), container);

    expect(container.innerHTML).toContain('key="1"');
  });

});

describe("useState", () => {
  it("keeps the initial value", () => {
    function Counter() {
      const [count] = useState(7);
      return <p>{count.toString()}</p>;
    }

    ReactDOM.renderRoot(<Counter />, container);

    expect(container.textContent).toBe("7");
  });

  it("re-renders with the new value", () => {
    let increment: () => void;

    function Counter() {
      const [count, setCount] = useState(0);
      increment = () => setCount((prev: number) => prev + 1);
      return <p>{count.toString()}</p>;
    }

    ReactDOM.renderRoot(<Counter />, container);
    expect(container.textContent).toBe("0");

    increment!();
    expect(container.textContent).toBe("1");
  });

  it("gives each instance of the same component its own state", () => {
    function Counter({ start }: { start: number }) {
      const [count] = useState(start);
      return <span>{count.toString()}</span>;
    }

    ReactDOM.renderRoot(
      <div>
        <Counter start={0} />
        <Counter start={100} />
      </div>,
      container,
    );

    expect(container.textContent).toBe("0100");
  });
});
