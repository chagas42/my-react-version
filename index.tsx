import React from "./src/React";
import ReactDOM from "./src/ReactDOM";
import { App } from "./app";

const fiberEnabled =
  new URLSearchParams(window.location.search).get("fiber") === "1";
const render = fiberEnabled
  ? ReactDOM.renderRootWithFiber
  : ReactDOM.renderRoot;

render(<App />, document.getElementById("root"));
