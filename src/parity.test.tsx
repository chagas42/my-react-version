import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Os dois reconcilers, lado a lado, no mesmo JSX.
 *
 * O caminho antigo é a referência: o de fiber só pode substituí-lo quando
 * produzir o mesmo DOM. Cada `it.fails` aqui é uma lacuna de paridade que
 * ainda falta fechar.
 */

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

/**
 * HTML com os atributos em ordem alfabética. Os dois reconcilers aplicam props
 * em ordens diferentes, e `innerHTML` preserva essa ordem — sem normalizar, a
 * comparação acusa diferença onde o DOM é equivalente.
 */
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

/** Renderiza o mesmo elemento pelos dois caminhos e devolve o HTML de cada um. */
function bothPaths(element: unknown) {
  const legacy = document.createElement("div");
  ReactDOM.renderRoot(element as never, legacy);

  const fiber = document.createElement("div");
  ReactDOM.renderRootWithFiber(element as never, fiber);

  return { legacy: normalize(legacy), fiber: normalize(fiber) };
}

describe("paridade entre os reconcilers", () => {
  it("host elements aninhados", () => {
    const { legacy, fiber } = bothPaths(
      <div id="a">
        <span>oi</span>
      </div>,
    );

    expect(fiber).toBe(legacy);
  });

  it("function component", () => {
    function Greeting({ name }: { name: string }) {
      return <p>oi {name}</p>;
    }

    const { legacy, fiber } = bothPaths(<Greeting name="celso" />);

    expect(fiber).toBe(legacy);
  });

  it("componentes aninhados", () => {
    const Inner = () => <b>fundo</b>;
    const Outer = () => (
      <div>
        <Inner />
      </div>
    );

    const { legacy, fiber } = bothPaths(<Outer />);

    expect(fiber).toBe(legacy);
  });

  it("lista vinda de map", () => {
    const { legacy, fiber } = bothPaths(
      <ul>
        {[1, 2, 3].map((id) => (
          <li key={id}>item {id}</li>
        ))}
      </ul>,
    );

    expect(fiber).toBe(legacy);
  });

  it("className e style como objeto", () => {
    const { legacy, fiber } = bothPaths(
      <div className="box" style={{ color: "red" }} />,
    );

    expect(fiber).toBe(legacy);
  });

  it("style como string", () => {
    const { legacy, fiber } = bothPaths(<div style="color: red" />);

    expect(fiber).toBe(legacy);
  });

  it("o App inteiro, com os examples", async () => {
    const { App } = await import("../app");

    const { legacy, fiber } = bothPaths(<App />);

    expect(fiber).toBe(legacy);
  });

  it("re-render no mesmo container não duplica a árvore", () => {
    const fiber = document.createElement("div");

    ReactDOM.renderRootWithFiber((<p>um</p>) as never, fiber);
    ReactDOM.renderRootWithFiber((<p>dois</p>) as never, fiber);

    expect(fiber.children.length).toBe(1);
    expect(fiber.textContent).toBe("dois");
  });

  it("re-render mantém o mesmo nó de DOM", () => {
    const fiber = document.createElement("div");

    ReactDOM.renderRootWithFiber((<p>um</p>) as never, fiber);
    const antes = fiber.firstElementChild;

    ReactDOM.renderRootWithFiber((<p>dois</p>) as never, fiber);

    expect(fiber.firstElementChild).toBe(antes);
  });

  it("liga handlers de evento", () => {
    let cliques = 0;
    const fiberContainer = document.createElement("div");

    ReactDOM.renderRootWithFiber(
      (<button onClick={() => (cliques += 1)}>ok</button>) as never,
      fiberContainer,
    );
    (fiberContainer.firstElementChild as HTMLElement).click();

    expect(cliques).toBe(1);
  });
});
