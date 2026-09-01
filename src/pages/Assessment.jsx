import React,{useState} from "react";
import {api} from "../lib/api";

const questions=[
 {id:"q1",topic:"Linear Equations",concept:"inverse_operations",difficulty:2,text:"Solve x + 5 = 12.",answer:"7"},
 {id:"q2",topic:"Fractions",concept:"equivalent_fractions",difficulty:1,text:"What fraction is equivalent to 1/2?",answer:"2/4"},
 {id:"q3",topic:"Geometry",concept:"triangle_angles",difficulty:2,text:"The angles of a triangle sum to how many degrees?",answer:"180"}
];

export default function Assessment({student}) {
 const [i,setI]=useState(0),[value,setValue]=useState(""),[result,setResult]=useState(null),[started,setStarted]=useState(Date.now()),[score,setScore]=useState(0);
 const q=questions[i];
 async function submit(){
   const correct=value.trim().toLowerCase()===q.answer.toLowerCase();
   if(correct)setScore(s=>s+1);
   try{await api("/api/assessment/attempt",{method:"POST",body:JSON.stringify({student_id:student.id,question_id:q.id,topic:q.topic,concept:q.concept,difficulty:q.difficulty,answer:value,correct,time_taken:Math.round((Date.now()-started)/1000),attempts:1,hints_used:0,answer_changed:false})});}catch{}
   setResult(correct?"Correct!":"Not quite — ASCORA will use this error as a learning signal.");
 }
 function next(){setResult(null);setValue("");setStarted(Date.now());setI(x=>x+1)}
 if(i>=questions.length)return <div className="hero"><span className="pill">Diagnostic complete</span><h1>{score}/{questions.length}</h1><p>Your performance has been recorded for adaptive analysis.</p><button className="btn" onClick={()=>{setI(0);setScore(0)}}>Retake</button></div>;
 return <div className="grid grid-2"><div className="card"><span className="pill">Question {i+1}/{questions.length}</span><h1>{q.text}</h1><label>Your answer<input value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></label><div className="row" style={{marginTop:14}}><button className="btn" onClick={submit}>Submit</button>{result&&<button className="btn secondary" onClick={next}>Next</button>}</div>{result&&<p style={{marginTop:16}}>{result}</p>}</div><div className="card"><h2>What we collect</h2><div className="list"><div className="item">Accuracy</div><div className="item">Response time</div><div className="item">Attempts and hints</div><div className="item">Concept + difficulty</div><div className="item">Error signals</div></div></div></div>
}