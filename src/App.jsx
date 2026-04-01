import { useState, useEffect, useCallback, useRef } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://zvwqqyrtubpahbdftryss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3FxeXJ0dWJwYWhiZGZ0cnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Mzk5OTQsImV4cCI6MjA5MDQxNTk5NH0.r7x95Vh9Y0i5HmyjF9xMrSrkPd4Dyz2gPSaea1lsOFw";
const RECORD_ID = "main";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function loadFromSupabase() {
  try {
    const rows = await sbFetch(`/projects?id=eq.${RECORD_ID}&select=data`);
    if (rows && rows.length > 0) return rows[0].data;
    return null;
  } catch (e) { console.error("Load:", e); return null; }
}
async function saveToSupabase(data) {
  try { await sbFetch(`/projects?id=eq.${RECORD_ID}`, { method: "DELETE" }); } catch {}
  await sbFetch(`/projects`, {
    method: "POST",
    body: JSON.stringify({ id: RECORD_ID, data, updated_at: new Date().toISOString() }),
  });
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "#78716c" },
  { value: "in_progress", label: "In Progress", color: "#2563eb" },
  { value: "with_tag",    label: "With TAG",    color: "#9333ea" },
  { value: "on_hold",     label: "On Hold",     color: "#d97706" },
  { value: "in_review",   label: "In Review",   color: "#0891b2" },
  { value: "complete",    label: "Complete",    color: "#16a34a" },
];
const PRIORITY_OPTIONS = [
  { value: "high",   label: "High", color: "#dc2626" },
  { value: "medium", label: "Med",  color: "#d97706" },
  { value: "low",    label: "Low",  color: "#16a34a" },
];
const DEFAULT_CATEGORIES = [
  "Budget","Communications","Conferences","DSP","Email Marketing",
  "Employers","Health Systems","Long Term Care","Retail",
];
const PROJECT_TEMPLATES = {
  "Price Increase Communication": {
    tasks: [
      { name: "Take out vax code and create folder", offsetDays: 0 },
      { name: "Draft pricing communication",         offsetDays: 1 },
      { name: "Confirm details with pricing team",   offsetDays: 1 },
      { name: "Request director approval",           offsetDays: 1 },
      { name: "Submit to MMRP",                      offsetDays: 2 },
      { name: "Add approvals and files to folder",   offsetDays: 5 },
      { name: "Share with Alyssa to send",           offsetDays: 6 },
    ],
  },
};
const TASK_TYPE_OPTIONS = [
  "Price Increase Communication","New Product Launch","Campaign Setup",
  "Contract Review","Budget Approval","Report Generation",
  "Stakeholder Update","Vendor Onboarding",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function addBusinessDays(dateStr, days) {
  if (days === 0) return dateStr;
  const d = new Date(dateStr + "T12:00:00");
  let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().split("T")[0];
}
function today()  { return new Date().toISOString().split("T")[0]; }
function uid()    { return Math.random().toString(36).slice(2, 10); }
function calcProgress(tasks) {
  if (!tasks?.length) return 0;
  return Math.round(tasks.filter(t => t.complete).length / tasks.length * 100);
}
function statusMeta(val)   { return STATUS_OPTIONS.find(s => s.value === val) || STATUS_OPTIONS[0]; }
function priorityMeta(val) { return PRIORITY_OPTIONS.find(p => p.value === val) || null; }
function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-"); return `${m}/${d}/${y}`;
}
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " at " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
}
function daysUntil(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso+"T12:00:00") - new Date(today()+"T12:00:00")) / 86400000);
}
function reorder(list, from, to) {
  const r = [...list]; const [m] = r.splice(from,1); r.splice(to,0,m); return r;
}
function defaultState() {
  const c = today();
  return {
    categories: DEFAULT_CATEGORIES,
    projects: [{
      id: uid(), name: "Price Increase Communication", descriptor: "Example Name",
      status: "in_progress", categories: ["Communications"],
      deadline: addBusinessDays(c,7), createdAt: c, progressOverride: null,
      archived: false, comments: [],
      tasks: PROJECT_TEMPLATES["Price Increase Communication"].tasks.map(t => ({
        id: uid(), name: t.name, complete: false, priority: "medium",
        deadline: addBusinessDays(c, t.offsetDays), notes: "", comments: [],
      })),
    }],
  };
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:       "#f5f4f0",
  surface:  "#ffffff",
  surface2: "#f0eeea",
  border:   "#e4e0d8",
  border2:  "#ede9e3",
  text:     "#1c1917",
  textSub:  "#78716c",
  textMuted:"#a8a29e",
  accent:   "#e85d26",
  accentBg: "#fdf2ed",
  blue:     "#2563eb", blueBg: "#eff6ff",
  green:    "#16a34a", greenBg:"#f0fdf4",
  red:      "#dc2626", redBg:  "#fef2f2",
  amber:    "#d97706", amberBg:"#fffbeb",
  purple:   "#9333ea", purpleBg:"#faf5ff",
  cyan:     "#0891b2", cyanBg: "#ecfeff",
};

const CAT_PALETTE = [
  ["#2563eb","#eff6ff"],["#9333ea","#faf5ff"],["#0891b2","#ecfeff"],
  ["#16a34a","#f0fdf4"],["#d97706","#fffbeb"],["#dc2626","#fef2f2"],
  ["#e85d26","#fdf2ed"],["#0d9488","#f0fdfa"],["#7c3aed","#f5f3ff"],
];
function catColor(cat, cats) {
  const idx = cats.indexOf(cat);
  return CAT_PALETTE[Math.max(0, idx) % CAT_PALETTE.length];
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  const color = pct===100?T.green:pct>60?T.blue:pct>30?T.amber:T.red;
  return (
    <div style={{background:T.surface2,borderRadius:99,height:5,overflow:"hidden",width:"100%"}}>
      <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:color,transition:"width .4s ease"}}/>
    </div>
  );
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  return {open,setOpen,ref};
}

