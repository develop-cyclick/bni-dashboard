"use client";

import { useState, useMemo, useEffect } from "react";

interface SlipRecord {
  r: string; f: string; t: string; s: string; a: number;
}


// Data loaded from API
const VIEWS=[{key:"121",label:"1-2-1",icon:"🤝",slip:"One to One"},{key:"referral",label:"Referral",icon:"🔗",slip:"Referral"},{key:"tyfcb",label:"TYFCB",icon:"💰",slip:"TYFCB"}];
const sn=(n:string):string=>{if(!n)return"";const p=n.split(" ");return p.length===1?p[0]:p[0].slice(0,8)+" "+p[p.length-1][0]+".";};
const fmt=(n:number):string=>n.toLocaleString("th-TH");
export default function BNIDashboard(){
  const[rawData,setRawData]=useState<SlipRecord[]>([]);
  const[periods,setPeriods]=useState<string[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[updatedAt,setUpdatedAt]=useState("");
  const[refreshing,setRefreshing]=useState(false);

  async function load(bust=false){
    if(bust)setRefreshing(true);else setLoading(true);
    try{
      const url=bust?`/api/slips?_t=${Date.now()}`:"/api/slips";
      const res=await fetch(url);
      if(!res.ok)throw new Error("Failed");
      const data=await res.json();
      setRawData(data.records);
      setPeriods(data.periods);
      setUpdatedAt(data.updatedAt);
      setError(null);
    }catch{
      setError("ไม่สามารถโหลดข้อมูลได้");
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(()=>{load();},[]);

  const[view,setView]=useState("121");
  const[fromPeriod,setFromPeriod]=useState("");
  const[toPeriod,setToPeriod]=useState("");
  const[sel,setSel]=useState<{f:string;t:string;v:number}|null>(null);
  const[hover,setHover]=useState<string|null>(null);
  const vc=VIEWS.find(v=>v.key===view)!;
  const isTy=view==="tyfcb";

  const fd=useMemo(()=>{
    let d=rawData;
    const fi=fromPeriod?periods.indexOf(fromPeriod):0;
    const ti=toPeriod?periods.indexOf(toPeriod):periods.length-1;
    if(fromPeriod||toPeriod)d=d.filter(r=>{const i=periods.indexOf(r.r);return i>=fi&&i<=ti;});
    return d.filter(r=>r.s===vc.slip);
  },[view,fromPeriod,toPeriod,rawData,periods,vc]);

  const members=useMemo(():string[]=>{
    const s=new Set<string>();
    fd.forEach(r=>{if(r.f&&r.f!=="BNI")s.add(r.f);if(r.t&&r.t!=="BNI")s.add(r.t);});
    return[...s].sort();
  },[fd]);

  const is121=view==="121";

  type Matrix=Record<string,Record<string,number>>;

  const{mat,mx,rt,ct}=useMemo(()=>{
    const m:Matrix={};members.forEach((a:string)=>{m[a]={};members.forEach((b:string)=>{m[a][b]=0;});});
    fd.forEach((r:SlipRecord)=>{
      if(r.f&&r.t&&r.f!=="BNI"&&r.t!=="BNI"&&m[r.f]?.[r.t]!==undefined){
        if(is121){
          const a=r.f<r.t?r.f:r.t;
          const b=r.f<r.t?r.t:r.f;
          m[a][b]+=1;
          m[b][a]+=1;
        } else {
          m[r.f][r.t]+=isTy?r.a:1;
        }
      }
    });
    if(is121){
      members.forEach((a:string)=>members.forEach((b:string)=>{
        if(a<b){const v=Math.max(m[a][b],m[b][a]);m[a][b]=v;m[b][a]=v;}
      }));
    }
    let mx=0;const rt:Record<string,number>={},ct:Record<string,number>={};
    members.forEach((a:string)=>{rt[a]=0;ct[a]=0;});
    members.forEach((a:string)=>members.forEach((b:string)=>{const v=m[a][b];if(v>mx)mx=v;rt[a]+=v;ct[b]+=v;}));
    return{mat:m,mx,rt,ct};
  },[members,fd,isTy,is121]);

  const summary=useMemo(()=>{
    const total=fd.reduce((s,r)=>s+(isTy?r.a:1),0);
    const givers=new Set(fd.map(r=>r.f)).size;
    const receivers=new Set(fd.filter(r=>r.t!=="BNI").map(r=>r.t)).size;
    const tg=Object.entries(rt).sort((a,b)=>b[1]-a[1])[0];
    const tr=Object.entries(ct).sort((a,b)=>b[1]-a[1])[0];
    return{total,givers,receivers,tg,tr};
  },[fd,isTy,rt,ct]);

  const stats121=useMemo(()=>{
    if(!is121)return null;
    const uniquePairs=members.reduce((sum,a)=>sum+members.filter(b=>b>a&&(mat[a]?.[b]||0)>0).length,0);
    const activeMembers=members.filter(m=>(rt[m]||0)>0);
    const coveragePct=members.length>0?Math.round((activeMembers.length/members.length)*100):0;
    const dist={"0":0,"1-2":0,"3-5":0,"6+":0};
    members.forEach(m=>{
      const pairs=members.filter(b=>(mat[m]?.[b]||0)>0).length;
      if(pairs===0)dist["0"]++;
      else if(pairs<=2)dist["1-2"]++;
      else if(pairs<=5)dist["3-5"]++;
      else dist["6+"]++;
    });
    return{uniquePairs,activeCount:activeMembers.length,total:members.length,coveragePct,dist};
  },[is121,members,mat,rt]);

  const CS=Math.min(22, Math.max(16, Math.floor(700/members.length)));

  const cellStyle=(from:string,to:string,v:number)=>{
    const i=mx>0?v/mx:0;
    let bg,clr;
    if(from===to){bg="#f8fafc";clr="#e2e8f0";}
    else if(v===0){bg="#fafbfc";clr="#e2e8f0";}
    else if(isTy){
      const alpha=0.12+i*0.55;
      bg="rgba(245,"+(158-Math.round(i*100))+","+(11+Math.round(i*20))+","+alpha+")";
      clr=i>0.4?"#92400e":"#b45309";
    } else {
      bg="rgba(99,102,241,"+(0.08+i*0.6)+")";
      clr=i>0.4?"#fff":i>0.15?"#3730a3":"#6366f1";
    }
    return{bg,clr};
  };

  const fmtCell=(v:number)=>{
    if(v===0)return "";
    if(isTy) return v>=1000?Math.round(v/1000)+"k":v;
    return v;
  };

  const fmtTotal=(v:number)=>{
    if(!v)return "";
    if(isTy) return v>0?Math.round(v/1000)+"k":"";
    return v||"";
  };

  const cssText = [
    "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');",
    "*{box-sizing:border-box;margin:0;padding:0;}",
    "::-webkit-scrollbar{width:5px;height:5px;}",
    "::-webkit-scrollbar-track{background:#eee;border-radius:3px;}",
    "::-webkit-scrollbar-thumb{background:#c7d2fe;border-radius:3px;}"
  ].join("");

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#f5f6fa",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans Thai',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",margin:"0 auto 12px"}}>A</div>
        <p style={{color:"#64748b",fontSize:14}}>กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );

  if(error) return(
    <div style={{minHeight:"100vh",background:"#f5f6fa",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Noto Sans Thai',sans-serif"}}>
      <div style={{textAlign:"center",padding:40,background:"#fff",borderRadius:16,border:"1px solid #fecaca"}}>
        <p style={{color:"#dc2626",fontSize:14,marginBottom:12}}>{error}</p>
        <button onClick={()=>window.location.reload()} style={{padding:"8px 20px",borderRadius:8,background:"#6366f1",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>ลองใหม่</button>
      </div>
    </div>
  );

  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",background:"#f5f6fa",color:"#1e293b",fontFamily:"'Noto Sans Thai',sans-serif"}}>
      <style>{cssText}</style>

      {/* ── Header ── */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8ecf2",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#a855f7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0}}>A</div>
        <div>
          <h1 style={{fontSize:15,fontWeight:700,color:"#1e293b",letterSpacing:"-.01em",lineHeight:1.2}}>BNI Active — Network Dashboard</h1>
          <p style={{fontSize:10,color:"#94a3b8"}}>Bangkok · สมาชิก {members.length} ท่าน</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {updatedAt&&<span style={{fontSize:10,color:"#94a3b8"}}>อัพเดต {updatedAt}</span>}
          <button onClick={()=>load(true)} disabled={refreshing}
            style={{padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:refreshing?"#f8fafc":"#fff",color:refreshing?"#94a3b8":"#64748b",cursor:refreshing?"not-allowed":"pointer",fontSize:11,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {refreshing?"⏳ กำลังรีเฟรช...":"🔄 รีเฟรช"}
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{background:"#fff",borderBottom:"1px solid #e8ecf2",padding:"7px 16px",display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
        {VIEWS.map(v=>(
          <button key={v.key} onClick={()=>{setView(v.key);setSel(null);}}
            style={{padding:"4px 12px",borderRadius:7,border:view===v.key?"1.5px solid #6366f1":"1px solid #e2e8f0",background:view===v.key?"#eef2ff":"transparent",color:view===v.key?"#4338ca":"#64748b",cursor:"pointer",fontSize:12,fontWeight:view===v.key?600:500,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit",transition:"all .15s"}}>
            <span style={{fontSize:13}}>{v.icon}</span>{v.label}
          </button>
        ))}
        <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 4px"}}/>
        <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>ช่วง</span>
        <select value={fromPeriod} onChange={e=>{setFromPeriod(e.target.value);setSel(null);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#334155",cursor:"pointer",fontSize:11,fontFamily:"inherit",outline:"none"}}>
          <option value="">เริ่มต้น</option>
          {periods.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{fontSize:11,color:"#94a3b8"}}>—</span>
        <select value={toPeriod} onChange={e=>{setToPeriod(e.target.value);setSel(null);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#334155",cursor:"pointer",fontSize:11,fontFamily:"inherit",outline:"none"}}>
          <option value="">สิ้นสุด</option>
          {periods.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {(fromPeriod||toPeriod)&&(
          <button onClick={()=>{setFromPeriod("");setToPeriod("");setSel(null);}}
            style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",color:"#94a3b8",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
            ✕
          </button>
        )}
      </div>

      {/* ── Scrollable Body ── */}
      <div style={{flex:1,minHeight:0,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>

        {/* Middle row: Stat Cards (left) + Heatmap (right) */}
        <div style={{display:"flex",gap:8,flex:1,minHeight:0}}>

          {/* Left: Stat Cards */}
          <div style={{width:160,flexShrink:0,display:"flex",flexDirection:"column",gap:6}}>
            {[
              {l:isTy?"ยอดรวม (฿)":"ทั้งหมด",v:isTy?("฿"+fmt(summary.total)):summary.total,cl:"#6366f1"},
              {l:"ผู้ให้",v:summary.givers,cl:"#0ea5e9"},
              {l:"ผู้รับ",v:summary.receivers,cl:"#8b5cf6"},
              {l:is121?"Active มาก":"Top Giver",v:summary.tg?sn(summary.tg[0]):"-",s:summary.tg?(isTy?("฿"+fmt(summary.tg[1])):(summary.tg[1]+(is121?" คู่":" ครั้ง"))):"",cl:"#f59e0b"},
              {l:is121?"Active รอง":"Top Receiver",v:summary.tr?sn(summary.tr[0]):"-",s:summary.tr?(isTy?("฿"+fmt(summary.tr[1])):(summary.tr[1]+(is121?" คู่":" ครั้ง"))):"",cl:"#10b981"},
            ].map((c,i)=>(
              <div key={i} style={{padding:"10px 12px",borderRadius:10,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:3,fontWeight:500}}>{c.l}</div>
                <div style={{fontSize:15,fontWeight:700,color:c.cl,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.v}</div>
                {c.s&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>{c.s}</div>}
              </div>
            ))}
          </div>

          {/* Right: Heatmap */}
          <div style={{flex:1,minWidth:0,borderRadius:12,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)",padding:"14px",display:"flex",flexDirection:"column",minHeight:300}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexShrink:0}}>
              <span style={{fontSize:14}}>{vc.icon}</span>
              <h2 style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{vc.label + " Heatmap"}</h2>
              <span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>{is121?"สมาชิก ↔ สมาชิก (2-way) · คลิกช่องเพื่อดูรายละเอียด":"แถวนอน (From) → แถวตั้ง (To) · คลิกช่องเพื่อดูรายละเอียด"}</span>
            </div>

            {/* Detail bar */}
            {sel&&(
              <div style={{marginBottom:8,padding:"6px 12px",borderRadius:7,background:"#eef2ff",border:"1px solid #c7d2fe",display:"flex",alignItems:"center",gap:10,fontSize:11,flexShrink:0}}>
                <span style={{fontWeight:600,color:"#4338ca"}}>{sel.f+(is121?" ↔ ":" → ")+sel.t}</span>
                <span style={{color:"#1e293b",fontWeight:600}}>{isTy?("฿"+fmt(sel.v)):(sel.v+(is121?" ครั้ง (รวม 2 ฝ่าย)":" ครั้ง"))}</span>
                <button onClick={()=>setSel(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:13}}>✕</button>
              </div>
            )}

            {members.length===0?(
              <div style={{textAlign:"center",padding:30,color:"#94a3b8",fontSize:13}}>ไม่มีข้อมูล</div>
            ):(
              <div style={{overflowX:"auto",overflowY:"auto",flex:1,minHeight:0}}>
            <div style={{display:"inline-block",minWidth:"fit-content"}}>
              {/* Col headers */}
              <div style={{display:"flex",gap:1}}>
                <div style={{width:100,flexShrink:0}}/>
                {members.map(m=>(
                  <div key={m} style={{width:CS,flexShrink:0,height:90,display:"flex",alignItems:"flex-end",justifyContent:"flex-start",position:"relative"}}
                    onMouseEnter={()=>setHover(m)} onMouseLeave={()=>setHover(null)}>
                    <div style={{position:"absolute",bottom:0,left:"50%",transform:"rotate(-65deg)",transformOrigin:"bottom left",fontSize:Math.min(9,CS-5),color:hover===m?"#4338ca":"#64748b",whiteSpace:"nowrap",fontWeight:hover===m?600:400}}>
                      {sn(m)}
                    </div>
                  </div>
                ))}
                <div style={{width:36,flexShrink:0,height:90,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:2}}>
                  <div style={{fontSize:9,color:"#6366f1",fontWeight:700}}>รวม</div>
                </div>
              </div>

              {/* Rows */}
              {members.map(from=>(
                <div key={from} style={{display:"flex",gap:1,marginBottom:1,alignItems:"center"}}
                  onMouseEnter={()=>setHover(from)} onMouseLeave={()=>setHover(null)}>
                  <div style={{width:100,flexShrink:0,fontSize:Math.min(9,CS-5),color:hover===from?"#4338ca":"#64748b",fontWeight:hover===from?600:400,textAlign:"right",paddingRight:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {sn(from)}
                  </div>
                  {members.map(to=>{
                    const v=mat[from]?.[to]||0;
                    const isHL=sel&&sel.f===from&&sel.t===to;
                    const st=cellStyle(from,to,v);
                    return(
                      <div key={to} onClick={()=>v>0&&setSel(isHL?null:{f:from,t:to,v})}
                        style={{width:CS,height:CS,display:"flex",alignItems:"center",justifyContent:"center",backgroundColor:st.bg,color:st.clr,fontSize:Math.min(9,CS-8),fontWeight:v>0?600:400,borderRadius:2,cursor:v>0?"pointer":"default",border:isHL?"2px solid #f59e0b":from===to?"1px solid #e8ecf2":"1px solid rgba(0,0,0,.03)",transition:"all .12s",transform:isHL?"scale(1.2)":"scale(1)",position:"relative",zIndex:isHL?10:1}}
                        title={v>0?(isTy?("฿"+fmt(v)):(v+" ครั้ง")):(sn(from)+" → "+sn(to))}>
                        {fmtCell(v)}
                      </div>
                    );
                  })}
                  <div style={{width:36,flexShrink:0,fontSize:9,fontWeight:600,color:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace"}}>
                    {fmtTotal(rt[from])}
                  </div>
                </div>
              ))}

              {/* Col totals */}
              <div style={{display:"flex",gap:1,marginTop:3,alignItems:"center"}}>
                <div style={{width:100,flexShrink:0,fontSize:9,color:"#6366f1",fontWeight:700,textAlign:"right",paddingRight:6}}>รวม</div>
                {members.map(m=>(
                  <div key={m} style={{width:CS,flexShrink:0,fontSize:Math.min(8,CS-8),fontWeight:600,color:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace"}}>
                    {fmtTotal(ct[m])}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

            {/* Legend */}
            <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span style={{fontSize:9,color:"#94a3b8"}}>ความเข้ม:</span>
              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#94a3b8"}}>น้อย</span>
                {[0.08,0.2,0.35,0.5,0.68].map((op,i)=>(
                  <div key={i} style={{width:12,height:8,borderRadius:2,backgroundColor:isTy?("rgba(245,158,11,"+op+")"):("rgba(99,102,241,"+op+")")}}/>
                ))}
                <span style={{fontSize:9,color:"#94a3b8"}}>มาก</span>
              </div>
            </div>
          </div>{/* end Heatmap */}
        </div>{/* end Middle Row */}

        {/* ── Bottom Section ── */}
      {is121&&stats121?(
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:8,flexShrink:0}}>
          {/* Coverage */}
          <div style={{padding:"12px 16px",borderRadius:10,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)",minWidth:160}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:500,marginBottom:6}}>Coverage — สมาชิกที่ทำ 1-2-1</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:700,color:"#6366f1",fontFamily:"'DM Mono',monospace"}}>{stats121.coveragePct}%</span>
              <span style={{fontSize:10,color:"#94a3b8"}}>{stats121.activeCount}/{stats121.total} คน</span>
            </div>
            <div style={{height:6,borderRadius:3,background:"#eef2ff",overflow:"hidden"}}>
              <div style={{height:"100%",width:stats121.coveragePct+"%",borderRadius:3,background:"linear-gradient(90deg,#6366f1,#a855f7)"}}/>
            </div>
          </div>

          {/* Distribution */}
          <div style={{padding:"12px 16px",borderRadius:10,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:500,marginBottom:6}}>การกระจายตัว — จำนวนคู่ 1-2-1 ต่อสมาชิก</div>
            <div style={{display:"flex",gap:6,height:60,alignItems:"flex-end"}}>
              {(Object.entries(stats121.dist) as [string,number][]).map(([label,count])=>{
                const maxCount=Math.max(...Object.values(stats121.dist),1);
                const pct=Math.round((count/stats121.total)*100);
                return(
                  <div key={label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span style={{fontSize:9,color:"#6366f1",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{count}</span>
                    <div style={{width:"100%",borderRadius:"3px 3px 0 0",background:"linear-gradient(180deg,#6366f1,#a5b4fc)",height:Math.max(4,(count/maxCount)*40)+"px"}}/>
                    <span style={{fontSize:9,color:"#94a3b8",textAlign:"center"}}>{label} คู่</span>
                    <span style={{fontSize:9,color:"#c7d2fe",fontWeight:500}}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unique Pairs */}
          <div style={{padding:"12px 16px",borderRadius:10,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)",minWidth:130,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:500,marginBottom:4,textAlign:"center"}}>คู่ 1-2-1 ทั้งหมด</div>
            <div style={{fontSize:32,fontWeight:700,color:"#8b5cf6",fontFamily:"'DM Mono',monospace"}}>{stats121.uniquePairs}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>unique pairs</div>
          </div>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,flexShrink:0}}>
          {[{title:"🌟 Top Gain",data:Object.entries(ct).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10),cl:"#10b981"},
            {title:"🏆 Top Give",data:Object.entries(rt).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,10),cl:"#6366f1"}
          ].map((sec,si)=>(
            <div key={si} style={{padding:12,borderRadius:10,background:"#fff",border:"1px solid #e8ecf2",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              <h3 style={{fontSize:12,fontWeight:600,color:"#1e293b",marginBottom:8}}>{sec.title}</h3>
              {sec.data.map(([name,val],i)=>{
                const maxB=sec.data[0][1];
                return(
                  <div key={name} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:10,color:i<3?"#f59e0b":"#94a3b8",fontWeight:600,width:14,textAlign:"right"}}>{i+1}</span>
                    <div style={{flex:1,position:"relative",height:20,borderRadius:4,overflow:"hidden",background:"#f8fafc"}}>
                      <div style={{position:"absolute",top:0,left:0,height:"100%",width:((val/maxB)*100)+"%",borderRadius:4,background:si===0?"linear-gradient(90deg,#ecfdf5,#a7f3d0)":"linear-gradient(90deg,#eef2ff,#c7d2fe)"}}/>
                      <span style={{position:"relative",zIndex:1,fontSize:10,color:"#334155",paddingLeft:6,lineHeight:"20px",fontWeight:500}}>{sn(name)}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:sec.cl,fontFamily:"'DM Mono',monospace",minWidth:40,textAlign:"right"}}>
                      {isTy?("฿"+fmt(val)):val}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      </div>{/* end Scrollable Body */}
    </div>
  );
}
