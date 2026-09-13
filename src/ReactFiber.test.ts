import { describe, expect, it } from "vitest";
import React from "./React";
import {
  NoLanes,
  SyncLane,
  createFiber,
  createHostRootFiber,
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

describe("fase de commit", () => {
  // BUG: beginWork faz `fiber.flags.clear()` logo na entrada, apagando o
  // Placement que o reconcileChildren do PAI acabou de marcar. Nenhuma flag
  // sobrevive até o commit, então commitWork não faz nada e o container fica
  // vazio. É o que impede o fiber path inteiro de renderizar.
  // Vira `it` quando a limpeza sair de beginWork.
  it.fails("põe a árvore no container", () => {
    const { container } = render(h("div", { id: "a" }, h("span", {}, "oi")));

    expect(container.innerHTML).toBe('<div id="a"><span>oi</span></div>');
  });

  it.fails("marca Placement em cada fiber novo", () => {
    const { root } = render(h("div", {}, h("span")));

    const div = root.child!;
    expect(div.flags.has("Placement")).toBe(true);
    expect(div.child!.flags.has("Placement")).toBe(true);
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

  // BUG: o bailout em beginWork devolve null em vez de clonar os filhos, então
  // a subárvore inteira some da work-in-progress tree e nada dentro dela é
  // reconciliado. Vira `it` quando o bailout clonar os filhos.
  it.fails("marca Deletion nos filhos que sobraram", () => {
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
