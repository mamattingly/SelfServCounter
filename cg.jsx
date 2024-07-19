import { useState, useEffect } from "react";

const namesArray = [
  "Mike",
  "Alejandro",
  "Peter",
  "Hendry",
  "Katlego",
  "Winston",
  "Bonolo",
  "Namhla",
  "Joss",
  "Ruth",
  "Nanga",
  "Scelo",
  "Sabelo",
  "Jay",
  "Orlando",
  "Daniel",
  "Andy",
  "Danny",
  "Matt W",
  "Shivani",
  "Sarah",
  "Richard",
  "Sydney",
  "Heiler",
  "Brett"
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
            <div className="counter-controls">
              <span>{item.counter}</span>
              <button onClick={() => handleIncrementCounter(index)}>+</button>
              <button onClick={() => handleDecrementCounter(index)}>-</button>
            </div>
            <button onClick={() => handleDeleteName(index)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
