import React from "./src/React";
import ReactDOM from "./src/ReactDOM";
import { App } from "./app";

// `?fiber=1` troca o reconciler recursivo pelo de fiber. Os dois convivem
// enquanto o de fiber não alcança paridade: o antigo é a referência viva.
const useFiber = new URLSearchParams(window.location.search).has("fiber");
const render = useFiber ? ReactDOM.renderRootWithFiber : ReactDOM.renderRoot;

render(<App />, document.getElementById("root"));
