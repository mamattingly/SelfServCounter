import { useState, useEffect } from "react";
import "./App.css"

const namesArray = [
  "Mike",
  "Amir",
  "Shivani",
  "Todd",
  "John",
  "Dede",
  "Jay",
  "Danny",
  "Orlando",
  "Patricia",
  "Vandermeer",
  "Jett",
  "Desmond"
];

export default function App() {
  const [names, setNames] = useState([]);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const initialNames = namesArray.map(name => ({ name, counter: 0 }));
    setNames(initialNames);
  }, []);

  const handleAddName = () => {
    if (nameInput.trim()) {
      setNames([...names, { name: nameInput, counter: 0 }]);
      setNameInput("");
    }
  };

  const handleDeleteName = (index) => {
    setNames(names.filter((_, i) => i !== index));
  };

  const handleIncrementCounter = (index) => {
    const newNames = [...names];
    newNames[index].counter += 1;
    setNames(newNames);
  };

  const handleDecrementCounter = (index) => {
    const newNames = [...names];
    if (newNames[index].counter > 0) {
      newNames[index].counter -= 1;
      setNames(newNames);
    }
  };

  return (
    <div className="container">
      <div className="form">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Enter a name"
        />
        <button onClick={handleAddName}>Add Name</button>
      </div>
      <div className="names-list">
        {names.map((item, index) => (
          <div key={index} className="name-item">
            <span>{item.name}</span>
              <span>{item.counter}</span>
            <div className="counter-controls">
              <button onClick={() => handleIncrementCounter(index)}>+</button>
              <button onClick={() => handleDecrementCounter(index)}>-</button>
            <button onClick={() => handleDeleteName(index)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
