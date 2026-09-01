import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth({onLogin}) {
  const [email,setEmail]=useState("student@example.com"),[password,setPassword]=useState("password"),[name,setName]=useState("Aarav"),[msg,setMsg]=useState("");
  async function submit(e) {
    e.preventDefault();
    if (!supabase) return onLogin({id:"demo-student",name,grade:"8",language:"English"});
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) return setMsg(error.message);
    onLogin({id:data.user.id,name,grade:"8",language:"English"});
  }
  return <div className="main" style={{margin:0,width:"100%",maxWidth:600,marginInline:"auto"}}>
    <div className="hero"><h1>Welcome to ASCORA</h1><p className="muted">Adaptive AI teaching powered by EduVerse.</p>
      <form className="form" onSubmit={submit}>
        <label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="btn">Continue</button>
        {msg && <p>{msg}</p>}
      </form>
    </div>
  </div>
}