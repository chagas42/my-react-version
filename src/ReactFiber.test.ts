import { describe, expect, it } from "vitest";
import React from "./React";
import {
  NoLanes,
  SyncLane,
  createFiber,
  createHostRootFiber,
  commitFiberTree,
  createWorkInProgress,
  renderFiberRoot,
  renderFiberTree,
} from "./ReactFiber";
import type { Fiber } from "./ReactFiber";
import type { Component } from "./types";

const h = (tag: any, props: any = {}, ...children: any[]) =>
  React.createElement(tag, props, ...children) as Component;

/** A árvore de fibers como texto, para comparar forma sem navegar ponteiro a ponteiro. */
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

describe("estrutura do fiber", () => {
  it("começa zerado", () => {
    const fiber = createFiber("HostComponent", "div", { id: "x" });

    expect(fiber.lanes).toBe(NoLanes);
    expect(fiber.childLanes).toBe(NoLanes);
    expect(fiber.child).toBeNull();
    expect(fiber.sibling).toBeNull();
    expect(fiber.return).toBeNull();
    expect(fiber.alternate).toBeNull();
    expect(fiber.stateNode).toBeNull();
    expect(fiber.memoizedProps).toBeNull();
    expect([...fiber.flags]).toEqual([]);
  });

  it("o host root guarda o container em stateNode", () => {
    const container = document.createElement("div");
    const root = createHostRootFiber(container, []);

    expect(root.tag).toBe("HostRoot");
    expect(root.stateNode).toBe(container);
  });

  it("createWorkInProgress liga os dois lados do alternate", () => {
    const current = createFiber("HostComponent", "div", { id: "old" });
    const wip = createWorkInProgress(current, { id: "new" });

    expect(wip.alternate).toBe(current);
    expect(current.alternate).toBe(wip);
    expect(wip.type).toBe(current.type);
    expect(wip.pendingProps).toEqual({ id: "new" });
  });
});

