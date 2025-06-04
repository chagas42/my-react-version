import React, { useState } from "../src/React";

export function KeyExample() {
  const [items, setItems] = useState([
    { id: 1, text: "Item 1" },
    { id: 2, text: "Item 2" },
    { id: 3, text: "Item 3" },
    { id: 4, text: "Item 4" },
    { id: 5, text: "Item 5" },
  ]);

  function addItem() {
    const newItem = { id: items.length + 1, text: `Item ${items.length + 1}` };
    setItems((prevItems) => [...prevItems, newItem]);
  }

  function removeItem(id) {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }

  return (
    <div>
      <h1>Key Example</h1>
      <button type="button" onClick={addItem}>
        Add Item
      </button>
      <ul
        style={{
          maxWidth: "300px",
          margin: "20px 0",
          padding: 0,
          listStyleType: "none",
        }}
      >
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {item.text}
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              style={{ background: "red", color: "white" }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
