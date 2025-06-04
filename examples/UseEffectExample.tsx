import React, { useEffect, useState } from "../src/React";

export function UseEffectExample() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("useEffect - Updating document title");
    document.title = `You clicked ${count} times`;
    return () => {
      console.log("useEffect cleanup - Resetting document title");
      document.title = "React App";
    };
  }, [count]);

  return (
    <div>
      <h1>useEffect Example - check the document title</h1>
      <button type="button" onClick={() => setCount(count + 1)}>
        Click {count.toString()} times
      </button>
    </div>
  );
}
