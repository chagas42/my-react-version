import http from "node:http";
import React from "./React";
import type { Children, Component, Props, ReactComponent } from "./types";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

async function App({ name }) {
  const url = "https://jsonplaceholder.typicode.com/todos";
  const todos: Todo[] = await fetch(url).then((res) => res.json());

  return (
    <html>
      <body>
        <header>
          <h1>Hello {name}!</h1>
          <p>This is a paragraph</p>
          {[1, 2, 3].map((e) => (
            <div key={e}>{e}</div>
          ))}
        </header>
        <main>
          <div id="sus">
            {todos.map((e) => (
              <div key={e.id} style="display: flex; gap: 1rem">
                {e.title} - {e.completed ? "Completed" : "Pending"}
              </div>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}

const server = http.createServer(async (req, res) => {
  const name = req.url.split("/")[1];
  if (name === "favicon.ico") return;
  const app = await renderToHTMLString(<App name={name} />);
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(app);
  res.end();
});

server.listen(3000, () => {
  console.log("listening SSR on port 3000");
});

async function renderToHTMLString(
  component: Component | ReactComponent | Children
): Promise<string> {
  if (!component) return "";

  if (typeof component === "string" || typeof component === "number") {
    return component.toString();
  }

  if (Array.isArray(component)) {
    const elements = await Promise.all(component.map(renderToHTMLString));
    return elements.join("");
  }

  if (typeof component.tag === "function") {
    const element = await component.tag(component.props, component.children);
    return await renderToHTMLString(element);
  }

  return createHTMLString(component.tag, component.props);
}

async function createHTMLString(tag: string, props: Props) {
  const excluded = ["children", "ref", "__self", "__source"];

  if (props.className) {
    props.class = props.className;
    delete props.className;
  }

  if (props.style) {
    if (typeof props.style === "string") {
      props.style = props.style;
    } else if (typeof props.style === "object") {
      props.style = Object.entries(props.style)
        .map(([key, value]) => `${key}: ${value};`)
        .join(" ");
    }
  }

  const tagProps = Object.keys(props)
    .filter((key) => excluded.indexOf(key) == -1)
    .map((key) => `${key.toLowerCase()}="${props[key]}"`)
    .join(" ")
    .trim();

  const openTag = `<${tag} ${tagProps}>`;
  const closeTag = `</${tag}>`;

  let awaitedChildren: string[] = [];

  if (props.children) {
    const promises = props.children.map(renderToHTMLString);
    awaitedChildren = await Promise.all(promises);
  }

  const children = awaitedChildren.join("");
  return `${openTag}${children}${closeTag}`;
}
