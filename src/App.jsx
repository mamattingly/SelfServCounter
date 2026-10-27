import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "selfServCounter.people.v1";
const LAYOUT_KEY = "selfServCounter.dashboardLayout.v1";
const SECTION_IDS = ["stats", "import", "people"];
const SECTION_LABELS = { stats: "Overview", import: "CSV Import", people: "People" };
const chartColors = ["#76516f", "#6f344d", "#c49aa8", "#a87562", "#53627d", "#8b687e", "#c6a26b", "#536b64", "#a45b5b", "#7b83a8", "#b9a1b7", "#d5b6c2"];
function loadLayout() { try { const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); const order = Array.isArray(saved.order) ? saved.order.filter((id) => SECTION_IDS.includes(id)) : []; return { order: [...order, ...SECTION_IDS.filter((id) => !order.includes(id))], collapsed: saved.collapsed || {}, hidden: saved.hidden || {} }; } catch { return { order: SECTION_IDS, collapsed: {}, hidden: {} }; } }
const defaultNames = ["Mike", "Amir", "Shivani", "Todd", "John", "Dede", "Jay", "Danny", "Orlando", "Patricia", "Vandermeer", "Jett", "Desmond"];
const defaults = defaultNames.map((name) => ({ name, counter: 0 }));

function loadSavedPeople() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return defaults;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaults;
    return parsed.filter((person) => person && typeof person.name === "string")
      .map((person) => ({ name: person.name, counter: Number.isFinite(Number(person.counter)) ? Math.max(0, Math.floor(Number(person.counter))) : 0 }));
  } catch {
    return defaults;
  }
}

// Small CSV parser supporting quoted fields, commas inside quotes, and escaped quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n") { row.push(field.trim().replace(/\r$/, "")); if (row.some((cell) => cell !== "")) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field.trim().replace(/\r$/, ""));
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (quoted) throw new Error("The CSV has a quotation mark that was never closed.");
  return rows;
}

