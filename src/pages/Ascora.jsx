import React,{useEffect,useState} from "react";
import {api} from "../lib/api";

export default function Ascora({student}) {
 const [connected,setConnected]=useState(true),[data,setData]=useState(null),[state,setState]=useState("idle");
 useEffect(()=>{api(`/api/ascora/student/${student.id}/context`).then(setData).catch(()=>setData({topic:"Linear Equations",mastery:.43,strategy:{pace:"slow",visual:true,guided_questions:true}}))},[student.id]);
 async function event(type){setState(type);try{await api("/api/ascora/event",{method:"POST",body:JSON.stringify({student_id:student.id,event:type})})}catch{}}
 return <div className="grid grid-2"><div className="card" style={{textAlign:"center"}}><div className="avatar">{connected?"✦":"!"}</div><h1>ASCORA</h1><span className="pill">{connected?"● Connected":"○ Disconnected"}</span><p className="muted">Robot state: {state}</p><div className="row" style={{justifyContent:"center"}}><button className="btn" onClick={()=>event("listening")}>Listen</button><button className="btn secondary" onClick={()=>event("thinking")}>Think</button><button className="btn success" onClick={()=>event("explaining")}>Teach</button></div></div>
 <div className="card"><h2>Current student context</h2>{data?<div className="list"><div className="item"><strong>Topic:</strong> {data.topic}</div><div className="item"><strong>Mastery:</strong> {Math.round(data.mastery*100)}%</div><div className="item"><strong>Pace:</strong> {data.strategy?.pace}</div><div className="item"><strong>Visual support:</strong> {data.strategy?.visual?"High":"Standard"}</div><div className="item"><strong>Guided questions:</strong> {data.strategy?.guided_questions?"Enabled":"Off"}</div></div>:<p>Loading context...</p>}</div></div>
}