function StatusBadge({value,onChange}) {
  const {open,setOpen,ref}=useDropdown();
  const meta=statusMeta(value);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{background:meta.color+"15",border:`1.5px solid ${meta.color}35`,color:meta.color,
          borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
          whiteSpace:"nowrap",fontFamily:"inherit"}}>
        {meta.label}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",minWidth:145,
          boxShadow:"0 8px 32px rgba(0,0,0,0.13)"}}>
          {STATUS_OPTIONS.map(s=>(
            <div key={s.value} onClick={e=>{e.stopPropagation();onChange(s.value);setOpen(false);}}
              style={{padding:"8px 14px",cursor:"pointer",fontSize:12,color:s.color,fontWeight:600,
                background:s.value===value?s.color+"12":"transparent",
                display:"flex",alignItems:"center",gap:8}}
              onMouseEnter={e=>e.currentTarget.style.background=s.color+"12"}
              onMouseLeave={e=>e.currentTarget.style.background=s.value===value?s.color+"12":"transparent"}>
              <span style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0}}/>
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityBadge({value,onChange}) {
  const {open,setOpen,ref}=useDropdown();
  const meta=priorityMeta(value);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{background:meta?meta.color+"15":T.surface2,border:`1.5px solid ${meta?meta.color+"35":T.border}`,
          color:meta?meta.color:T.textMuted,borderRadius:5,padding:"2px 7px",fontSize:10,
          fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
        {meta?meta.label:"P"}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",minWidth:110,
          boxShadow:"0 8px 32px rgba(0,0,0,0.13)"}}>
          {PRIORITY_OPTIONS.map(p=>(
            <div key={p.value} onClick={e=>{e.stopPropagation();onChange(p.value);setOpen(false);}}
              style={{padding:"7px 14px",cursor:"pointer",fontSize:12,color:p.color,fontWeight:600,
                background:p.value===value?p.color+"12":"transparent",
                display:"flex",alignItems:"center",gap:8}}
              onMouseEnter={e=>e.currentTarget.style.background=p.color+"12"}
              onMouseLeave={e=>e.currentTarget.style.background=p.value===value?p.color+"12":"transparent"}>
              <span style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}}/>
              {p.label}
            </div>
          ))}
          {value&&<div onClick={e=>{e.stopPropagation();onChange(null);setOpen(false);}}
            style={{padding:"6px 14px",cursor:"pointer",fontSize:11,color:T.textMuted,
              borderTop:`1px solid ${T.border}`}}
            onMouseEnter={e=>e.currentTarget.style.background=T.surface2}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>Clear</div>}
        </div>
      )}
    </div>
  );
}

