import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caracteriza o reconciler recursivo — o caminho que `index.tsx` usa hoje.
 *
 * Estes testes não descrevem o que o React deveria fazer: descrevem o que este
 * repo já faz. São o contrato que o fiber path precisa satisfazer antes de
 * poder substituir este caminho.
 *
 * `React` e `ReactDOM` são singletons de módulo que guardam estado de hook e a
 * árvore anterior. Sem reimportar a cada teste, o estado de um vaza para o
 * próximo. Como `React.tsx` publica `globalThis.React`, o JSX daqui resolve
 * sempre a instância recém-carregada.
 */

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

describe("render de elementos", () => {
  it("monta uma árvore de host elements", () => {
    ReactDOM.renderRoot(
      <div id="a">
        <span>oi</span>
      </div>,
      container,
    );

    expect(container.innerHTML).toBe('<div id="a"><span>oi</span></div>');
  });

  it("chama a função do componente", () => {
    function Greeting({ name }: { name: string }) {
      return <p>oi {name}</p>;
    }

    ReactDOM.renderRoot(<Greeting name="celso" />, container);

    expect(container.textContent).toBe("oi celso");
  });

  it("aninha componentes", () => {
    const Inner = () => <b>fundo</b>;
    const Outer = () => (
      <div>
        <Inner />
      </div>
    );

    ReactDOM.renderRoot(<Outer />, container);

    expect(container.innerHTML).toBe("<div><b>fundo</b></div>");
  });

  it("recusa root vazio", () => {
    expect(() => ReactDOM.renderRoot(null as never, container)).toThrow(
      "No root component provided",
    );
  });
});

describe("props", () => {
  it("aplica className e style", () => {
    ReactDOM.renderRoot(
      <div className="box" style={{ color: "red" }} />,
      container,
    );

    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe("box");
    expect(div.style.color).toBe("red");
  });

  it("liga handlers de evento", () => {
    let cliques = 0;
    ReactDOM.renderRoot(
      <button onClick={() => (cliques += 1)}>ok</button>,
      container,
    );

    (container.firstElementChild as HTMLElement).click();

    expect(cliques).toBe(1);
  });
});

describe("reconciliação por key", () => {
  const lista = (ids: number[]) => (
    <ul>
      {ids.map((id) => (
        <li key={id}>item {id}</li>
      ))}
    </ul>
  );

  it("produz a nova ordem", () => {
    ReactDOM.renderRoot(lista([1, 2, 3]), container);
    ReactDOM.renderRoot(lista([3, 1, 2]), container);

    expect(container.textContent).toBe("item 3item 1item 2");
  });

  it("reusa o nó da posição, não o nó da key", () => {
    ReactDOM.renderRoot(lista([1, 2, 3]), container);
    const antes = [...container.querySelectorAll("li")];

    ReactDOM.renderRoot(lista([3, 1, 2]), container);
    const depois = [...container.querySelectorAll("li")];

    // A saída visível fica certa, mas o nó de DOM de cada posição é reescrito
    // em vez de movido: depois[0] é o mesmo objeto que antes[0], não antes[2].
    // Preservar identidade por key é o que mantém foco, scroll e estado de
    // <input> ao reordenar — este reconciler não faz isso.
    expect(depois[0]).toBe(antes[0]);
    expect(depois[0]).not.toBe(antes[2]);
  });

  it("deixa a key vazar como atributo do DOM", () => {
    ReactDOM.renderRoot(lista([1]), container);

    // key é metadado de reconciliação; o React real não a emite no DOM.
    expect(container.innerHTML).toContain('key="1"');
  });

  it("remove o nó de quem saiu da lista", () => {
    const lista = (ids: number[]) => (
      <ul>
        {ids.map((id) => (
          <li key={id}>item {id}</li>
        ))}
      </ul>
    );

    ReactDOM.renderRoot(lista([1, 2, 3]), container);
    ReactDOM.renderRoot(lista([1, 3]), container);

    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.textContent).toBe("item 1item 3");
  });
});

describe("useState", () => {
  it("guarda o valor inicial", () => {
    function Counter() {
      const [count] = useState(7);
      return <p>{count.toString()}</p>;
    }

    ReactDOM.renderRoot(<Counter />, container);

    expect(container.textContent).toBe("7");
  });

  it("re-renderiza com o novo valor", () => {
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

  it("dá estado próprio a duas instâncias do mesmo componente", () => {
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
