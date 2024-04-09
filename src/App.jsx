import { useState } from "react";
import "./App.css";


const characterObj = {
  upperChar: {
    A: "Uppercase A as in Alpha",
    B: "Uppercase B as in Bravo",
    C: "Uppercase C as in Charlie",
    D: "Uppercase D as in Delta",
    E: "Uppercase E as in Echo",
    F: "Uppercase F as in Foxtrot",
    G: "Uppercase G as in Golf",
    H: "Uppercase H as in Hotel",
    I: "Uppercase I as in India",
    J: "Uppercase J as in Juliett",
    K: "Uppercase K as in Kilo",
    L: "Uppercase L as in Lima",
    M: "Uppercase M as in Mike",
    N: "Uppercase N as in November",
    O: "Uppercase O as in Oscar",
    P: "Uppercase P as in Papa",
    Q: "Uppercase Q as in Quebec",
    R: "Uppercase R as in Romeo",
    S: "Uppercase S as in Sierra",
    T: "Uppercase T as in Tango",
    U: "Uppercase U as in Uniform",
    V: "Uppercase V as in Victor",
    W: "Uppercase W as in Whiskey",
    X: "Uppercase X as in X-ray",
    Y: "Uppercase Y as in Yankee",
    Z: "Uppercase Z as in Zulu",
  },
  lowerChar: {
    a: "Lowercase a as in Alpha",
    b: "Lowercase b as in Bravo",
    c: "Lowercase c as in Charlie",
    d: "Lowercase d as in Delta",
    e: "Lowercase e as in Echo",
    f: "Lowercase f as in Foxtrot",
    g: "Lowercase g as in Golf",
    h: "Lowercase h as in Hotel",
    i: "Lowercase i as in India",
    j: "Lowercase j as in Juliett",
    k: "Lowercase k as in Kilo",
    l: "Lowercase l as in Lima",
    m: "Lowercase m as in Mike",
    n: "Lowercase n as in November",
    o: "Lowercase o as in Oscar",
    p: "Lowercase p as in Papa",
    q: "Lowercase q as in Quebec",
    r: "Lowercase r as in Romeo",
    s: "Lowercase s as in Sierra",
    t: "Lowercase t as in Tango",
    u: "Lowercase u as in Uniform",
    v: "Lowercase v as in Victor",
    w: "Lowercase w as in Whiskey",
    x: "Lowercase x as in X-ray",
    y: "Lowercase y as in Yankee",
    z: "Lowercase z as in Zulu",
  },
  specialChar: {
    "!": "Exclamation Mark",
    "@": "At Sign",
    "#": "Hash",
    $: "Dollar Sign",
    "%": "Percent Sign",
    "^": "Caret",
    "&": "Ampersand",
    "*": "Asterisk",
    "?": "Question Mark",
  },
  numbers: {
    0: "The number Zero",
    1: "The number One",
    2: "The number Two",
    3: "The number Three",
    4: "The number Four",
    5: "The number Five",
    6: "The number Six",
    7: "The number Seven",
    8: "The number Eight",
    9: "The number Nine",
  },
};

const generatePassword = (
  length,
  hasLower,
  hasUpper,
  hasSpecial,
  hasNumbers
) => {

  let password = "";
  let charSet = "";

  if (hasLower) charSet += Object.keys(characterObj.lowerChar).join('');
  if (hasUpper) charSet += Object.keys(characterObj.upperChar).join('');
  if (hasSpecial) charSet += Object.keys(characterObj.specialChar).join('');
  if (hasNumbers) charSet += Object.keys(characterObj.numbers).join('');

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charSet.length);
    password += charSet[randomIndex];
  }

  return password;
};

const getNatoPhonetic = (string) => {
  let list = [];

  for (let i = 0; i < string.length; i++) {
    const char = string[i];
    if (characterObj.upperChar[char]) {
      list.push(characterObj.upperChar[char]);
    } else if (characterObj.lowerChar[char]) {
      list.push(characterObj.lowerChar[char]);
    } else if (characterObj.specialChar[char]) {
      list.push(characterObj.specialChar[char]);
    } else if (characterObj.numbers[char]) {
      list.push(characterObj.numbers[char]);
    }
  }
  return list;
};

export default function App() {
  const [params, setParams] = useState({
    length: 12,
    hasLower: true,
    hasUpper: true,
    hasSpecial: true,
    hasNumbers: true,
  });
  const [password, setPassword] = useState("");
  const [natoPhonetic, setNatoPhonetic] = useState([]);

  const handleParams = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setParams({ ...params, [name]: newValue });
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(
      params.length,
      params.hasLower,
      params.hasUpper,
      params.hasSpecial,
      params.hasNumbers
    );
    setPassword(newPassword);
    setNatoPhonetic(getNatoPhonetic(newPassword));
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
  };

  return (
    <div className="container">
      <div className="form">
        <div className="form-group">
          <label htmlFor="length">Length</label>
          <input
            type="number"
            id="length"
            name="length"
            value={params.length}
            onChange={handleParams}
          />
        </div>
        <div className="form-group">
          <div className="checkbox-grid">
            <div className="checkbox-group">
              <label htmlFor="hasLower">Lowercase</label>
              <input
                type="checkbox"
                id="hasLower"
                name="hasLower"
                checked={params.hasLower}
                onChange={handleParams}
              />
            </div>
            <div className="checkbox-group">
              <label htmlFor="hasUpper">Uppercase</label>
              <input
                type="checkbox"
                id="hasUpper"
                name="hasUpper"
                checked={params.hasUpper}
                onChange={handleParams}
              />
            </div>
          </div>
          <div className="checkbox-grid">
            <div className="checkbox-group">
              <label htmlFor="hasSpecial">Special Characters</label>
              <input
                type="checkbox"
                id="hasSpecial"
                name="hasSpecial"
                checked={params.hasSpecial}
                onChange={handleParams}
              />
            </div>
            <div className="checkbox-group">
              <label htmlFor="hasNumbers">Numbers</label>
              <input
                type="checkbox"
                id="hasNumbers"
                name="hasNumbers"
                checked={params.hasNumbers}
                onChange={handleParams}
              />
            </div>
          </div>
        </div>
        <button onClick={handleGeneratePassword}>Generate Password</button>
      </div>
      <div className="password">
        <h2>Password</h2>
        <p className="password-text">{password} </p>
        <a onClick={handleCopyPassword}>Copy</a>
        <br />
        <br />
        <br />
        <h2>Nato Phonetic</h2>
        <ol>
          {natoPhonetic.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