function MultiCategorySelect({selected,options,onChange}) {
  const {open,setOpen,ref}=useDropdown();
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{background:T.surface2,border:`1px solid ${T.border}`,color:T.textSub,
          borderRadius:7,padding:"5px 11px",fontSize:11,cursor:"pointer",fontFamily:"inherit",
          maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {selected.length===0?"Select categories…":selected.join(", ")}
      </button>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",minWidth:200,
          boxShadow:"0 8px 32px rgba(0,0,0,0.13)",maxHeight:260,overflowY:"auto"}}>
          {options.map(o=>(
            <div key={o} onClick={e=>{e.stopPropagation();onChange(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o]);}}
              style={{padding:"7px 14px",cursor:"pointer",fontSize:12,
                display:"flex",alignItems:"center",gap:9,
                color:selected.includes(o)?T.text:T.textSub,
                background:selected.includes(o)?T.accentBg:"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.surface2}
              onMouseLeave={e=>e.currentTarget.style.background=selected.includes(o)?T.accentBg:"transparent"}>
              <span style={{width:14,height:14,borderRadius:4,
                border:`1.5px solid ${selected.includes(o)?T.accent:T.border}`,
                background:selected.includes(o)?T.accent:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {selected.includes(o)&&<span style={{color:"#fff",fontSize:9,lineHeight:1,fontWeight:900}}>✓</span>}
              </span>{o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({comments=[],onAdd,onDelete}) {
  const [text,setText]=useState("");
  function submit(){if(!text.trim())return;onAdd({id:uid(),text:text.trim(),createdAt:new Date().toISOString()});setText("");}
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,color:T.textSub,marginBottom:8,textTransform:"uppercase",letterSpacing:0.8}}>💬 Comments</div>
      {comments.map(c=>(
        <div key={c.id} style={{background:T.surface2,borderRadius:8,padding:"8px 11px",marginBottom:5,border:`1px solid ${T.border2}`}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
            <div style={{color:T.text,fontSize:12,lineHeight:1.5,flex:1}}>{c.text}</div>
            <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:14,padding:0,flexShrink:0}}>×</button>
          </div>
          <div style={{color:T.textMuted,fontSize:10,marginTop:3}}>{fmtDateTime(c.createdAt)}</div>
        </div>
      ))}
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment…"
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submit()}
          style={{flex:1,background:T.surface2,border:`1px solid ${T.border}`,color:T.text,
            borderRadius:7,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
        <button onClick={submit}
          style={{padding:"6px 12px",background:T.accent,border:"none",color:"#fff",
            borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>Post</button>
      </div>
    </div>
  );
}

function SyncDot({status}) {
  const map={synced:[T.green,"Synced"],syncing:[T.amber,"Saving…"],error:[T.red,"Error"]};
  const [color,label]=map[status]||map.synced;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color,fontWeight:600}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:color}}/>
      {label}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({activeTab,setActiveTab,categories,setCategories,addCategoryCount,syncStatus,onAddCategory}) {
  const dragCat=useRef(null); const dragOverCat=useRef(null); const [dragOverIdx,setDragOverIdx]=useState(null);
  const pinnedTabs=[{id:"overview",label:"Overview",icon:"⬡"},{id:"tasks",label:"All Tasks",icon:"☑"}];
  function handleDragEnd(){
    if(dragCat.current!==null&&dragOverCat.current!==null&&dragCat.current!==dragOverCat.current)
      setCategories(reorder(categories,dragCat.current,dragOverCat.current));
    dragCat.current=null;dragOverCat.current=null;setDragOverIdx(null);
  }
  return (
    <div style={{width:210,minWidth:210,background:T.surface,borderRight:`1px solid ${T.border}`,
      display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,flexShrink:0}}>
      <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,background:T.accent,borderRadius:8,display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:15,color:"#fff",fontWeight:900,
            boxShadow:`0 4px 12px ${T.accent}45`}}>W</div>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:T.text,letterSpacing:"-0.3px"}}>Work Tracker</div>
            <div style={{fontSize:9,color:T.textMuted,letterSpacing:1.2,textTransform:"uppercase",marginTop:1}}>Project Dashboard</div>
          </div>
        </div>
        <div style={{marginTop:10}}><SyncDot status={syncStatus}/></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
        <div style={{marginBottom:6}}>
          {pinnedTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={{width:"100%",textAlign:"left",padding:"8px 10px",
                background:activeTab===tab.id?T.accentBg:"transparent",
                border:"none",borderRadius:8,
                color:activeTab===tab.id?T.accent:T.textSub,
                fontWeight:activeTab===tab.id?700:500,fontSize:12.5,cursor:"pointer",
                fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,
                transition:"all .12s",marginBottom:2}}>
              <span style={{opacity:0.7}}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
        <div style={{padding:"6px 10px 5px",marginTop:4}}>
          <div style={{fontSize:9,color:T.textMuted,letterSpacing:1.4,textTransform:"uppercase",fontWeight:700}}>Categories</div>
        </div>
        {categories.map((cat,idx)=>{
          const count=addCategoryCount[cat]||0;
          const isOver=dragOverIdx===idx;
          const [cc]=catColor(cat,categories);
          const isActive=activeTab===cat;
          return (
            <div key={cat} draggable
              onDragStart={()=>{dragCat.current=idx;}}
              onDragEnter={()=>{dragOverCat.current=idx;setDragOverIdx(idx);}}
              onDragEnd={handleDragEnd} onDragOver={e=>e.preventDefault()}
              style={{marginBottom:2}}>
              <button onClick={()=>setActiveTab(cat)}
                style={{width:"100%",textAlign:"left",padding:"7px 10px",
                  background:isActive?cc+"18":isOver?T.surface2:"transparent",
                  border:isActive?`1.5px solid ${cc}28`:`1px solid ${isOver?T.border:"transparent"}`,
                  borderRadius:8,color:isActive?cc:T.textSub,fontWeight:isActive?700:500,
                  fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",
                  gap:7,transition:"all .12s"}}>
                {isActive&&<span style={{width:3,height:14,borderRadius:2,background:cc,flexShrink:0}}/>}
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
                {count>0&&<span style={{background:isActive?cc+"20":T.surface2,color:isActive?cc:T.textMuted,
                  borderRadius:99,fontSize:9,fontWeight:700,padding:"1px 6px",flexShrink:0}}>{count}</span>}
              </button>
            </div>
          );
        })}
        <button onClick={onAddCategory}
          style={{width:"100%",textAlign:"left",padding:"7px 10px",background:"transparent",
            border:`1.5px dashed ${T.border}`,borderRadius:8,color:T.textMuted,fontSize:11,
            cursor:"pointer",fontFamily:"inherit",marginTop:6,fontWeight:500}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
          onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          + Add category
        </button>
      </div>
    </div>
  );
}

// ─── DUE SOON BANNER ──────────────────────────────────────────────────────────
function DueSoonBanner({projects,onOpen}) {
  const urgent=projects.filter(p=>{
    if(p.archived||p.status==="complete")return false;
    const d=daysUntil(p.deadline);
    return d!==null&&d>=0&&d<=3;
  }).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  if(!urgent.length)return null;
  return (
    <div style={{background:T.amberBg,border:`1px solid ${T.amber}30`,borderRadius:10,padding:"11px 15px",marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,color:T.amber,marginBottom:8}}>⚡ Due in the next 3 days</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {urgent.map(p=>{
          const d=daysUntil(p.deadline);
          return (
            <button key={p.id} onClick={()=>onOpen(p.id)}
              style={{background:"#fff",border:`1px solid ${T.amber}40`,borderRadius:8,padding:"5px 12px",
                cursor:"pointer",fontFamily:"inherit",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <span style={{color:T.text,fontSize:12,fontWeight:600}}>{p.name}{p.descriptor?` — ${p.descriptor}`:""}</span>
              <span style={{color:T.amber,fontSize:11,marginLeft:8,fontWeight:700}}>{d===0?"Today":d===1?"Tomorrow":`${d}d`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
function GlobalSearch({projects,onOpen}) {
  const [q,setQ]=useState(""); const [focused,setFocused]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setFocused(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  const results=q.trim().length<2?[]:(() => {
    const ql=q.toLowerCase(); const out=[];
    projects.filter(p=>!p.archived).forEach(p=>{
      const pn=p.name+(p.descriptor?` ${p.descriptor}`:"");
      if(pn.toLowerCase().includes(ql))out.push({type:"project",project:p,label:p.name+(p.descriptor?` — ${p.descriptor}`:"")});
      (p.tasks||[]).forEach(t=>{if(t.name.toLowerCase().includes(ql))out.push({type:"task",project:p,task:t,label:t.name,sub:p.name+(p.descriptor?` — ${p.descriptor}`:"")});});
    });
    return out.slice(0,8);
  })();
  return (
    <div ref={ref} style={{position:"relative",flex:1,maxWidth:380}}>
      <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)}
        placeholder="🔍  Search projects & tasks…"
        style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,color:T.text,
          borderRadius:8,padding:"6px 13px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      {focused&&results.length>0&&(
        <div style={{position:"absolute",top:"110%",left:0,right:0,zIndex:700,background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.14)"}}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>{setQ("");setFocused(false);onOpen(r.project.id);}}
              style={{padding:"9px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border2}`,
                display:"flex",alignItems:"center",gap:10}}
              onMouseEnter={e=>e.currentTarget.style.background=T.surface2}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:11,color:r.type==="project"?T.blue:T.textMuted,flexShrink:0}}>{r.type==="project"?"📁":"✓"}</span>
              <div style={{minWidth:0}}>
                <div style={{color:T.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                {r.sub&&<div style={{color:T.textMuted,fontSize:10,marginTop:1}}>{r.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────────
function TaskRow({task,index,onUpdate,onDelete,onDragStart,onDragEnter,onDragEnd,isDragOver,showProject,projectName}) {
  const [editName,setEditName]=useState(false); const [nameVal,setNameVal]=useState(task.name);
  const [showComments,setShowComments]=useState(false);
  const pm=priorityMeta(task.priority);
  const overdue=task.deadline&&task.deadline<today()&&!task.complete;
  function addCmt(c){onUpdate({...task,comments:[...(task.comments||[]),c]});}
  function delCmt(id){onUpdate({...task,comments:(task.comments||[]).filter(c=>c.id!==id)});}
  return (
    <div draggable onDragStart={()=>onDragStart(index)} onDragEnter={()=>onDragEnter(index)}
      onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()}
      style={{borderRadius:8,border:`1px solid ${isDragOver?T.accent:overdue?T.red+"30":T.border2}`,
        background:isDragOver?T.accentBg:task.complete?T.greenBg:T.surface,
        opacity:isDragOver?0.7:1,transition:"all .12s"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
        <span style={{color:T.textMuted,fontSize:10,cursor:"grab",flexShrink:0}}>⠿</span>
        <input type="checkbox" checked={task.complete} onChange={e=>onUpdate({...task,complete:e.target.checked})}
          onClick={e=>e.stopPropagation()} style={{accentColor:T.accent,width:14,height:14,flexShrink:0,cursor:"pointer"}}/>
        {pm&&<div style={{width:3,height:22,borderRadius:2,background:pm.color,flexShrink:0}}/>}
        {editName
          ? <input value={nameVal} onChange={e=>setNameVal(e.target.value)}
              onBlur={()=>{onUpdate({...task,name:nameVal});setEditName(false);}}
              onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus onClick={e=>e.stopPropagation()}
              style={{flex:1,background:T.surface2,border:`1.5px solid ${T.accent}`,color:T.text,
                borderRadius:6,padding:"2px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          : <span onClick={e=>{e.stopPropagation();setEditName(true);}}
              style={{flex:1,color:task.complete?T.textMuted:overdue?T.red:T.text,
                textDecoration:task.complete?"line-through":"none",fontSize:12,cursor:"text",
                minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>
              {task.name}
            </span>
        }
        {showProject&&<span style={{fontSize:10,color:T.textMuted,whiteSpace:"nowrap",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",flexShrink:0}}>{projectName}</span>}
        <PriorityBadge value={task.priority} onChange={v=>onUpdate({...task,priority:v})}/>
        <button onClick={e=>{e.stopPropagation();setShowComments(s=>!s);}}
          style={{background:"none",border:"none",color:(task.comments||[]).length>0?T.textSub:T.textMuted,cursor:"pointer",fontSize:10,fontFamily:"inherit",whiteSpace:"nowrap",padding:"0 2px"}}>
          💬{(task.comments||[]).length>0?` ${(task.comments||[]).length}`:""}
        </button>
        <input type="date" value={task.deadline||""} onChange={e=>onUpdate({...task,deadline:e.target.value})}
          onClick={e=>e.stopPropagation()}
          style={{background:"transparent",border:"none",color:overdue?T.red:T.textMuted,fontSize:10,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}/>
        <button onClick={e=>{e.stopPropagation();onDelete();}}
          style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:15,lineHeight:1,padding:"0 1px",flexShrink:0}}>×</button>
      </div>
      {showComments&&(
        <div style={{padding:"0 12px 10px 38px"}}>
          <CommentSection comments={task.comments||[]} onAdd={addCmt} onDelete={delCmt}/>
        </div>
      )}
    </div>
  );
}

// ─── PROJECT DETAIL ───────────────────────────────────────────────────────────
function ProjectDetailView({project,categories,onUpdate,onBack}) {
  const [addingTask,setAddingTask]=useState(false); const [newTaskName,setNewTaskName]=useState("");
  const [editName,setEditName]=useState(false); const [nameVal,setNameVal]=useState(project.name);
  const [editDesc,setEditDesc]=useState(false); const [descVal,setDescVal]=useState(project.descriptor||"");
  const dragItem=useRef(null); const dragOver=useRef(null); const [dragOverIdx,setDragOverIdx]=useState(null);
  const progress=project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue=project.deadline&&project.deadline<today()&&project.status!=="complete";
  function updateTask(t){onUpdate({...project,tasks:project.tasks.map(x=>x.id===t.id?t:x)});}
  function deleteTask(id){onUpdate({...project,tasks:project.tasks.filter(t=>t.id!==id)});}
  function addTask(){
    if(!newTaskName.trim())return;
    onUpdate({...project,tasks:[...project.tasks,{id:uid(),name:newTaskName.trim(),complete:false,priority:"medium",deadline:today(),notes:"",comments:[]}]});
    setNewTaskName("");setAddingTask(false);
  }
  function handleDragEnd(){
    if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
      onUpdate({...project,tasks:reorder(project.tasks,dragItem.current,dragOver.current)});
    dragItem.current=null;dragOver.current=null;setDragOverIdx(null);
  }
  return (
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",
        fontFamily:"inherit",fontSize:12,padding:0,marginBottom:18,display:"flex",alignItems:"center",gap:5,fontWeight:500}}>
        ← Back
      </button>
      <div style={{background:T.surface,border:`1px solid ${isOverdue?T.red+"40":T.border}`,
        borderRadius:14,padding:"24px 28px",marginBottom:14,boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            {editName
              ? <input value={nameVal} onChange={e=>setNameVal(e.target.value)}
                  onBlur={()=>{onUpdate({...project,name:nameVal});setEditName(false);}}
                  onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus
                  style={{fontSize:20,fontWeight:800,background:T.surface2,border:`1.5px solid ${T.accent}`,
                    color:T.text,borderRadius:8,padding:"3px 10px",fontFamily:"inherit",width:"100%",outline:"none"}}/>
              : <h2 onClick={()=>setEditName(true)} style={{margin:0,fontSize:20,fontWeight:800,color:T.text,cursor:"text"}}>{project.name}</h2>
            }
            {editDesc
              ? <input value={descVal} onChange={e=>setDescVal(e.target.value)}
                  onBlur={()=>{onUpdate({...project,descriptor:descVal});setEditDesc(false);}}
                  onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus
                  style={{marginTop:4,fontSize:13,background:T.surface2,border:`1.5px solid ${T.accent}`,
                    color:T.textSub,borderRadius:7,padding:"2px 10px",fontFamily:"inherit",outline:"none"}}/>
              : <div onClick={()=>setEditDesc(true)} style={{color:T.textSub,fontSize:13,marginTop:4,cursor:"text"}}>
                  {project.descriptor||<span style={{color:T.textMuted}}>+ descriptor</span>}
                </div>
            }
          </div>
          <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <div>
            <div style={{color:T.textMuted,fontSize:10,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:700}}>Categories</div>
            <MultiCategorySelect selected={project.categories} options={categories} onChange={cats=>onUpdate({...project,categories:cats})}/>
          </div>
          <div>
            <div style={{color:T.textMuted,fontSize:10,marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:700}}>Deadline</div>
            <input type="date" value={project.deadline||""} onChange={e=>onUpdate({...project,deadline:e.target.value})}
              style={{background:T.surface2,border:`1px solid ${T.border}`,color:isOverdue?T.red:T.textSub,
                borderRadius:7,padding:"5px 10px",fontSize:12,fontFamily:"inherit"}}/>
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.textSub,marginBottom:6}}>
            <span>{project.tasks.filter(t=>t.complete).length} / {project.tasks.length} tasks done</span>
            <span style={{fontWeight:700,color:T.text}}>{progress}%</span>
          </div>
          <ProgressBar pct={progress}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,marginTop:8}}>
          <span style={{color:T.textMuted,fontSize:10,whiteSpace:"nowrap"}}>Override:</span>
          <input type="range" min={0} max={100} value={project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks)}
            onChange={e=>onUpdate({...project,progressOverride:Number(e.target.value)})}
            style={{accentColor:T.accent,flex:1}}/>
          <span style={{color:T.textSub,fontSize:10,minWidth:24}}>{progress}%</span>
          <button onClick={()=>onUpdate({...project,progressOverride:null})}
            style={{background:T.surface2,border:`1px solid ${T.border}`,color:T.textMuted,cursor:"pointer",
              fontSize:9,fontFamily:"inherit",borderRadius:4,padding:"2px 7px",fontWeight:600}}>Auto</button>
        </div>
        <div style={{marginTop:20,paddingTop:18,borderTop:`1px solid ${T.border}`}}>
          <CommentSection comments={project.comments||[]}
            onAdd={c=>onUpdate({...project,comments:[...(project.comments||[]),c]})}
            onDelete={id=>onUpdate({...project,comments:(project.comments||[]).filter(c=>c.id!==id)})}/>
        </div>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:0.8}}>Tasks</div>
          <div style={{fontSize:10,color:T.textMuted}}>Drag to reorder · click name to edit</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {!project.tasks.length&&<div style={{color:T.textMuted,fontSize:12,padding:"12px 0",textAlign:"center"}}>No tasks yet.</div>}
          {project.tasks.map((t,idx)=>(
            <TaskRow key={t.id} task={t} index={idx} onUpdate={updateTask} onDelete={()=>deleteTask(t.id)}
              onDragStart={i=>{dragItem.current=i;}} onDragEnter={i=>{dragOver.current=i;setDragOverIdx(i);}}
              onDragEnd={handleDragEnd} isDragOver={dragOverIdx===idx}/>
          ))}
        </div>
        {addingTask
          ? <div style={{display:"flex",gap:7,marginTop:10}}>
              <input value={newTaskName} onChange={e=>setNewTaskName(e.target.value)} placeholder="Task name…" autoFocus
                onKeyDown={e=>e.key==="Enter"&&addTask()}
                style={{flex:1,background:T.surface2,border:`1.5px solid ${T.accent}`,color:T.text,
                  borderRadius:7,padding:"7px 12px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <button onClick={addTask} style={{padding:"7px 14px",background:T.accent,border:"none",color:"#fff",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12}}>Add</button>
              <button onClick={()=>setAddingTask(false)} style={{padding:"7px 11px",background:T.surface2,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>✕</button>
            </div>
          : <button onClick={()=>setAddingTask(true)}
              style={{marginTop:10,background:T.surface2,border:`1.5px dashed ${T.border}`,color:T.textSub,
                borderRadius:7,padding:"8px 14px",cursor:"pointer",fontSize:11,fontFamily:"inherit",width:"100%",fontWeight:500}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>+ Add Task</button>
        }
      </div>
    </div>
  );
}

// ─── OVERVIEW CARD ────────────────────────────────────────────────────────────
function OverviewCard({project,onUpdate,onNavigate,onArchive,isDragOver,onDragStart,onDragEnter,onDragEnd,categories}) {
  const progress=project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue=project.deadline&&project.deadline<today()&&project.status!=="complete";
  const [showTasks,setShowTasks]=useState(false);
  return (
    <div draggable onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
      onDragOver={e=>e.preventDefault()} onClick={onNavigate}
      style={{background:T.surface,border:`1px solid ${isDragOver?T.accent:isOverdue?T.red+"30":T.border}`,
        borderRadius:12,padding:"16px 18px",cursor:"pointer",opacity:isDragOver?0.55:1,
        transition:"all .14s",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.10)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,0.05)"}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:T.text,fontWeight:700,fontSize:13,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {project.name}{project.descriptor?` — ${project.descriptor}`:""}
          </div>
          <div style={{marginTop:5,display:"flex",flexWrap:"wrap",gap:4}}>
            {project.categories.map(c=>{const[cc,cbg]=catColor(c,categories||[]);return(
              <span key={c} style={{background:cbg,color:cc,fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:700}}>{c}</span>
            );})}
          </div>
        </div>
        <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{flex:1}}><ProgressBar pct={progress}/></div>
        <span style={{color:T.textSub,fontSize:10,fontWeight:700}}>{progress}%</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:8}}>
        <button onClick={e=>{e.stopPropagation();setShowTasks(s=>!s);}}
          style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:0,fontWeight:500}}>
          {showTasks?"▲":"▼"} {project.tasks.filter(t=>t.complete).length}/{project.tasks.length} tasks{(project.comments||[]).length>0?` · 💬 ${(project.comments||[]).length}`:""}
        </button>
        <span style={{color:isOverdue?T.red:T.textMuted,fontWeight:isOverdue?700:400}}>{isOverdue?"⚠ ":""}{fmtDate(project.deadline)}</span>
      </div>
      {showTasks&&(
        <div onClick={e=>e.stopPropagation()} style={{borderTop:`1px solid ${T.border}`,paddingTop:8,display:"flex",flexDirection:"column",gap:4,marginBottom:7}}>
          {project.tasks.map(t=>{const pm=priorityMeta(t.priority);return(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:7,padding:"3px 5px",borderRadius:5,background:T.surface2}}>
              <input type="checkbox" checked={t.complete}
                onChange={e=>onUpdate({...project,tasks:project.tasks.map(x=>x.id===t.id?{...x,complete:e.target.checked}:x)})}
                style={{accentColor:T.accent,width:12,height:12,cursor:"pointer",flexShrink:0}}/>
              {pm&&<div style={{width:2,height:12,borderRadius:1,background:pm.color,flexShrink:0}}/>}
              <span style={{flex:1,fontSize:11,color:t.complete?T.textMuted:T.textSub,textDecoration:t.complete?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
              <span style={{fontSize:9,color:t.deadline&&t.deadline<today()&&!t.complete?T.red:T.textMuted,flexShrink:0}}>{fmtDate(t.deadline)}</span>
            </div>
          );})}
        </div>
      )}
      <div style={{display:"flex",gap:8,paddingTop:8,borderTop:`1px solid ${T.border2}`,alignItems:"center"}}>
        <span style={{color:T.accent,fontSize:10,fontWeight:700}}>Open →</span>
        <button onClick={e=>{e.stopPropagation();onArchive();}} style={{marginLeft:"auto",background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Archive</button>
      </div>
    </div>
  );
}

// ─── BOARD CARD ───────────────────────────────────────────────────────────────
function BoardCard({project,onUpdate,onDelete,onOpen,onArchive,isDragOver,onDragStart,onDragEnter,onDragEnd,categories}) {
  const progress=project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue=project.deadline&&project.deadline<today()&&project.status!=="complete";
  return (
    <div draggable onDragStart={e=>{e.stopPropagation();onDragStart();}} onDragEnter={e=>{e.stopPropagation();onDragEnter();}}
      onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()} onClick={onOpen}
      style={{background:T.surface,border:`1px solid ${isDragOver?T.accent:isOverdue?T.red+"30":T.border}`,
        borderRadius:11,padding:"14px 16px",cursor:"pointer",opacity:isDragOver?0.55:1,
        transition:"all .12s",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 18px rgba(0,0,0,0.09)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,0.05)"}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:T.text,fontWeight:700,fontSize:13,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {project.name}{project.descriptor?` — ${project.descriptor}`:""}
          </div>
          <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
            {project.categories.map(c=>{const[cc,cbg]=catColor(c,categories||[]);return(
              <span key={c} style={{background:cbg,color:cc,fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:700}}>{c}</span>
            );})}
          </div>
        </div>
        <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{flex:1}}><ProgressBar pct={progress}/></div>
        <span style={{color:T.textSub,fontSize:10,fontWeight:700}}>{progress}%</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
        <span style={{color:T.textSub}}>{project.tasks.filter(t=>t.complete).length}/{project.tasks.length} tasks{(project.comments||[]).length>0?` · 💬 ${(project.comments||[]).length}`:""}</span>
        <span style={{color:isOverdue?T.red:T.textMuted,fontWeight:isOverdue?700:400}}>{isOverdue?"⚠ ":""}{fmtDate(project.deadline)}</span>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:9,marginTop:8,borderTop:`1px solid ${T.border2}`,alignItems:"center"}}>
        <span style={{color:T.accent,fontSize:10,fontWeight:700}}>Open →</span>
        <button onClick={e=>{e.stopPropagation();onArchive();}} style={{marginLeft:"auto",background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Archive</button>
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Delete</button>
      </div>
    </div>
  );
}

// ─── ALL TASKS TAB ────────────────────────────────────────────────────────────
function AllTasksTab({projects,onUpdateProject,onOpenProject}) {
  const [filterStatus,setFilterStatus]=useState("all"); const [filterPriority,setFilterPriority]=useState("all");
  const [showComplete,setShowComplete]=useState(false);
  const allTasks=[];
  projects.filter(p=>!p.archived).forEach(p=>{(p.tasks||[]).forEach(t=>{allTasks.push({task:t,project:p});});});
  const active=allTasks.filter(({task,project})=>{
    if(task.complete||project.status==="complete")return false;
    if(filterStatus!=="all"&&project.status!==filterStatus)return false;
    if(filterPriority!=="all"&&task.priority!==filterPriority)return false;
    return true;
  }).sort((a,b)=>(a.task.deadline||"9999").localeCompare(b.task.deadline||"9999"));
  const completed=allTasks.filter(({task})=>task.complete).sort((a,b)=>(a.task.deadline||"9999").localeCompare(b.task.deadline||"9999"));
  function updateTask(project,updTask){onUpdateProject({...project,tasks:project.tasks.map(t=>t.id===updTask.id?updTask:t)});}
  const selStyle={background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"6px 12px",fontSize:11,fontFamily:"inherit",outline:"none"};
  return (
    <div>
      <div style={{display:"flex",gap:9,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
          <option value="all">All Project Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={selStyle}>
          <option value="all">All Priorities</option>
          {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span style={{color:T.textMuted,fontSize:11,marginLeft:"auto"}}>{active.length} task{active.length!==1?"s":""} remaining</span>
      </div>
      {active.length===0
        ? <div style={{textAlign:"center",padding:"48px 20px",color:T.textMuted,fontSize:13}}>No pending tasks — you're all caught up! 🎉</div>
        : <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {active.map(({task,project})=>{
              const pm=priorityMeta(task.priority); const overdue=task.deadline&&task.deadline<today()&&!task.complete;
              const d=daysUntil(task.deadline); const soon=d!==null&&d>=0&&d<=3;
              return (
                <div key={task.id} style={{background:T.surface,border:`1px solid ${overdue?T.red+"30":soon?T.amber+"30":T.border}`,
                  borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                  <input type="checkbox" checked={task.complete} onChange={e=>updateTask(project,{...task,complete:e.target.checked})}
                    style={{accentColor:T.accent,width:14,height:14,cursor:"pointer",flexShrink:0}}/>
                  {pm&&<div style={{width:3,height:28,borderRadius:2,background:pm.color,flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:T.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                    <button onClick={()=>onOpenProject(project.id)} style={{background:"none",border:"none",color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0,marginTop:1,fontWeight:600}}>
                      {project.name}{project.descriptor?` — ${project.descriptor}`:""} →
                    </button>
                  </div>
                  {pm&&<span style={{background:pm.color+"15",border:`1.5px solid ${pm.color}30`,color:pm.color,borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:700,flexShrink:0}}>{pm.label}</span>}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {(overdue||soon)&&<div style={{fontSize:10,color:overdue?T.red:T.amber,fontWeight:700}}>{overdue?"⚠ Overdue":d===0?"Today":d===1?"Tomorrow":`${d}d`}</div>}
                    <div style={{fontSize:10,color:T.textMuted}}>{fmtDate(task.deadline)}</div>
                  </div>
                </div>
              );
            })}
          </div>
      }
      {completed.length>0&&(
        <div style={{marginTop:28}}>
          <button onClick={()=>setShowComplete(s=>!s)} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontFamily:"inherit",fontSize:11,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:10,fontWeight:500}}>
            {showComplete?"▼":"▶"} Completed tasks ({completed.length})
          </button>
          {showComplete&&(
            <div style={{display:"flex",flexDirection:"column",gap:4,opacity:0.6}}>
              {completed.map(({task,project})=>(
                <div key={task.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 16px",display:"flex",alignItems:"center",gap:10}}>
                  <input type="checkbox" checked={true} onChange={()=>updateTask(project,{...task,complete:false})} style={{accentColor:T.accent,width:14,height:14,cursor:"pointer",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:T.textMuted,fontSize:12,textDecoration:"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                    <div style={{color:T.textMuted,fontSize:10,marginTop:1}}>{project.name}{project.descriptor?` — ${project.descriptor}`:""}</div>
                  </div>
                  <div style={{color:T.textMuted,fontSize:10}}>{fmtDate(task.deadline)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function AddProjectModal({categories,defaultCategory,onAdd,onClose}) {
  const [name,setName]=useState(""); const [descriptor,setDescriptor]=useState("");
  const [templateType,setTemplateType]=useState(""); const [cats,setCats]=useState(defaultCategory?[defaultCategory]:[]);
  const [deadline,setDeadline]=useState(addBusinessDays(today(),5));
  const [mode,setMode]=useState("select"); const [customType,setCustomType]=useState("");
  const template=PROJECT_TEMPLATES[mode==="custom"?customType:templateType];
  const inputStyle={display:"block",marginTop:5,width:"100%",background:T.surface2,border:`1px solid ${T.border}`,
    color:T.text,borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
  function handleAdd(){
    if(!name.trim())return;
    const c=today();
    const tasks=template?template.tasks.map(t=>({id:uid(),name:t.name,complete:false,priority:"medium",deadline:addBusinessDays(c,t.offsetDays),notes:"",comments:[]})):[];
    onAdd({id:uid(),name:name.trim(),descriptor:descriptor.trim(),status:"not_started",categories:cats,deadline,createdAt:c,progressOverride:null,archived:false,comments:[],tasks});
    onClose();
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:28,width:490,maxWidth:"95vw",boxShadow:"0 24px 80px rgba(0,0,0,0.16)",maxHeight:"90vh",overflowY:"auto"}}>
        <h2 style={{margin:"0 0 20px",color:T.text,fontSize:17,fontWeight:800}}>Add New Project</h2>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <label style={{color:T.textSub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Project Type
            <div style={{display:"flex",gap:6,marginTop:5}}>
              {["select","custom"].map(m=><button key={m} onClick={()=>setMode(m)}
                style={{padding:"4px 12px",borderRadius:6,border:"1.5px solid",
                  borderColor:mode===m?T.accent:T.border,background:mode===m?T.accentBg:"transparent",
                  color:mode===m?T.accent:T.textSub,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:mode===m?700:500}}>
                {m==="select"?"From Template":"Custom"}
              </button>)}
            </div>
            {mode==="select"
              ? <select value={templateType} onChange={e=>setTemplateType(e.target.value)} style={{...inputStyle,marginTop:5}}>
                  <option value="">— No template —</option>
                  {TASK_TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              : <input value={customType} onChange={e=>setCustomType(e.target.value)} placeholder="Custom type…" style={inputStyle}/>
            }
          </label>
          <label style={{color:T.textSub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Project Name *
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Price Increase Communication" style={inputStyle}/>
          </label>
          <label style={{color:T.textSub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Descriptor <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span>
            <input value={descriptor} onChange={e=>setDescriptor(e.target.value)} placeholder="e.g. Example Name" style={inputStyle}/>
          </label>
          <label style={{color:T.textSub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Categories
            <div style={{marginTop:5}}><MultiCategorySelect selected={cats} options={categories} onChange={setCats}/></div>
          </label>
          <label style={{color:T.textSub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Deadline
            <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={inputStyle}/>
          </label>
          {template&&(
            <div style={{background:T.accentBg,border:`1px solid ${T.accent}30`,borderRadius:8,padding:"10px 14px"}}>
              <div style={{color:T.accent,fontSize:10,fontWeight:700,marginBottom:6}}>AUTO-POPULATED TASKS ({template.tasks.length})</div>
              {template.tasks.map((t,i)=><div key={i} style={{color:T.textSub,fontSize:11,padding:"1px 0"}}>· {t.name} <span style={{color:T.textMuted}}>(+{t.offsetDays}d)</span></div>)}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:9,marginTop:24,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancel</button>
          <button onClick={handleAdd} style={{padding:"8px 18px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12,boxShadow:`0 4px 14px ${T.accent}40`}}>Add Project</button>
        </div>
      </div>
    </div>
  );
}

function AddCategoryModal({onAdd,onClose}) {
  const [name,setName]=useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:28,width:340,boxShadow:"0 24px 80px rgba(0,0,0,0.16)"}}>
        <h2 style={{margin:"0 0 18px",color:T.text,fontSize:16,fontWeight:800}}>Add New Category</h2>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Category name…" autoFocus
          onKeyDown={e=>e.key==="Enter"&&name.trim()&&(onAdd(name.trim()),onClose())}
          style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,color:T.text,borderRadius:8,padding:"9px 13px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
        <div style={{display:"flex",gap:9,marginTop:18,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancel</button>
          <button onClick={()=>{if(name.trim()){onAdd(name.trim());onClose();}}} style={{padding:"7px 18px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12,boxShadow:`0 4px 14px ${T.accent}40`}}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,setData]=useState(null); const [activeTab,setActiveTab]=useState("overview");
  const [openProjectId,setOpenProjectId]=useState(null); const [showAddProject,setShowAddProject]=useState(false);
  const [showAddCategory,setShowAddCategory]=useState(false); const [filterStatus,setFilterStatus]=useState("all");
  const [filterCat,setFilterCat]=useState("all"); const [catStatusFilter,setCatStatusFilter]=useState("all");
  const [catPriorityFilter,setCatPriorityFilter]=useState("all"); const [catTaskFilter,setCatTaskFilter]=useState("all");
  const [syncStatus,setSyncStatus]=useState("syncing"); const [loaded,setLoaded]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  const saveTimer=useRef(null); const dragItem=useRef(null); const dragOver=useRef(null); const [dragOverIdx,setDragOverIdx]=useState(null);

  useEffect(()=>{
    loadFromSupabase().then(d=>{setData(d||defaultState());setLoaded(true);setSyncStatus("synced");})
      .catch(()=>{setData(defaultState());setLoaded(true);setSyncStatus("error");});
  },[]);
  useEffect(()=>{
    if(!loaded||!data)return;
    setSyncStatus("syncing"); clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{try{await saveToSupabase(data);setSyncStatus("synced");}catch{setSyncStatus("error");}},800);
    return()=>clearTimeout(saveTimer.current);
  },[data,loaded]);
  useEffect(()=>{
    const h=e=>{if(e.key==="n"&&!e.metaKey&&!e.ctrlKey&&e.target.tagName!=="INPUT"&&e.target.tagName!=="TEXTAREA")setShowAddProject(true);};
    document.addEventListener("keydown",h); return()=>document.removeEventListener("keydown",h);
  },[]);

  const updateProject=useCallback(proj=>setData(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?proj:p)})),[]);
  const deleteProject=useCallback(id=>{if(!confirm("Delete this project?"))return;setData(d=>({...d,projects:d.projects.filter(p=>p.id!==id)}));setOpenProjectId(null);},[]);
  const addProject=useCallback(proj=>setData(d=>({...d,projects:[...d.projects,proj]})),[]);
  const archiveProject=useCallback((id,val)=>setData(d=>({...d,projects:d.projects.map(p=>p.id===id?{...p,archived:val}:p)})),[]);
  const setCategories=useCallback(cats=>setData(d=>({...d,categories:cats})),[]);
  const addCategory=useCallback(name=>setData(d=>({...d,categories:[...d.categories,name]})),[]);

  if(!data) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:32,height:32,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:T.textMuted,fontSize:12}}>Connecting to cloud…</div>
    </div>
  );

  const {categories,projects}=data;
  const openProject=openProjectId?projects.find(p=>p.id===openProjectId):null;
  const activeProjects=projects.filter(p=>!p.archived);
  const archivedProjects=projects.filter(p=>p.archived);
  const catCounts={};
  categories.forEach(c=>{catCounts[c]=activeProjects.filter(p=>p.categories.includes(c)&&p.status!=="complete").length;});
  const overviewActive=activeProjects.filter(p=>{
    if(p.status==="complete")return false;
    if(filterStatus!=="all"&&p.status!==filterStatus)return false;
    if(filterCat!=="all"&&!p.categories.includes(filterCat))return false;
    return true;
  });
  const overviewComplete=activeProjects.filter(p=>p.status==="complete"&&(filterCat==="all"||p.categories.includes(filterCat)));
  const stats=[
    {label:"Active",     value:activeProjects.filter(p=>p.status!=="complete").length,                                    color:T.blue,  bg:T.blueBg,  icon:"◈"},
    {label:"In Progress",value:activeProjects.filter(p=>p.status==="in_progress").length,                                 color:T.cyan,  bg:T.cyanBg,  icon:"◎"},
    {label:"Complete",   value:activeProjects.filter(p=>p.status==="complete").length,                                    color:T.green, bg:T.greenBg, icon:"✓"},
    {label:"Overdue",    value:activeProjects.filter(p=>p.deadline&&p.deadline<today()&&p.status!=="complete").length,    color:T.red,   bg:T.redBg,   icon:"⚠"},
  ];
  const catActive=activeProjects.filter(p=>p.categories.includes(activeTab)&&p.status!=="complete");
  const catComplete=activeProjects.filter(p=>p.categories.includes(activeTab)&&p.status==="complete");
  const catFiltered=catActive.filter(p=>{
    if(catStatusFilter!=="all"&&p.status!==catStatusFilter)return false;
    return true;
  }).map(p=>({...p,tasks:(p.tasks||[]).filter(t=>{
    if(catPriorityFilter!=="all"&&t.priority!==catPriorityFilter)return false;
    if(catTaskFilter==="pending"&&t.complete)return false;
    if(catTaskFilter==="complete"&&!t.complete)return false;
    return true;
  })}));
  function handleBoardDragEnd(newList){
    setData(d=>{const others=d.projects.filter(p=>!p.categories.includes(activeTab)||p.archived||p.status==="complete");return{...d,projects:[...others,...newList]};});
    setDragOverIdx(null);dragItem.current=null;dragOver.current=null;
  }
  const defaultCat=activeTab!=="overview"&&activeTab!=="tasks"?activeTab:null;
  const selStyle={background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"6px 12px",fontSize:11,fontFamily:"inherit",outline:"none"};

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Plus Jakarta Sans','DM Sans','Segoe UI',sans-serif",color:T.text,display:"flex"}}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
        select option{background:#fff;color:#1c1917}
      `}</style>

      <Sidebar activeTab={activeTab}
        setActiveTab={tab=>{setActiveTab(tab);setOpenProjectId(null);setCatStatusFilter("all");setCatPriorityFilter("all");setCatTaskFilter("all");}}
        categories={categories} setCategories={setCategories} addCategoryCount={catCounts}
        syncStatus={syncStatus} onAddCategory={()=>setShowAddCategory(true)}/>

      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
        {/* TOP BAR */}
        <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"10px 24px",
          display:"flex",alignItems:"center",gap:12,flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{fontWeight:700,fontSize:13,color:T.textSub}}>
            {openProject?<><span style={{color:T.textMuted}}>←</span> {activeTab==="overview"?"Overview":activeTab}</>
              :activeTab==="overview"?"Overview":activeTab==="tasks"?"All Tasks":activeTab}
          </div>
          <div style={{flex:1}}/>
          <GlobalSearch projects={projects} onOpen={id=>{setOpenProjectId(id);}}/>
          <button onClick={()=>setShowAddProject(true)} title="New project (N)"
            style={{padding:"7px 16px",background:T.accent,border:"none",color:"#fff",borderRadius:8,
              fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,
              boxShadow:`0 4px 14px ${T.accent}40`,transition:"all .12s"}}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
            + New <span style={{opacity:0.6,fontSize:9}}>[N]</span>
          </button>
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"24px 26px"}}>
          {openProject&&(
            <ProjectDetailView project={openProject} categories={categories} onUpdate={updateProject} onBack={()=>setOpenProjectId(null)}/>
          )}

          {!openProject&&activeTab==="overview"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                {stats.map(s=>(
                  <div key={s.label} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,
                    padding:"14px 16px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 6px rgba(0,0,0,0.04)"}}>
                    <div style={{width:36,height:36,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:s.color,flexShrink:0}}>{s.icon}</div>
                    <div>
                      <div style={{fontSize:22,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
                      <div style={{fontSize:10,color:T.textMuted,marginTop:2,fontWeight:600}}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <DueSoonBanner projects={activeProjects} onOpen={id=>{setOpenProjectId(id);}}/>
              <div style={{display:"flex",gap:9,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.filter(s=>s.value!=="complete").map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={selStyle}>
                  <option value="all">All Categories</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {overviewActive.length===0
                ? <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted,fontSize:13}}>No active projects match your filters.</div>
                : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
                    {overviewActive.map((p,idx)=>(
                      <OverviewCard key={p.id} project={p} categories={categories} onUpdate={updateProject}
                        onNavigate={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={dragOverIdx===idx}
                        onDragStart={()=>{dragItem.current=idx;}}
                        onDragEnter={()=>{dragOver.current=idx;setDragOverIdx(idx);}}
                        onDragEnd={()=>{
                          if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
                            setData(d=>({...d,projects:reorder(d.projects,dragItem.current,dragOver.current)}));
                          setDragOverIdx(null);dragItem.current=null;dragOver.current=null;
                        }}/>
                    ))}
                  </div>
              }
              {overviewComplete.length>0&&(
                <div style={{marginTop:32}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{flex:1,height:1,background:T.border}}/>
                    <span style={{color:T.textMuted,fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.8}}>✓ COMPLETED ({overviewComplete.length})</span>
                    <div style={{flex:1,height:1,background:T.border}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12,opacity:0.6}}>
                    {overviewComplete.map(p=>(
                      <OverviewCard key={p.id} project={p} categories={categories} onUpdate={updateProject}
                        onNavigate={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
                    ))}
                  </div>
                </div>
              )}
              {archivedProjects.length>0&&(
                <div style={{marginTop:24}}>
                  <button onClick={()=>setShowArchived(s=>!s)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontFamily:"inherit",fontSize:11,display:"flex",alignItems:"center",gap:5,padding:0}}>
                    {showArchived?"▼":"▶"} Archived ({archivedProjects.length})
                  </button>
                  {showArchived&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12,marginTop:10,opacity:0.45}}>
                      {archivedProjects.map(p=>(
                        <OverviewCard key={p.id} project={p} categories={categories} onUpdate={updateProject}
                          onNavigate={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,false)}
                          isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!openProject&&activeTab==="tasks"&&(
            <AllTasksTab projects={activeProjects} onUpdateProject={updateProject} onOpenProject={id=>setOpenProjectId(id)}/>
          )}

          {!openProject&&activeTab!=="overview"&&activeTab!=="tasks"&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:9}}>
                <div>
                  <h1 style={{margin:0,fontSize:20,fontWeight:800,color:T.text}}>{activeTab}</h1>
                  <div style={{color:T.textMuted,fontSize:11,marginTop:3}}>{catActive.length} active project{catActive.length!==1?"s":""}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",background:T.surface,
                border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",alignItems:"center",
                boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <span style={{color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:0.8}}>FILTER</span>
                <select value={catStatusFilter} onChange={e=>setCatStatusFilter(e.target.value)} style={selStyle}>
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.filter(s=>s.value!=="complete").map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={catPriorityFilter} onChange={e=>setCatPriorityFilter(e.target.value)} style={selStyle}>
                  <option value="all">All Priorities</option>
                  {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select value={catTaskFilter} onChange={e=>setCatTaskFilter(e.target.value)} style={selStyle}>
                  <option value="all">All Tasks</option>
                  <option value="pending">Pending Only</option>
                  <option value="complete">Completed Only</option>
                </select>
                {(catStatusFilter!=="all"||catPriorityFilter!=="all"||catTaskFilter!=="all")&&
                  <button onClick={()=>{setCatStatusFilter("all");setCatPriorityFilter("all");setCatTaskFilter("all");}}
                    style={{background:"none",border:"none",color:T.red,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✕ Clear</button>
                }
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {catFiltered.length===0
                  ? <div style={{textAlign:"center",padding:"40px 20px",color:T.textMuted,fontSize:13}}>No projects match your filters.</div>
                  : catFiltered.map((p,idx)=>(
                      <BoardCard key={p.id} project={p} categories={categories}
                        onUpdate={proj=>{
                          const realProject=projects.find(x=>x.id===proj.id);
                          const realTasks=realProject?realProject.tasks.map(rt=>{const updated=proj.tasks.find(ut=>ut.id===rt.id);return updated||rt;}):proj.tasks;
                          updateProject({...proj,tasks:realTasks});
                        }}
                        onDelete={()=>deleteProject(p.id)} onOpen={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={dragOverIdx===idx}
                        onDragStart={()=>{dragItem.current=idx;}}
                        onDragEnter={()=>{dragOver.current=idx;setDragOverIdx(idx);}}
                        onDragEnd={()=>{
                          if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
                            handleBoardDragEnd(reorder(catActive,dragItem.current,dragOver.current));
                          else{setDragOverIdx(null);dragItem.current=null;dragOver.current=null;}
                        }}/>
                    ))
                }
              </div>
              {catComplete.length>0&&(
                <div style={{marginTop:26}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:1,height:1,background:T.border}}/>
                    <span style={{color:T.textMuted,fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.8}}>✓ COMPLETED ({catComplete.length})</span>
                    <div style={{flex:1,height:1,background:T.border}}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,opacity:0.55}}>
                    {catComplete.map(p=>(
                      <BoardCard key={p.id} project={p} categories={categories} onUpdate={updateProject}
                        onDelete={()=>deleteProject(p.id)} onOpen={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddProject&&(
        <AddProjectModal categories={categories} defaultCategory={defaultCat}
          onAdd={proj=>{if(defaultCat&&!proj.categories.includes(defaultCat))proj.categories=[...proj.categories,defaultCat];addProject(proj);}}
          onClose={()=>setShowAddProject(false)}/>
      )}
      {showAddCategory&&<AddCategoryModal onAdd={name=>{addCategory(name);}} onClose={()=>setShowAddCategory(false)}/>}
    </div>
  );
}
