"use client";
import { useEffect, useState } from "react";
type Progress = {available:boolean;message:string;latest:string|null;metrics:{label:string;value:number}[]};
export function AnalystProgress({market}:{market:"memes"|"stocks"}) {
  const [data,setData]=useState<Progress|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    const load=async()=>{try{const r=await fetch("/api/analyst-progress",{cache:"no-store"});if(!r.ok)throw Error();const body=await r.json();if(active){setData(body[market]);setError(false);}}catch{if(active)setError(true);}};
    void load();const timer=setInterval(()=>void load(),60000);
    return()=>{active=false;clearInterval(timer);};
  },[market]);
  return <section className="outcome-tracker" aria-label={`${market} analyst progress`}>
    <p className="eyebrow">ANALYST PROGRESS · {market === "memes" ? "MEME COINS" : "STOCKS"}</p>
    <h2 style={{fontSize:"1.15rem",marginBottom:8}}>Collection → Evaluation → Validation</h2>
    <p role="status">{error?"Progress refresh failed; any displayed counts may be stale.":data?.message??"Checking recorded progress…"}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>{data?.metrics.map(m=><div key={m.label} style={{border:"1px solid var(--line)",borderRadius:8,padding:10}}><small style={{color:"var(--muted)",display:"block"}}>{m.label}</small><strong style={{fontSize:"1.3rem",color:"var(--acid)"}}>{m.value.toLocaleString()}</strong></div>)}</div>
    <p className="execution-rule">Latest stored observation: {data?.latest?new Date(data.latest).toLocaleString():"None verified"}. Progress refreshes every minute while open.</p>
    <p className="execution-rule">Validation: not established. These counts show collected evidence, not proof of accuracy or automatic model training.{market === "stocks" && " Price touches between scans are unknown."}</p>
  </section>;
}
