// Fundfinch: matches grants to your organisation, tracks deadlines, and drafts applications from answers you have written before.
import { useState } from "react";
import { downloadIcs, localDate } from "./lib/ics";
import { moneyFmt } from "./lib/money";
import { download, uid, useStored } from "./lib/store";
import { addDays, todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "fundfinch";
type Org = { name: string; sector: string[]; country: string; staff: number; budget: number; currency: string };
type Grant = { id: string; funder: string; name: string; amount: number; deadline: string; url: string; sectors: string[]; countries: string[]; maxStaff: number; stage: "found" | "writing" | "submitted" | "won" | "lost"; questions: string };
type Answer = { id: string; q: string; a: string };
const SECTORS = ["Education", "Health", "Environment", "Women and girls", "Youth", "Culture", "Digital", "Agriculture", "Social enterprise"];
const SAMPLE_GRANTS: Grant[] = [
  { id: "g1", funder: "Example Foundation", name: "Youth digital skills fund", amount: 25000, deadline: addDays(todayISO(), 21), url: "", sectors: ["Youth", "Digital", "Education"], countries: ["Tunisia", "Morocco"], maxStaff: 50, stage: "writing", questions: "Describe your organisation and its mission.\nWhat problem does this project address?\nHow will you measure impact?\nWhat is the total budget and how will funds be used?" },
  { id: "g2", funder: "Green Coast Trust", name: "Coastal clean-up small grants", amount: 8000, deadline: addDays(todayISO(), 9), url: "", sectors: ["Environment"], countries: ["Any"], maxStaff: 20, stage: "found", questions: "" },
  { id: "g3", funder: "Arts Bridge", name: "Community culture awards", amount: 12000, deadline: addDays(todayISO(), 45), url: "", sectors: ["Culture", "Youth"], countries: ["Tunisia"], maxStaff: 15, stage: "found", questions: "" },
];
const SAMPLE_ANSWERS: Answer[] = [
  { id: "a1", q: "Describe your organisation and mission", a: "Code Club Sfax is a volunteer-run nonprofit founded in 2019. We teach free coding and digital skills to young people aged 12 to 18 in underserved neighbourhoods of Sfax." },
  { id: "a2", q: "How do you measure impact", a: "We track attendance, course completion and a before-and-after skills test. In 2025, 214 students completed a course and average test scores rose by 38%." },
  { id: "a3", q: "Budget and use of funds", a: "Laptops and internet (45%), trainer stipends (35%), venue and transport (15%), evaluation (5%)." },
];
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-zÀ-ɏ]+/).filter(w => w.length > 3));
const sim = (a: string, b: string) => { const A = words(a), B = words(b); const i = [...A].filter(x => B.has(x) || [...B].some(y => y.slice(0, 5) === x.slice(0, 5))).length; return i / Math.max(1, Math.min(A.size, B.size)); };

