import React, { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Classroom from "./pages/Classroom";
import Assessment from "./pages/Assessment";
import Notebook from "./pages/Notebook";
import Insights from "./pages/Insights";
import Ascora from "./pages/Ascora";
import Teacher from "./pages/Teacher";
import Auth from "./pages/Auth";

const nav = [
  ["dashboard","Dashboard"],["assessment","Assessment"],["classroom","AI Classroom"],
  ["notebook","Notebook"],["insights","My Learning"],["ascora","ASCORA"],["teacher","Teacher"]
];

export default function App() {
  const [page,setPage] = useState("dashboard");
  const [student,setStudent] = useState({id:"demo-student",name:"Aarav",grade:"8",language:"English"});
  if (page === "auth") return <Auth onLogin={(s)=>{setStudent(s);setPage("dashboard")}} />;

  const views = {
    dashboard:<Dashboard student={student} />,
    assessment:<Assessment student={student} />,
    classroom:<Classroom student={student} />,
    notebook:<Notebook student={student} />,
    insights:<Insights student={student} />,
    ascora:<Ascora student={student} />,
    teacher:<Teacher />
  };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo"/><div><strong>ASCORA</strong><div className="muted">EduVerse AI</div></div></div>
      <div className="nav">{nav.map(([id,label])=><button key={id} className={page===id?"active":""} onClick={()=>setPage(id)}>{label}</button>)}</div>
      <button className="btn secondary" style={{marginTop:20,width:"100%"}} onClick={()=>setPage("auth")}>Switch Student</button>
    </aside>
    <main className="main">
      <div className="topbar"><div><strong>{student.name}</strong><div className="muted">Grade {student.grade} · {student.language}</div></div><span className="pill">● Adaptive engine ready</span></div>
      {views[page]}
    </main>
  </div>;
}