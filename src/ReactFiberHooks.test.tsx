import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hooks rodando no reconciler de fiber.
 *
 * O mesmo `useState` exportado por `ReactHooks` atende os dois caminhos; qual
 * implementação roda é decidido por quem está renderizando.
 */

declare const React: typeof import("./React").default;

let container: HTMLElement;
let ReactDOM: typeof import("./ReactDOM").default;
let useState: typeof import("./React").useState;
let useEffect: typeof import("./React").useEffect;
let useRef: typeof import("./React").useRef;
let useMemo: typeof import("./React").useMemo;

beforeEach(async () => {
  vi.resetModules();
  const react = await import("./React");
  useState = react.useState;
  useEffect = react.useEffect;
  useRef = react.useRef;
  useMemo = react.useMemo;
  ReactDOM = (await import("./ReactDOM")).default;

  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

const render = (element: unknown) =>
  ReactDOM.renderRootWithFiber(element as never, container);

describe("useState", () => {
  it("guarda o valor inicial", () => {
    function Counter() {
      const [count] = useState(7);
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);

    expect(container.textContent).toBe("7");
  });

  it("aceita inicializador preguiçoso", () => {
    let chamadas = 0;

    function Counter() {
      const [count] = useState(() => {
        chamadas += 1;
        return 42;
      });
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);

    expect(container.textContent).toBe("42");
    expect(chamadas).toBe(1);
  });

  it("re-renderiza com o novo valor", () => {
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

  it("aceita o valor direto, não só a função", () => {
    let set: (n: number) => void;

    function Counter() {
      const [count, setCount] = useState(0);
      set = setCount;
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);
    set!(9);

    expect(container.textContent).toBe("9");
  });

  it("mantém dois hooks do mesmo componente separados", () => {
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

  it("dá estado próprio a cada instância do mesmo componente", () => {
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

    // mexer no primeiro não pode encostar no segundo — é o que o id hasheado
    // do reconciler antigo não garante, porque a hash colide por anagrama
    setters[0](1);
    expect(container.textContent).toBe("1100");
  });

  it("preserva o nó de DOM entre re-renders", () => {
    let bump: () => void;

    function Counter() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      return <p>{count.toString()}</p>;
    }

    render(<Counter />);
    const antes = container.firstElementChild;

    bump!();

    expect(container.firstElementChild).toBe(antes);
  });
});

describe("useEffect", () => {
  it("roda depois do commit, com o DOM já no lugar", () => {
    let viu: string | undefined;

    function Probe() {
      useEffect(() => {
        viu = container.textContent ?? undefined;
      }, []);
      return <p>pronto</p>;
    }

    render(<Probe />);

    expect(viu).toBe("pronto");
  });

  it("não roda de novo quando as deps não mudam", () => {
    let vezes = 0;
    let bump: () => void;

    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      useEffect(() => {
        vezes += 1;
      }, []);
      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    expect(vezes).toBe(1);

    bump!();
    expect(vezes).toBe(1);
  });

  it("roda de novo quando uma dep muda, limpando a anterior", () => {
    const eventos: string[] = [];
    let bump: () => void;

    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      useEffect(() => {
        eventos.push(`efeito ${count}`);
        return () => eventos.push(`limpeza ${count}`);
      }, [count]);
      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    bump!();

    expect(eventos).toEqual(["efeito 0", "limpeza 0", "efeito 1"]);
  });
});

describe("useRef e useMemo", () => {
  it("useRef devolve o mesmo objeto entre renders", () => {
    const vistos: unknown[] = [];
    let bump: () => void;

    function Probe() {
      const ref = useRef(0);
      const [count, setCount] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      vistos.push(ref);
      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    bump!();

    expect(vistos.length).toBe(2);
    expect(vistos[0]).toBe(vistos[1]);
  });

  it("useMemo só recalcula quando a dep muda", () => {
    let calculos = 0;
    let bump: () => void;
    let trocaDep: () => void;

    function Probe() {
      const [count, setCount] = useState(0);
      const [dep, setDep] = useState(0);
      bump = () => setCount((prev: number) => prev + 1);
      trocaDep = () => setDep((prev: number) => prev + 1);

      useMemo(() => {
        calculos += 1;
        return dep * 2;
      }, [dep]);

      return <p>{count.toString()}</p>;
    }

    render(<Probe />);
    expect(calculos).toBe(1);

    bump!();
    expect(calculos).toBe(1);

    trocaDep!();
    expect(calculos).toBe(2);
  });
});