describe("fase de render", () => {
  it("liga filhos e irmãos na ordem do JSX", () => {
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

  it("todo filho aponta de volta para o pai", () => {
    const { root } = render(h("div", {}, h("span")));

    const div = root.child!;
    const span = div.child!;

    expect(div.return).toBe(root);
    expect(span.return).toBe(div);
  });

  it("chama a função do componente e desce no que ela devolve", () => {
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

  it("cria o nó de DOM de cada host fiber", () => {
    const { root } = render(h("div", {}, h("span", {}, "texto")));

    const div = root.child!;
    const span = div.child!;
    const text = span.child!;

    expect(div.stateNode).toBeInstanceOf(HTMLDivElement);
    expect(span.stateNode).toBeInstanceOf(HTMLSpanElement);
    expect(text.stateNode).toBeInstanceOf(Text);
  });

  it("um function component não tem nó de DOM próprio", () => {
    function Wrapper() {
      return h("p");
    }

    const { root } = render(h(Wrapper));

    expect(root.child!.tag).toBe("FunctionComponent");
    expect(root.child!.stateNode).toBeNull();
  });

  it("consome a lane do root durante o render", () => {
    const container = document.createElement("div");
    const root = createHostRootFiber(container, [h("div")]);

    root.lanes = SyncLane;
    renderFiberTree(root);

    // beginWork zera a lane ao processar o fiber: trabalho pedido virou
    // trabalho feito. É o que faz o bailout da próxima render funcionar.
    expect(root.lanes).toBe(NoLanes);
  });
});

describe("bailout", () => {
  it("preserva a subárvore ao pular um fiber sem trabalho", () => {
    const container = document.createElement("div");
    const props = { children: [h("div", {}, h("span"))] };

    const first = createHostRootFiber(container, props.children);
    renderFiberTree(first);

    // mesmos props, nenhuma lane: o root não tem o que fazer
    const second = createWorkInProgress(first, first.memoizedProps ?? props);
    renderFiberTree(second);

    // a subárvore continua alcançável — pular não é descartar
    expect(second.child).not.toBeNull();
  });

  it("desce quando os props mudaram", () => {
    const container = document.createElement("div");

    const first = createHostRootFiber(container, [h("div", { id: "a" })]);
    renderFiberTree(first);

    const second = createWorkInProgress(first, {
      children: [h("div", { id: "b" })],
    });
    renderFiberTree(second);

    expect(second.child!.pendingProps.id).toBe("b");
  });
});

describe("fase de commit", () => {
  it("põe a árvore no container", () => {
    const { container } = render(h("div", { id: "a" }, h("span", {}, "oi")));

    expect(container.innerHTML).toBe('<div id="a"><span>oi</span></div>');
  });

  it("marca Placement em cada fiber novo", () => {
    const container = document.createElement("div");
    const root = createHostRootFiber(container, [h("div", {}, h("span"))]);

    renderFiberTree(root); // sem commit: as flags ainda não foram consumidas

    const div = root.child!;
    expect(div.flags.has("Placement")).toBe(true);
    expect(div.child!.flags.has("Placement")).toBe(true);
  });

  it("consome as flags ao commitar", () => {
    const { root } = render(h("div", {}, h("span")));

    // um fiber pulado por bailout é compartilhado entre as duas árvores.
    // se as flags sobrevivessem, ele seria reinserido na render seguinte.
    expect([...root.child!.flags]).toEqual([]);
  });
});

describe("reconciliação por key", () => {
  const lista = (ids: number[]) =>
    ids.map((id) => h("li", { key: id }, `item ${id}`));

  function renderTwice(primeira: number[], segunda: number[]) {
    const container = document.createElement("div");

    const first = createHostRootFiber(container, lista(primeira));
    renderFiberTree(first);

    const second = createWorkInProgress(first, { children: lista(segunda) });
    renderFiberTree(second);

    return { first, second };
  }

  /** Os fibers filhos, em ordem, como lista. */
  function filhos(fiber: Fiber): Fiber[] {
    const out: Fiber[] = [];
    for (let c = fiber.child; c; c = c.sibling) out.push(c);
    return out;
  }

  it("reencontra o fiber da key mesmo fora de ordem", () => {
    const { first, second } = renderTwice([1, 2, 3], [3, 1, 2]);

    const antes = filhos(first);
    const depois = filhos(second);

    expect(depois.map((f) => f.key)).toEqual([3, 1, 2]);
    // o fiber da key 3 é o mesmo de antes, reusado — não um recém-criado
    expect(depois[0].alternate).toBe(antes[2]);
    expect(depois[0].flags.has("Update")).toBe(true);
  });

  it("reusa o nó de DOM ao reordenar", () => {
    const { first, second } = renderTwice([1, 2, 3], [3, 1, 2]);

    expect(filhos(second)[0].stateNode).toBe(filhos(first)[2].stateNode);
  });

  /** Render + commit duas vezes no mesmo container, como uma re-render real. */
  function commitTwice(primeira: number[], segunda: number[]) {
    const container = document.createElement("div");

    const first = createHostRootFiber(container, lista(primeira));
    renderFiberTree(first);
    commitFiberTree(first);
    const antes = [...container.children];

    const second = createWorkInProgress(first, { children: lista(segunda) });
    second.stateNode = container;
    renderFiberTree(second);
    commitFiberTree(second);

    return { container, antes };
  }

  it("move os nós para a nova ordem no DOM", () => {
    const { container } = commitTwice([1, 2, 3], [3, 1, 2]);

    expect(container.textContent).toBe("item 3item 1item 2");
  });

  it("move o nó em vez de recriá-lo", () => {
    const { container, antes } = commitTwice([1, 2, 3], [3, 1, 2]);

    // o <li> da key 3 é o mesmo objeto de antes, só mudou de posição
    expect(container.children[0]).toBe(antes[2]);
  });

  it("insere no meio sem jogar para o fim", () => {
    const { container } = commitTwice([1, 3], [1, 2, 3]);

    expect(container.textContent).toBe("item 1item 2item 3");
  });

  it("tira do DOM quem saiu da lista", () => {
    const { container } = commitTwice([1, 2, 3], [1, 3]);

    expect(container.children.length).toBe(2);
    expect(container.textContent).toBe("item 1item 3");
  });

  it("marca Placement só em quem é novo", () => {
    const { second } = renderTwice([1, 2], [1, 2, 3]);

    const depois = filhos(second);
    expect(depois[0].flags.has("Update")).toBe(true);
    expect(depois[1].flags.has("Update")).toBe(true);
    expect(depois[2].flags.has("Placement")).toBe(true);
  });

  it("marca Deletion em quem saiu, mesmo fora de ordem", () => {
    const { second } = renderTwice([1, 2, 3], [3, 1]);

    expect(second.deletions.map((f) => f.key)).toEqual([2]);
  });
});

describe("reconciliação por posição", () => {
  it("reusa o fiber quando o tipo casa, e marca Update", () => {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, [h("div", { id: "a" })]);
    renderFiberTree(first);

    const second = createWorkInProgress(first, {
      children: [h("div", { id: "b" })],
    });
    renderFiberTree(second);

    const reused = second.child!;
    expect(reused.alternate).toBe(first.child);
    expect(reused.flags.has("Update")).toBe(true);
  });

  it("marca Deletion nos filhos que sobraram", () => {
    const container = document.createElement("div");
    const first = createHostRootFiber(container, [
      h("div", {}, h("span"), h("b")),
    ]);
    renderFiberTree(first);

    const second = createWorkInProgress(first, {
      children: [h("div", {}, h("span"))],
    });
    renderFiberTree(second);

    const div = second.child!;
    expect(div.deletions.length).toBe(1);
    expect(div.deletions[0].type).toBe("b");
  });
});
