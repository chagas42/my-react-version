import { beforeEach, describe, expect, it, vi } from "vitest";

declare const React: typeof import("./React").default;

let container: HTMLElement;
let ReactDOM: typeof import("./ReactDOM").default;
let useState: typeof import("./React").useState;
let useEffect: typeof import("./React").useEffect;
let useRef: typeof import("./React").useRef;
let useMemo: typeof import("./React").useMemo;
let useImperativeHandle: typeof import("./React").useImperativeHandle;

beforeEach(async () => {
  vi.resetModules();
  const react = await import("./React");
  useState = react.useState;
  useEffect = react.useEffect;
  useRef = react.useRef;
  useMemo = react.useMemo;
  useImperativeHandle = react.useImperativeHandle;
  ReactDOM = (await import("./ReactDOM")).default;

  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

const render = (element: unknown) =>
  ReactDOM.renderRootWithFiber(element as never, container);

describe("useState", () => {
  it("keeps the initial value", () => {
    function Counter() {
      const [count] = useState(7);
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);

    expect(container.textContent).toBe("7");
  });

  it("re-renders with the new value", () => {
    let increment: () => void;

    function Counter() {
      const [count, setCount] = useState(0);
      increment = () => setCount((prev: number) => prev + 1);
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);
    expect(container.textContent).toBe("0");

    increment!();
    expect(container.textContent).toBe("1");

    increment!();
    expect(container.textContent).toBe("2");
  });

  it("keeps two hooks of the same component apart", () => {
    let bump: () => void;

    function Two() {
      const [a, setA] = useState("a");
      const [b] = useState("b");
      bump = () => setA("A");
      return (
        <p>
          {a}
          {b}
        </p>
      );
    }

    render(<Two />);
    expect(container.textContent).toBe("ab");

    bump!();
    expect(container.textContent).toBe("Ab");
  });

  it("gives each instance of the same component its own state", () => {
    const setters: ((n: number) => void)[] = [];

    function Counter({ start }: { start: number }) {
      const [count, setCount] = useState(start);
      setters.push(setCount);
      return <span>{count.toString()}</span>;
    }

    render(
      <div>
        <Counter start={0} />
        <Counter start={100} />
      </div>,
    );
    expect(container.textContent).toBe("0100");

    setters[0](1);
    expect(container.textContent).toBe("1100");
  });

  it("keeps the DOM node across re-renders", () => {
    let bump: () => void;

    function Counter() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);
    const before = container.firstElementChild;

    bump!();

    expect(container.firstElementChild).toBe(before);
  });
});

describe("useEffect", () => {

  it("does not run again when the deps are unchanged", () => {
    let runs = 0;
    let bump: () => void;

    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      useEffect(() => {
        runs += 1;
      }, []);
      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    expect(runs).toBe(1);

    bump!();
    expect(runs).toBe(1);
  });

  it("runs again when a dep changes, cleaning up the previous one", () => {
    const events: string[] = [];
    let bump: () => void;

    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      useEffect(() => {
        events.push(`efeito ${count}`);
        return () => events.push(`limpeza ${count}`);
      }, [count]);
      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    bump!();

    expect(events).toEqual(["efeito 0", "limpeza 0", "efeito 1"]);
  });
});

describe("useImperativeHandle", () => {

  it("does not consume a hook slot from the legacy system", () => {
    function P() {
      useImperativeHandle({ current: null }, () => ({}), []);
      return <p>x</p>;
    }

    const before = React.getCurrentNode().hookIndex;
    render(<P />);

    expect(React.getCurrentNode().hookIndex).toBe(before);
  });
});