function downloadExample() {
  const csv = "Name,Count\nAlice,12\nBob,7\nCharlie,3\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url; link.download = "selfservcounter-users-example.csv"; link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [names, setNames] = useState([]);
  const [authUser, setAuthUser] = useState(undefined);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [userAdminOpen, setUserAdminOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRole, setAccountRole] = useState("viewer");
  const [nameInput, setNameInput] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const [dashboardLayout, setDashboardLayout] = useState(loadLayout);

  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(dashboardLayout)); } catch { /* Optional layout persistence. */ }
  }, [dashboardLayout]);

  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };
  const refreshPeople = async () => { const data = await api("/api/people"); setNames(data.people); };
  const performAction = async (action) => {
    try { const data = await api("/api/people/actions", { method: "POST", body: JSON.stringify(action) }); setNames(data.people); return true; }
    catch (error) { setNotice({ type: "error", text: error.message }); return false; }
  };
  useEffect(() => {
    let active = true;
    api("/api/session").then(({ user }) => {
      if (!active) return;
      setAuthUser(user || null);
      if (user) refreshPeople().catch(error => setNotice({ type: "error", text: error.message }));
    }).catch(() => { if (active) setAuthUser(null); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!authUser) return undefined;
    const events = new EventSource("/api/events");
    events.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === "people") setNames(message.people); } catch {} };
    events.onerror = () => { refreshPeople().catch(()=>{}); };
    return () => events.close();
  }, [authUser?.id]);
  useEffect(() => {
    if (userAdminOpen && authUser?.role === "admin") api("/api/users").then(data => setAccounts(data.users)).catch(error => setNotice({ type: "error", text: error.message }));
  }, [userAdminOpen, authUser?.role]);

  const total = useMemo(() => names.reduce((sum, person) => sum + person.counter, 0), [names]);
  const copyTeamsTotals = async () => {
    const lines = [
      "**SelfServ Counter — Totals**",
      ...names.map((person) => `• ${person.name}: ${person.counter.toLocaleString()}`),
      "",
      `**People:** ${names.length}`,
      `**Combined total:** ${total.toLocaleString()}`,
    ];
    const summary = lines.join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setNotice({ type: "success", text: "Totals copied. Paste them into your Teams chat." });
    } catch {
      setNotice({ type: "error", text: "Clipboard access was blocked. Use a secure connection (HTTPS) and try again." });
    }
  };
  const toggleSection = (id) => setDashboardLayout((current) => ({ ...current, collapsed: { ...current.collapsed, [id]: !current.collapsed[id] } }));
  const toggleHidden = (id) => setDashboardLayout((current) => ({ ...current, hidden: { ...current.hidden, [id]: !current.hidden[id] } }));
  const moveSection = (id, delta) => setDashboardLayout((current) => { const order = [...current.order]; const from = order.indexOf(id); const to = Math.max(0, Math.min(order.length - 1, from + delta)); order.splice(from, 1); order.splice(to, 0, id); return { ...current, order }; });
  const moveSectionBefore = (source, target) => setDashboardLayout((current) => { if (!SECTION_IDS.includes(source) || !SECTION_IDS.includes(target) || source === target) return current; const order = [...current.order]; order.splice(order.indexOf(source), 1); order.splice(order.indexOf(target), 0, source); return { ...current, order }; });
  const sectionTools = (id, label) => <div className="section-tools"><button className="section-tool drag-handle" type="button" draggable="true" aria-label={`Drag to move ${label}`} title="Drag this section to reorder" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }}>⠿ Drag</button><button className="section-tool" type="button" aria-label={`Move ${label} up`} title="Move section up" disabled={dashboardLayout.order.indexOf(id) === 0} onClick={() => moveSection(id, -1)}>↑ Up</button><button className="section-tool" type="button" aria-label={`Move ${label} down`} title="Move section down" disabled={dashboardLayout.order.indexOf(id) === SECTION_IDS.length - 1} onClick={() => moveSection(id, 1)}>↓ Down</button><button className="section-tool" type="button" aria-expanded={!dashboardLayout.collapsed[id]} onClick={() => toggleSection(id)}>{dashboardLayout.collapsed[id] ? "＋ Expand" : "− Collapse"}</button><button className="section-tool hide-section" type="button" onClick={() => toggleHidden(id)}>Hide</button></div>;
  const filteredNames = useMemo(() => names.filter((person) => person.name.toLowerCase().includes(search.trim().toLowerCase())), [names, search]);
  const submitLogin = async (event) => {
    event.preventDefault(); setLoginBusy(true); setNotice({ type: "", text: "" });
    try { const data = await api("/api/login", { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) }); setAuthUser(data.user); setLoginPassword(""); }
    catch (error) { setNotice({ type: "error", text: error.message }); } finally { setLoginBusy(false); }
  };
  const signOut = async () => { try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {} setAuthUser(null); setNames([]); setUserAdminOpen(false); };
  const createAccount = async (event) => {
    event.preventDefault();
    try { await api("/api/users", { method: "POST", body: JSON.stringify({ email: accountEmail, password: accountPassword, role: accountRole }) }); setAccountEmail(""); setAccountPassword(""); const data = await api("/api/users"); setAccounts(data.users); setNotice({ type: "success", text: "Account created." }); }
    catch (error) { setNotice({ type: "error", text: error.message }); }
  };
  const removeAccount = async (id) => {
    if (!window.confirm("Delete this account?")) return;
    try { await api("/api/users/" + id, { method: "DELETE" }); setAccounts(current => current.filter(account => account.id !== id)); }
    catch (error) { setNotice({ type: "error", text: error.message }); }
  };
  if (authUser === undefined) return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">SC</div><h1>SelfServ <span>Counter</span></h1><p>Checking sign-in…</p></div></main>;
  if (!authUser) return <main className="auth-shell"><form className="auth-card" onSubmit={submitLogin}><div className="brand-mark">SC</div><p className="eyebrow">SECURE WORKSPACE</p><h1>SelfServ <span>Counter</span></h1><p className="subtitle">Sign in to view shared counts.</p><label>Email address<input type="email" autoComplete="username" required value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} /></label><button className="button button-primary" type="submit" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>{notice.text && <p className={"notice notice-" + (notice.type || "success")}>{notice.text}</p>}</form></main>;
  const personColor = (person) => chartColors[names.indexOf(person) % chartColors.length];

  const handleAddName = async () => {
    const name = nameInput.trim();
    if (!name) return;
    if (names.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
      setNotice({ type: "error", text: "That name is already on the list." }); return;
    }
    await performAction({ type: "add", name });
    setNameInput("");
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setNotice({ type: "", text: "" });
    try {
      const rows = parseCSV(await file.text());
      if (rows.length < 2) throw new Error("The CSV needs a header row and at least one user.");
      const headers = rows[0].map((cell) => cell.trim().toLowerCase());
      const nameIndex = headers.findIndex((header) => ["name", "person", "user", "username"].includes(header));
      const countIndex = headers.findIndex((header) => ["count", "counter", "total"].includes(header));
      if (nameIndex < 0) throw new Error('Could not find a name column. Use a header called "Name".');
      const currentByName = new Map(names.map((person) => [person.name.trim().toLowerCase(), person.counter]));
      const imported = [];
      const seen = new Set();
      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i];
        const name = (row[nameIndex] || "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) throw new Error(`Duplicate name "${name}" on CSV row ${i + 1}. Names must be unique.`);
        seen.add(key);
        let counter = currentByName.get(key) ?? 0;
        if (countIndex >= 0 && (row[countIndex] || "").trim() !== "") {
          const rawCount = (row[countIndex] || "").trim();
          if (!/^\d+$/.test(rawCount)) throw new Error(`Count for "${name}" on CSV row ${i + 1} must be a whole number zero or greater.`);
          counter = Number(rawCount);
          if (!Number.isSafeInteger(counter)) throw new Error(`Count for "${name}" is too large.`);
        } else if (countIndex >= 0) {
          counter = 0;
        }
        imported.push({ name, counter });
      }
      if (!imported.length) throw new Error("No users with names were found in the CSV.");
      await performAction({ type: "replace", people: imported });
      setNotice({ type: "success", text: `Imported ${imported.length} users to the shared list.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to read this CSV file." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const changeCounter = (index, delta) => { const person = names[index]; if (person) performAction({ type: delta > 0 ? "increment" : "decrement", name: person.name }); };
  const deletePerson = (index) => { const person = names[index]; if (person && window.confirm(`Remove ${person.name} from the shared list?`)) performAction({ type: "delete", name: person.name }); };
  const resetCounts = () => {
    if (window.confirm("Reset every person's count to zero? This cannot be undone.")) {
      performAction({ type: "reset" });
    }
  };

  const sections = {
    stats: <section className="dashboard-section" key="stats" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveSectionBefore(event.dataTransfer.getData("text/plain"), "stats"); }}><div className="dashboard-section-header"><div><p className="eyebrow">AT A GLANCE</p><h2>Overview</h2></div>{authUser.role !== "viewer" && sectionTools("stats", "Overview")}</div>{!dashboardLayout.collapsed.stats && <div className="stats-row"><div className="stat-card"><span className="stat-label">People on list</span><strong>{names.length}</strong></div><div className="stat-card"><span className="stat-label">Combined count</span><strong>{total.toLocaleString()}</strong></div><div className="stat-card"><span className="stat-label">Storage</span><strong className="storage-value">Local device</strong></div><div className="stat-card teams-share-card"><span className="stat-label">Share totals</span><strong className="storage-value">Microsoft Teams</strong><p className="share-copy-hint">Copy names and counts as a chat-ready summary.</p><button className="button button-primary teams-copy-button" type="button" onClick={copyTeamsTotals}>Copy totals for Teams</button></div><div className="overview-chart-panel"><div><p className="eyebrow">COUNT DISTRIBUTION</p><h3>Counts by person</h3><p className="chart-description">Each slice represents a person's share of the combined total.</p></div>{total > 0 ? <div className="pie-chart-layout"><div className="pie-chart" role="img" aria-label={names.map((person) => `${person.name}: ${person.counter}`).join(", ")} style={{ background: `conic-gradient(${names.filter((person) => person.counter > 0).reduce((state, person) => { const start = state.offset; const end = start + (person.counter / total) * 100; state.parts.push(`${state.color} ${start}% ${end}%`); state.offset = end; state.colorIndex += 1; state.color = chartColors[state.colorIndex % chartColors.length]; return state; }, { offset: 0, colorIndex: 0, color: chartColors[0], parts: [] }).parts.join(", ")})` }}><div className="pie-chart-hole"><strong>{total.toLocaleString()}</strong><span>Total</span></div></div><ul className="chart-legend">{names.filter((person) => person.counter > 0).map((person) => <li key={person.name}><span className="legend-dot" style={{ backgroundColor: personColor(person) }} /><span className="legend-name">{person.name}</span><strong>{person.counter.toLocaleString()}</strong><span className="legend-percent">{((person.counter / total) * 100).toFixed(1)}%</span></li>)}</ul></div> : <p className="chart-empty">Add counts to see the pie chart.</p>}</div></div>}</section>,
    import: <section className="dashboard-section panel import-panel" key="import" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveSectionBefore(event.dataTransfer.getData("text/plain"), "import"); }}><div className="dashboard-section-header"><div><p className="eyebrow">BULK UPDATE</p><h2>Import users from CSV</h2></div>{authUser.role !== "viewer" && sectionTools("import", "CSV import")}</div>{!dashboardLayout.collapsed.import && <div className="section-content"><div className="section-heading"><p className="help-copy">Upload a CSV to replace the displayed list with its users. Existing counts are kept for matching names if you leave out the Count column. If Count is included, those values update the counts. Anyone not in the CSV is removed.</p><button className="button button-secondary" onClick={downloadExample} type="button">Download example CSV</button></div><div className="upload-row">{authUser.role !== "viewer" && <label className="file-picker"><span aria-hidden="true">↑</span> {busy ? "Reading CSV…" : "Choose CSV file"}<input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleImport} disabled={busy} /></label>}<span className="file-hint">.csv files only · Nothing is uploaded to a server</span></div><details className="csv-help"><summary>How should I format the CSV?</summary><div className="help-details"><p><strong>Required:</strong> a header row with a <code>Name</code> column. Optional count headers: <code>Count</code>, <code>Counter</code>, or <code>Total</code>.</p><pre>{'Name,Count\nAlice,12\nBob,7\nCharlie,3'}</pre><ul><li>Save the spreadsheet as <strong>CSV UTF-8 (Comma delimited)</strong>.</li><li>Each person should appear once; duplicate names are rejected.</li><li>Counts must be whole numbers of zero or greater.</li><li>Names match case-insensitively when keeping existing counts.</li><li>Review the list before importing: the CSV becomes the full list.</li></ul></div></details></div>}</section>,
    people: <section className="dashboard-section panel people-panel" key="people" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveSectionBefore(event.dataTransfer.getData("text/plain"), "people"); }}><div className="dashboard-section-header"><div><p className="eyebrow">YOUR LIST</p><h2>People <span className="count-pill">{names.length}</span></h2></div>{authUser.role !== "viewer" && sectionTools("people", "People")}</div>{!dashboardLayout.collapsed.people && <div className="section-content"><div className="people-toolbar"><div className="search-wrap"><span aria-hidden="true">⌕</span><input aria-label="Search people" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names…" /></div></div>{authUser.role !== "viewer" && <form className="add-form" onSubmit={(event) => { event.preventDefault(); handleAddName(); }}><input aria-label="New person name" value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Enter a person name…" maxLength={100} /><button className="button button-primary" type="submit">+ Add person</button></form>}{filteredNames.length === 0 ? <div className="empty-state"><span aria-hidden="true">◎</span><h3>{names.length ? "No matching people" : "Your list is empty"}</h3><p>{names.length ? "Try a different search." : "Add a person above or import a CSV to get started."}</p></div> : <div className="people-grid">{filteredNames.map((person) => { const index = names.indexOf(person); return <article className="person-card" key={person.name.toLowerCase()}><div className="person-top"><div className="avatar">{person.name.trim().charAt(0).toUpperCase()}</div><div className="person-name" title={person.name}>{person.name}</div>{authUser.role !== "viewer" && <button className="icon-button delete-button" aria-label={`Delete ${person.name}`} title="Remove person" onClick={() => deletePerson(index)} type="button">×</button>}</div><div className="counter-display" style={{ backgroundColor: `${personColor(person)}22`, borderColor: `${personColor(person)}88` }}><span>Current count</span><strong style={{ color: personColor(person) }}>{person.counter.toLocaleString()}</strong></div>{authUser.role !== "viewer" && <div className="counter-controls"><button className="counter-button decrement" aria-label={`Decrease ${person.name} count`} onClick={() => changeCounter(index, -1)} disabled={person.counter === 0} type="button">−</button><button className="counter-button increment" aria-label={`Increase ${person.name} count`} onClick={() => changeCounter(index, 1)} type="button">+</button></div>}</article>; })}</div>}<div className="list-footer"><span>Changes save automatically in this browser.</span>{authUser.role !== "viewer" && <button className="text-button" type="button" onClick={resetCounts}>Reset all counts</button>}</div></div>}</section>
  };
  return (
    <main className="app-shell">
      <header className="page-header"><div className="brand-mark" aria-hidden="true">SC</div><div className="heading-copy"><p className="eyebrow">SIMPLE · LOCAL · PRIVATE</p><h1>SelfServ <span>Counter</span></h1><p className="subtitle">Keep track of people and their counts in one place.</p></div><div className="saved-indicator"><span className="status-dot" /> Shared server data</div><div className="user-actions"><span>{authUser.email} · {authUser.role}</span>{authUser.role === "admin" && <button className="button button-secondary" type="button" onClick={() => setUserAdminOpen(value => !value)}>{userAdminOpen ? "Close users" : "User management"}</button>}<button className="button button-secondary" type="button" onClick={signOut}>Sign out</button></div></header>
      <div className="dashboard-intro"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Dashboard</h2><p>Use the arrows to rearrange sections and collapse anything you don't need right now. Your layout is saved in this browser.</p></div><button className="button button-secondary reset-layout" type="button" onClick={() => setDashboardLayout({ order: SECTION_IDS, collapsed: {}, hidden: {} })}>Reset layout</button></div>

      <div className="shared-data-note">Changes sync automatically for signed-in users. {authUser.role === "viewer" ? "Your account has read-only access." : "Your changes are saved to the shared server."}</div>{userAdminOpen && authUser.role === "admin" && <section className="panel user-admin"><h2>User management</h2><p>Create named accounts. Passwords must be at least 12 characters.</p><form className="add-form" onSubmit={createAccount}><input type="email" aria-label="Account email" placeholder="Email address" required value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} /><input type="password" aria-label="Temporary password" placeholder="Password (12+ characters)" minLength={12} required value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} /><select aria-label="Account role" value={accountRole} onChange={e=>setAccountRole(e.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select><button className="button button-primary" type="submit">Create account</button></form><ul className="account-list">{accounts.map(account=><li key={account.id}><span><strong>{account.email}</strong><small>{account.role}</small></span>{account.id !== authUser.id && <button className="text-button" type="button" onClick={()=>removeAccount(account.id)}>Delete</button>}</li>)}</ul></section>}<div className="dashboard-sections" aria-label="Dashboard sections">{dashboardLayout.order.filter((id) => !dashboardLayout.hidden[id]).map((id) => sections[id])}</div>
      {notice.text && <div className={`notice notice-${notice.type || "success"}`} role="status">{notice.text}</div>}
      <footer className="page-footer">SelfServ Counter <span>·</span> Your list stays in this browser, not on a server.</footer>
      {SECTION_IDS.some((id) => dashboardLayout.hidden[id]) && <div className="hidden-sections" aria-label="Hidden dashboard sections"><strong>Hidden sections</strong><span>Restore any section when you need it.</span>{SECTION_IDS.filter((id) => dashboardLayout.hidden[id]).map((id) => <button className="section-tool restore-section" key={id} type="button" onClick={() => toggleHidden(id)}>＋ Show {SECTION_LABELS[id]}</button>)}</div>}
    </main>
  );
}
