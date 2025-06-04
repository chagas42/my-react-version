import React, { useState } from "../src/React";

export function UseStateExample() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>useState Example</h1>
      <p>This example demonstrates the use of the useState hook.</p>
      <div
        style={{
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "5px",
          display: "flex",
          gap: "10px",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <p>Current count: {count.toString()}</p>
        <button type="button" onClick={() => setCount((prev) => prev + 1)}>
          Increment
        </button>
        <button type="button" onClick={() => setCount((prev) => prev - 1)}>
          Decrement
        </button>
      </div>
    </div>
  );
}