export default function Fundfinch() {
  const [org, setOrg] = useStored<Org>(T, "org", { name: "Code Club Sfax", sector: ["Youth", "Digital", "Education"], country: "Tunisia", staff: 6, budget: 60000, currency: "USD" });
  const [grants, setGrants] = useStored<Grant[]>(T, "grants", SAMPLE_GRANTS);
  const [answers, setAnswers] = useStored<Answer[]>(T, "answers", SAMPLE_ANSWERS);
  const [open, setOpen] = useState<string | null>("g1");
  const [ng, setNg] = useState({ funder: "", name: "", amount: "", deadline: addDays(todayISO(), 30), url: "", sectors: "", countries: "Any", maxStaff: "100" });
  const money = moneyFmt(org.currency);

  const fit = (g: Grant) => {
    const s = g.sectors.filter(x => org.sector.includes(x)).length / Math.max(1, g.sectors.length);
    const c = g.countries.some(x => x === "Any" || x.toLowerCase() === org.country.toLowerCase()) ? 1 : 0;
    const z = org.staff <= g.maxStaff ? 1 : 0;
    const size = g.amount <= org.budget * 0.6 ? 1 : 0.5;
    return c && z ? Math.round((s * 0.6 + size * 0.4) * 100) : 0;
  };
  const days = (d: string) => Math.ceil((new Date(d).getTime() - new Date(todayISO()).getTime()) / 86400000);
  const active = grants.filter(g => g.stage !== "won" && g.stage !== "lost");
  const won = grants.filter(g => g.stage === "won");
  const g = grants.find(x => x.id === open);
  const draft = g ? g.questions.split("\n").filter(q => q.trim()).map(q => { const best = [...answers].map(a => ({ a, s: sim(q, a.q + " " + a.a) })).sort((x, y) => y.s - x.s)[0]; return { q, a: best && best.s > 0.2 ? best.a.a : "" }; }) : [];
  const setG = (id: string, p: Partial<Grant>) => setGrants(grants.map(x => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="stack">
      <Section title={org.name}>
        <Stats><Stat value={active.length} label="Grants in play" /><Stat value={active.filter(x => days(x.deadline) <= 14 && days(x.deadline) >= 0).length} label="Due in 2 weeks" tone="warn" /><Stat value={money(active.reduce((a, x) => a + x.amount, 0))} label="Applied or applying for" /><Stat value={money(won.reduce((a, x) => a + x.amount, 0))} label="Won" tone="good" /></Stats>
      </Section>

      <Section title="Grants, best fit first" aside={<button className="btn small" onClick={() => downloadIcs("grant-deadlines.ics", active.flatMap(x => [{ title: `Grant deadline: ${x.name}`, start: localDate(x.deadline), allDay: true, alarmMinutes: 0 }, { title: `One week left: ${x.name}`, start: localDate(addDays(x.deadline, -7)), allDay: true }]), "Grant deadlines")}>Deadlines to calendar</button>}>
        <div className="stack" style={{ gap: 10 }}>
          {[...grants].sort((a, b) => fit(b) - fit(a)).map(x => { const f = fit(x), dd = days(x.deadline); return (
            <div key={x.id} className="ff-g" onClick={() => setOpen(x.id)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && setOpen(x.id)} style={{ outline: open === x.id ? "2px solid var(--accent)" : undefined }}>
              <div className="ff-fit" style={{ background: f >= 70 ? "var(--good)" : f >= 40 ? "var(--warn)" : "var(--muted)" }}>{f}%</div>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{x.name}</strong> <span className="note">{x.funder}</span><p className="note">{x.sectors.join(", ")} · {x.countries.join(", ")}</p></div>
              <span>{money(x.amount)}</span>
              <span className={"pill " + (dd < 0 ? "" : dd <= 7 ? "bad" : dd <= 14 ? "warn" : "")}>{dd < 0 ? "Closed" : `${dd} days left`}</span>
              <select className="input" style={{ width: 130 }} aria-label="Stage" value={x.stage} onClick={e => e.stopPropagation()} onChange={e => setG(x.id, { stage: e.target.value as Grant["stage"] })}><option value="found">Found</option><option value="writing">Writing</option><option value="submitted">Submitted</option><option value="won">Won</option><option value="lost">Not funded</option></select>
            </div>); })}
        </div>
      </Section>

      {g && <Section title={`Draft: ${g.name}`} aside={<button className="btn small" disabled={!draft.length} onClick={() => download(`${g.name}.txt`, draft.map(x => `${x.q}\n\n${x.a || "[Write this answer]"}`).join("\n\n\n"), "text/plain")}>Download draft</button>}>
        <label className="field"><span>Paste the application questions, one per line</span><textarea className="input" rows={4} value={g.questions} onChange={e => setG(g.id, { questions: e.target.value })} /></label>
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          {draft.map((x, i) => (
            <div key={i} className="ff-q"><p><strong>{x.q}</strong></p>{x.a ? <p className="ff-a">{x.a}</p> : <p className="pill warn">No saved answer fits. Write one and add it to the answer bank.</p>}</div>
          ))}
        </div>
      </Section>}

      <div className="grid2">
        <Section title="Answer bank">
          <div className="stack" style={{ gap: 10 }}>
            {answers.map(a => (
              <div key={a.id} className="stack" style={{ gap: 4 }}>
                <input className="input" aria-label="Question" value={a.q} onChange={e => setAnswers(answers.map(x => x.id === a.id ? { ...x, q: e.target.value } : x))} style={{ fontWeight: 600 }} />
                <textarea className="input" rows={3} aria-label="Answer" value={a.a} onChange={e => setAnswers(answers.map(x => x.id === a.id ? { ...x, a: e.target.value } : x))} />
                <button className="btn ghost small danger" style={{ alignSelf: "flex-start" }} onClick={() => setAnswers(answers.filter(x => x.id !== a.id))}>Delete</button>
              </div>
            ))}
            <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setAnswers([...answers, { id: uid(), q: "New question", a: "" }])}>Add an answer</button>
          </div>
        </Section>
        <div className="stack">
          <Section title="Your organisation">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row"><label className="field"><span>Name</span><input id="ff-on" className="input" value={org.name} onChange={e => setOrg({ ...org, name: e.target.value })} /></label><label className="field"><span>Country</span><input id="ff-oc" className="input" value={org.country} onChange={e => setOrg({ ...org, country: e.target.value })} /></label></div>
              <div className="row"><label className="field"><span>Staff</span><input id="ff-os" className="input num" value={org.staff} onChange={e => setOrg({ ...org, staff: parseInt(e.target.value) || 0 })} /></label><label className="field"><span>Yearly budget</span><input id="ff-ob" className="input num" value={org.budget} onChange={e => setOrg({ ...org, budget: parseFloat(e.target.value) || 0 })} /></label><label className="field"><span>Currency</span><input id="ff-cur" className="input" value={org.currency} onChange={e => setOrg({ ...org, currency: e.target.value.toUpperCase().slice(0, 3) })} /></label></div>
              <div className="row" style={{ gap: 6 }}>{SECTORS.map(s => <label key={s} className="check note"><input type="checkbox" checked={org.sector.includes(s)} onChange={e => setOrg({ ...org, sector: e.target.checked ? [...org.sector, s] : org.sector.filter(x => x !== s) })} />{s}</label>)}</div>
            </div>
          </Section>
          <Section title="Add a grant you found">
            <form className="stack" style={{ gap: 8 }} onSubmit={e => { e.preventDefault(); if (!ng.name.trim()) return; setGrants([...grants, { id: uid(), funder: ng.funder, name: ng.name.trim(), amount: parseFloat(ng.amount) || 0, deadline: ng.deadline, url: ng.url, sectors: ng.sectors.split(",").map(s => s.trim()).filter(Boolean), countries: ng.countries.split(",").map(s => s.trim()).filter(Boolean), maxStaff: parseInt(ng.maxStaff) || 999, stage: "found", questions: "" }]); setNg({ ...ng, funder: "", name: "", amount: "", url: "" }); }}>
              <div className="row"><input className="input" style={{ flex: 1 }} aria-label="Funder" placeholder="Funder" value={ng.funder} onChange={e => setNg({ ...ng, funder: e.target.value })} /><input className="input" style={{ flex: 1 }} aria-label="Grant name" placeholder="Grant name" value={ng.name} onChange={e => setNg({ ...ng, name: e.target.value })} /></div>
              <div className="row"><input className="input num" style={{ flex: 1 }} aria-label="Amount" placeholder="Amount" value={ng.amount} onChange={e => setNg({ ...ng, amount: e.target.value })} /><input type="date" className="input" style={{ flex: 1 }} aria-label="Deadline" value={ng.deadline} onChange={e => setNg({ ...ng, deadline: e.target.value })} /><input className="input num" style={{ flex: 1 }} aria-label="Max staff" placeholder="Max staff" value={ng.maxStaff} onChange={e => setNg({ ...ng, maxStaff: e.target.value })} /></div>
              <input className="input" aria-label="Sectors" placeholder={`Sectors, e.g. ${SECTORS.slice(0, 3).join(", ")}`} value={ng.sectors} onChange={e => setNg({ ...ng, sectors: e.target.value })} />
              <div className="row"><input className="input" style={{ flex: 1 }} aria-label="Countries" placeholder="Countries, or Any" value={ng.countries} onChange={e => setNg({ ...ng, countries: e.target.value })} /><button className="btn small primary" type="submit">Add</button></div>
            </form>
          </Section>
        </div>
      </div>
      <style>{`.ff-g{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer;flex-wrap:wrap}.ff-fit{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:14px;flex:0 0 auto}
      .ff-q{padding-bottom:12px;border-bottom:1px solid var(--line)}.ff-a{margin-top:6px;padding:10px 12px;background:var(--sunk);border-radius:8px}`}</style>
    </div>
  );
}
