import React from "react";
export default function Dashboard({student}) {
  const topics=[["Fractions",82],["Linear Equations",43],["Geometry",67]];
  return <>
    <section className="hero"><span className="pill">Adaptive learning</span><h1>Good to see you, {student.name}.</h1><p className="muted">ASCORA uses your assessment and interaction history to decide how to teach you next.</p></section>
    <div className="grid grid-3" style={{marginTop:16}}>
      <div className="card"><div className="muted">Overall mastery</div><div className="stat">64%</div><span className="pill">↑ 8% this week</span></div>
      <div className="card"><div className="muted">Learning streak</div><div className="stat">7 days</div><span className="pill">Keep going</span></div>
      <div className="card"><div className="muted">Next intervention</div><div className="stat">Algebra</div><span className="pill">Visual + guided</span></div>
    </div>
    <div className="grid grid-2" style={{marginTop:16}}>
      <div className="card"><h2>Concept mastery</h2>{topics.map(([t,v])=><div key={t} style={{margin:"18px 0"}}><div className="kpi"><span>{t}</span><strong>{v}%</strong></div><div className="progress"><div style={{width:`${v}%`}}/></div></div>)}</div>
      <div className="card"><h2>Why ASCORA adapts</h2><div className="list">
        <div className="item">Linear equations: repeated inverse-operation errors.</div>
        <div className="item">Response time is higher on multi-step equations.</div>
        <div className="item">Visual examples have produced better recent accuracy.</div>
        <div className="item"><strong>Recommendation:</strong> slow pace + worked example + guided question.</div>
      </div></div>
    </div>
  </>;
}