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

function arvore() {
  const container = document.createElement("div");
  const root = createHostRootFiber(container, [
    h("div", {}, h("span", {}, "a"), h("b", {}, "c")),
  ]);
  return { container, root };
}

describe("interrupção", () => {
  it("faz uma unidade por fatia quando manda ceder sempre", () => {
    const { root } = arvore();

    const next = workLoop(root, () => true);

    // parou logo depois do primeiro fiber, e diz onde continuar
    expect(next).not.toBeNull();
    expect(next).toBe(root.child);
  });

  it("retomar da continuação chega ao fim", () => {
    const { root } = arvore();

    let next: Fiber | null = root;
    let fatias = 0;

    while (next) {
      next = workLoop(next, () => true);
      fatias += 1;
      if (fatias > 50) throw new Error("não convergiu");
    }

    // a árvore tem root + div + span + texto + b + texto = 6 fibers
    expect(fatias).toBe(6);
  });

  it("fatiar dá a mesma árvore que rodar de uma vez", () => {
    const emFatias = arvore();
    let next: Fiber | null = emFatias.root;
    while (next) next = workLoop(next, () => true);
    commitFiberTree(emFatias.root);

    const deUmaVez = arvore();
    workLoop(deUmaVez.root);
    commitFiberTree(deUmaVez.root);

    expect(emFatias.container.innerHTML).toBe(deUmaVez.container.innerHTML);
  });

  it("não cede quando o predicado diz que há tempo", () => {
    const { root } = arvore();

    expect(workLoop(root, () => false)).toBeNull();
  });

  it("o padrão é rodar até o fim", () => {
    const { root } = arvore();

    expect(workLoop(root)).toBeNull();
  });
});

describe("render concorrente", () => {
  it("só commita quando a árvore inteira terminou", async () => {
    const { container, root } = arvore();
    const estados: string[] = [];

    await new Promise<void>((resolve) => {
      renderFiberTreeConcurrent(
        root,
        (finished) => {
          // antes do commit o container ainda está vazio, mesmo com a render
          // já concluída: uma árvore pela metade nunca chega ao DOM
          estados.push(`render pronto, dom="${container.innerHTML}"`);
          commitFiberTree(finished);
          estados.push(`commit feito, dom="${container.innerHTML}"`);
          resolve();
        },
        () => true, // cede a cada fiber, forçando o caminho fatiado
      );
    });

    expect(estados).toEqual([
      'render pronto, dom=""',
      'commit feito, dom="<div><span>a</span><b>c</b></div>"',
    ]);
  });
});
