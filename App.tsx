
import { UseEffectExample } from "./examples/UseEffectExample";
import { UseStateExample } from "./examples/UseStateExample";
import { KeyExample } from "./examples/KeyExample";
import { FullExample } from "./examples/FullExample";
import React from "./src/React";

const examples = [
  { title: "useState Example", example: UseStateExample, href: "useState" },
  { title: "useEffect Example", example: UseEffectExample, href: "useEffect" },
  { title: "Key Example", example: KeyExample, href: "key" },
  { title: "Full Example", example: FullExample, href: "fullExample" }
]

export function App(props) {
  const href = window.location.href.split("#")[1];
  const example = examples.find(example => example.href === href) || examples[0];
  const Example = example.example;

  return (
    <div style="display: flex; flex-direction: column; gap: 2rem; padding: 2rem;">
      <h1>React Examples</h1>
      <nav>
        <ul
          style="display: flex; gap: 1rem; padding: 0; margin: 0;"
        >
          {examples.map(example => (
            <li
              onClick={e => {
                e.preventDefault();
                window.location.href = `#${example.href}`;
                window.location.reload();
              }}
            >{example.title}
            </li>
          ))}
        </ul>
      </nav>


      <Example />
    </div >
  )
}
