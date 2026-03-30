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
  { value: "not_started", label: "Not Started", color: "#6b7280" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6" },
  { value: "with_tag",    label: "With TAG",    color: "#a855f7" },
  { value: "on_hold",     label: "On Hold",     color: "#f59e0b" },
  { value: "in_review",   label: "In Review",   color: "#06b6d4" },
  { value: "complete",    label: "Complete",    color: "#22c55e" },
];
const PRIORITY_OPTIONS = [
  { value: "high",   label: "High", color: "#ef4444" },
  { value: "medium", label: "Med",  color: "#f59e0b" },
  { value: "low",    label: "Low",  color: "#22c55e" },
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
function statusMeta(val)   { return STATUS_OPTIONS.find(s => s.value === val)   || STATUS_OPTIONS[0]; }
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

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function ProgressBar({ pct }) {
  return (
    <div style={{background:"#1a2235",borderRadius:99,height:5,overflow:"hidden",width:"100%"}}>
      <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:pct===100?"#22c55e":"#3b82f6",transition:"width .4s ease"}}/>
    </div>
  );
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return { open, setOpen, ref };
}

function StatusBadge({ value, onChange }) {
  const { open, setOpen, ref } = useDropdown();
  const meta = statusMeta(value);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{background:meta.color+"22",border:`1px solid ${meta.color}44`,color:meta.color,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>
        {meta.label}
      </button>
      {open && (
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:"#141d2e",border:"1px solid #243044",borderRadius:8,overflow:"hidden",minWidth:140,boxShadow:"0 12px 40px #000a"}}>
          {STATUS_OPTIONS.map(s => (
            <div key={s.value} onClick={e=>{e.stopPropagation();onChange(s.value);setOpen(false);}}
              style={{padding:"8px 14px",cursor:"pointer",fontSize:12,color:s.color,fontWeight:600,background:s.value===value?"#ffffff08":"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"}
              onMouseLeave={e=>e.currentTarget.style.background=s.value===value?"#ffffff08":"transparent"}
            >{s.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ value, onChange }) {
  const { open, setOpen, ref } = useDropdown();
  const meta = priorityMeta(value);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{background:meta?meta.color+"22":"#1e2533",border:`1px solid ${meta?meta.color+"44":"#243044"}`,color:meta?meta.color:"#475569",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
        {meta?meta.label:"P"}
      </button>
      {open && (
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:"#141d2e",border:"1px solid #243044",borderRadius:8,overflow:"hidden",minWidth:120,boxShadow:"0 12px 40px #000a"}}>
          {PRIORITY_OPTIONS.map(p => (
            <div key={p.value} onClick={e=>{e.stopPropagation();onChange(p.value);setOpen(false);}}
              style={{padding:"7px 14px",cursor:"pointer",fontSize:12,color:p.color,fontWeight:600,background:p.value===value?"#ffffff08":"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"}
              onMouseLeave={e=>e.currentTarget.style.background=p.value===value?"#ffffff08":"transparent"}
            >{p.label}</div>
          ))}
          {value && <div onClick={e=>{e.stopPropagation();onChange(null);setOpen(false);}} style={{padding:"6px 14px",cursor:"pointer",fontSize:11,color:"#475569",borderTop:"1px solid #1e2d3d"}} onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>Clear</div>}
        </div>
      )}
    </div>
  );
}

function MultiCategorySelect({ selected, options, onChange }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{background:"#1a2235",border:"1px solid #243044",color:"#94a3b8",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {selected.length===0?"Select categories…":selected.join(", ")}
      </button>
      {open && (
        <div style={{position:"absolute",top:"110%",left:0,zIndex:600,background:"#141d2e",border:"1px solid #243044",borderRadius:8,overflow:"hidden",minWidth:200,boxShadow:"0 12px 40px #000a",maxHeight:260,overflowY:"auto"}}>
          {options.map(o => (
            <div key={o} onClick={e=>{e.stopPropagation();onChange(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o]);}}
              style={{padding:"7px 14px",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:8,color:selected.includes(o)?"#e2e8f0":"#94a3b8",background:selected.includes(o)?"#3b82f618":"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff0d"}
              onMouseLeave={e=>e.currentTarget.style.background=selected.includes(o)?"#3b82f618":"transparent"}
            >
              <span style={{width:13,height:13,borderRadius:3,border:"1px solid #3b82f6",background:selected.includes(o)?"#3b82f6":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {selected.includes(o)&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}
              </span>{o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({ comments=[], onAdd, onDelete }) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim()) return;
    onAdd({ id:uid(), text:text.trim(), createdAt:new Date().toISOString() });
    setText("");
  }
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8,textTransform:"uppercase",letterSpacing:0.8}}>💬 Comments</div>
      {comments.map(c=>(
        <div key={c.id} style={{background:"#0b1220",borderRadius:8,padding:"8px 11px",marginBottom:5,border:"1px solid #1a2535"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
            <div style={{color:"#cbd5e1",fontSize:12,lineHeight:1.5,flex:1}}>{c.text}</div>
            <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:13,lineHeight:1,padding:0,flexShrink:0}}>×</button>
          </div>
          <div style={{color:"#2d3f55",fontSize:10,marginTop:3}}>{fmtDateTime(c.createdAt)}</div>
        </div>
      ))}
      <div style={{display:"flex",gap:6,marginTop:6}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment…" onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submit()}
          style={{flex:1,background:"#0b1220",border:"1px solid #1a2535",color:"#e2e8f0",borderRadius:7,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}/>
        <button onClick={submit} style={{padding:"6px 11px",background:"#3b82f620",border:"1px solid #3b82f640",color:"#3b82f6",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:700}}>Post</button>
      </div>
    </div>
  );
}

function SyncDot({ status }) {
  const map = { synced:["#22c55e","Synced"], syncing:["#f59e0b","Saving…"], error:["#ef4444","Error"] };
  const [color,label] = map[status]||map.synced;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:color,boxShadow:`0 0 5px ${color}`}}/>
      {label}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab, categories, setCategories, addCategoryCount, syncStatus, onAddCategory }) {
  const dragCat = useRef(null); const dragOverCat = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const pinnedTabs = [
    { id:"overview", label:"⬡  Overview",  icon:null },
    { id:"tasks",    label:"☑  All Tasks", icon:null },
  ];

  function handleDragEnd() {
    if (dragCat.current!==null && dragOverCat.current!==null && dragCat.current!==dragOverCat.current) {
      setCategories(reorder(categories, dragCat.current, dragOverCat.current));
    }
    dragCat.current=null; dragOverCat.current=null; setDragOverIdx(null);
  }

  const catCounts = addCategoryCount;

  return (
    <div style={{width:200,minWidth:200,background:"#0b1220",borderRight:"1px solid #141d2e",display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,flexShrink:0}}>
      {/* Logo */}
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid #141d2e"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#e2e8f0",letterSpacing:"-0.5px"}}>Work Tracker</div>
        <div style={{fontSize:9,color:"#2d3f55",letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Project Dashboard</div>
        <div style={{marginTop:8}}><SyncDot status={syncStatus}/></div>
      </div>

      {/* Nav */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        {/* Pinned */}
        <div style={{marginBottom:4}}>
          {pinnedTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              style={{width:"100%",textAlign:"left",padding:"8px 10px",background:activeTab===tab.id?"#1a2d4a":"transparent",border:"none",borderRadius:7,color:activeTab===tab.id?"#60a5fa":"#64748b",fontWeight:activeTab===tab.id?700:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"block",transition:"all .15s",marginBottom:2}}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{height:1,background:"#141d2e",margin:"6px 4px 10px"}}>
          <div style={{fontSize:9,color:"#2d3f55",letterSpacing:1.2,textTransform:"uppercase",padding:"0 0 4px",marginTop:8}}>Categories</div>
        </div>

        {/* Draggable categories */}
        <div>
          {categories.map((cat,idx)=>{
            const count = (catCounts[cat]||0);
            const isOver = dragOverIdx===idx;
            return (
              <div key={cat} draggable
                onDragStart={()=>{dragCat.current=idx;}}
                onDragEnter={()=>{dragOverCat.current=idx;setDragOverIdx(idx);}}
                onDragEnd={handleDragEnd}
                onDragOver={e=>e.preventDefault()}
                style={{marginBottom:2}}>
                <button onClick={()=>setActiveTab(cat)}
                  style={{width:"100%",textAlign:"left",padding:"7px 10px",background:activeTab===cat?"#1a2d4a":isOver?"#1a2535":"transparent",border:isOver?"1px dashed #3b82f660":"1px solid transparent",borderRadius:7,color:activeTab===cat?"#60a5fa":"#64748b",fontWeight:activeTab===cat?600:400,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,transition:"all .12s"}}>
                  <span style={{color:"#1e2d3d",fontSize:11,cursor:"grab",flexShrink:0}}>⠿</span>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
                  {count>0&&<span style={{background:activeTab===cat?"#3b82f630":"#1a2535",color:activeTab===cat?"#60a5fa":"#475569",borderRadius:99,fontSize:9,fontWeight:700,padding:"1px 6px",flexShrink:0}}>{count}</span>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Add category */}
        <button onClick={onAddCategory} style={{width:"100%",textAlign:"left",padding:"7px 10px",background:"transparent",border:"1px dashed #1e2d3d",borderRadius:7,color:"#2d3f55",fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:6,transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.color="#475569"}
          onMouseLeave={e=>e.currentTarget.style.color="#2d3f55"}
        >+ Add category</button>
      </div>
    </div>
  );
}

// ─── DUE SOON BANNER ──────────────────────────────────────────────────────────
function DueSoonBanner({ projects, onOpen }) {
  const urgent = projects.filter(p=>{
    if (p.archived||p.status==="complete") return false;
    const d = daysUntil(p.deadline);
    return d!==null&&d>=0&&d<=3;
  }).sort((a,b)=>a.deadline.localeCompare(b.deadline));
  if (!urgent.length) return null;
  return (
    <div style={{background:"#f59e0b0e",border:"1px solid #f59e0b28",borderRadius:10,padding:"10px 14px",marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:7}}>⚡ Due in the next 3 days</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {urgent.map(p=>{
          const d=daysUntil(p.deadline);
          return (
            <button key={p.id} onClick={()=>onOpen(p.id)} style={{background:"#f59e0b14",border:"1px solid #f59e0b38",borderRadius:7,padding:"4px 11px",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{color:"#e2e8f0",fontSize:12,fontWeight:600}}>{p.name}{p.descriptor?` — ${p.descriptor}`:""}</span>
              <span style={{color:"#f59e0b",fontSize:11,marginLeft:7}}>{d===0?"Today":d===1?"Tomorrow":`${d}d`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
function GlobalSearch({ projects, onOpen }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setFocused(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const results = q.trim().length<2?[]:(() => {
    const ql=q.toLowerCase(); const out=[];
    projects.filter(p=>!p.archived).forEach(p=>{
      const pn=(p.name+(p.descriptor?` ${p.descriptor}`:"")); 
      if(pn.toLowerCase().includes(ql)) out.push({type:"project",project:p,label:p.name+(p.descriptor?` — ${p.descriptor}`:"")});
      (p.tasks||[]).forEach(t=>{if(t.name.toLowerCase().includes(ql))out.push({type:"task",project:p,task:t,label:t.name,sub:p.name+(p.descriptor?` — ${p.descriptor}`:"")});});
    });
    return out.slice(0,8);
  })();

  return (
    <div ref={ref} style={{position:"relative",flex:1,maxWidth:380}}>
      <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)}
        placeholder="🔍  Search projects & tasks…"
        style={{width:"100%",background:"#111827",border:"1px solid #1e2d3d",color:"#e2e8f0",borderRadius:7,padding:"6px 13px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      {focused&&results.length>0&&(
        <div style={{position:"absolute",top:"110%",left:0,right:0,zIndex:700,background:"#141d2e",border:"1px solid #243044",borderRadius:9,overflow:"hidden",boxShadow:"0 16px 48px #000b"}}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>{setQ("");setFocused(false);onOpen(r.project.id);}}
              style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #1a2535",display:"flex",alignItems:"center",gap:10}}
              onMouseEnter={e=>e.currentTarget.style.background="#ffffff08"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <span style={{fontSize:11,color:r.type==="project"?"#3b82f6":"#64748b",flexShrink:0}}>{r.type==="project"?"📁":"✓"}</span>
              <div style={{minWidth:0}}>
                <div style={{color:"#e2e8f0",fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                {r.sub&&<div style={{color:"#475569",fontSize:10,marginTop:1}}>{r.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────────
function TaskRow({ task, index, onUpdate, onDelete, onDragStart, onDragEnter, onDragEnd, isDragOver, showProject, projectName }) {
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(task.name);
  const [showComments, setShowComments] = useState(false);
  const pm = priorityMeta(task.priority);
  const overdue = task.deadline&&task.deadline<today()&&!task.complete;

  function addCmt(c)    { onUpdate({...task,comments:[...(task.comments||[]),c]}); }
  function delCmt(id)   { onUpdate({...task,comments:(task.comments||[]).filter(c=>c.id!==id)}); }

  return (
    <div draggable onDragStart={()=>onDragStart(index)} onDragEnter={()=>onDragEnter(index)} onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()}
      style={{borderRadius:7,border:`1px solid ${isDragOver?"#3b82f6":overdue?"#ef444428":"#ffffff06"}`,background:isDragOver?"#3b82f60c":task.complete?"#22c55e07":"#ffffff03",opacity:isDragOver?0.7:1,transition:"border-color .12s"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 11px"}}>
        <span style={{color:"#1e2d3d",fontSize:11,cursor:"grab",flexShrink:0}}>⠿</span>
        <input type="checkbox" checked={task.complete} onChange={e=>onUpdate({...task,complete:e.target.checked})} onClick={e=>e.stopPropagation()} style={{accentColor:"#22c55e",width:14,height:14,flexShrink:0,cursor:"pointer"}}/>
        {pm&&<div style={{width:3,height:24,borderRadius:2,background:pm.color,flexShrink:0}}/>}
        {editName
          ? <input value={nameVal} onChange={e=>setNameVal(e.target.value)} onBlur={()=>{onUpdate({...task,name:nameVal});setEditName(false);}} onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus onClick={e=>e.stopPropagation()} style={{flex:1,background:"#141d2e",border:"1px solid #3b82f6",color:"#e2e8f0",borderRadius:5,padding:"2px 7px",fontSize:12,fontFamily:"inherit"}}/>
          : <span onClick={e=>{e.stopPropagation();setEditName(true);}} style={{flex:1,color:task.complete?"#374151":overdue?"#ef4444":"#c4cdd9",textDecoration:task.complete?"line-through":"none",fontSize:12,cursor:"text",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</span>
        }
        {showProject&&<span style={{fontSize:10,color:"#2d3f55",whiteSpace:"nowrap",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",flexShrink:0}}>{projectName}</span>}
        <PriorityBadge value={task.priority} onChange={v=>onUpdate({...task,priority:v})}/>
        <button onClick={e=>{e.stopPropagation();setShowComments(s=>!s);}} style={{background:"none",border:"none",color:(task.comments||[]).length>0?"#64748b":"#1e2d3d",cursor:"pointer",fontSize:10,fontFamily:"inherit",whiteSpace:"nowrap",padding:"0 2px"}}>
          💬{(task.comments||[]).length>0?` ${(task.comments||[]).length}`:""}
        </button>
        <input type="date" value={task.deadline||""} onChange={e=>onUpdate({...task,deadline:e.target.value})} onClick={e=>e.stopPropagation()} style={{background:"transparent",border:"none",color:overdue?"#ef4444":"#475569",fontSize:10,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}/>
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:14,lineHeight:1,padding:"0 1px",flexShrink:0}}>×</button>
      </div>
      {showComments&&(
        <div style={{padding:"0 11px 9px 36px"}}>
          <CommentSection comments={task.comments||[]} onAdd={addCmt} onDelete={delCmt}/>
        </div>
      )}
    </div>
  );
}

// ─── PROJECT DETAIL ───────────────────────────────────────────────────────────
function ProjectDetailView({ project, categories, onUpdate, onBack }) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [editDesc, setEditDesc] = useState(false);
  const [descVal, setDescVal] = useState(project.descriptor||"");
  const dragItem=useRef(null); const dragOver=useRef(null); const [dragOverIdx,setDragOverIdx]=useState(null);
  const progress = project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue = project.deadline&&project.deadline<today()&&project.status!=="complete";

  function updateTask(t)  { onUpdate({...project,tasks:project.tasks.map(x=>x.id===t.id?t:x)}); }
  function deleteTask(id) { onUpdate({...project,tasks:project.tasks.filter(t=>t.id!==id)}); }
  function addTask()      {
    if(!newTaskName.trim())return;
    onUpdate({...project,tasks:[...project.tasks,{id:uid(),name:newTaskName.trim(),complete:false,priority:"medium",deadline:today(),notes:"",comments:[]}]});
    setNewTaskName(""); setAddingTask(false);
  }
  function handleDragEnd() {
    if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
      onUpdate({...project,tasks:reorder(project.tasks,dragItem.current,dragOver.current)});
    dragItem.current=null; dragOver.current=null; setDragOverIdx(null);
  }

  return (
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:0,marginBottom:18,display:"flex",alignItems:"center",gap:5}}>← Back</button>
      <div style={{background:"#111827",border:`1px solid ${isOverdue?"#ef444428":"#1a2535"}`,borderRadius:14,padding:"22px 26px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            {editName
              ? <input value={nameVal} onChange={e=>setNameVal(e.target.value)} onBlur={()=>{onUpdate({...project,name:nameVal});setEditName(false);}} onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus style={{fontSize:18,fontWeight:800,background:"#141d2e",border:"1px solid #3b82f6",color:"#e2e8f0",borderRadius:7,padding:"3px 9px",fontFamily:"inherit",width:"100%"}}/>
              : <h2 onClick={()=>setEditName(true)} style={{margin:0,fontSize:18,fontWeight:800,color:"#e2e8f0",cursor:"text"}}>{project.name}</h2>
            }
            {editDesc
              ? <input value={descVal} onChange={e=>setDescVal(e.target.value)} onBlur={()=>{onUpdate({...project,descriptor:descVal});setEditDesc(false);}} onKeyDown={e=>e.key==="Enter"&&e.target.blur()} autoFocus style={{marginTop:3,fontSize:13,background:"#141d2e",border:"1px solid #3b82f6",color:"#94a3b8",borderRadius:7,padding:"2px 9px",fontFamily:"inherit"}}/>
              : <div onClick={()=>setEditDesc(true)} style={{color:"#475569",fontSize:13,marginTop:3,cursor:"text"}}>{project.descriptor||<span style={{color:"#1e2d3d"}}>+ descriptor</span>}</div>
            }
          </div>
          <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          <div><div style={{color:"#374151",fontSize:10,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Categories</div><MultiCategorySelect selected={project.categories} options={categories} onChange={cats=>onUpdate({...project,categories:cats})}/></div>
          <div><div style={{color:"#374151",fontSize:10,marginBottom:3,textTransform:"uppercase",letterSpacing:0.8}}>Deadline</div><input type="date" value={project.deadline||""} onChange={e=>onUpdate({...project,deadline:e.target.value})} style={{background:"#141d2e",border:"1px solid #243044",color:isOverdue?"#ef4444":"#94a3b8",borderRadius:7,padding:"4px 9px",fontSize:12,fontFamily:"inherit"}}/></div>
        </div>
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#374151",marginBottom:5}}>
            <span>{project.tasks.filter(t=>t.complete).length} / {project.tasks.length} tasks done</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar pct={progress}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:7}}>
          <span style={{color:"#374151",fontSize:10,whiteSpace:"nowrap"}}>Override:</span>
          <input type="range" min={0} max={100} value={project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks)} onChange={e=>onUpdate({...project,progressOverride:Number(e.target.value)})} style={{accentColor:"#3b82f6",flex:1}}/>
          <span style={{color:"#374151",fontSize:10,minWidth:24}}>{progress}%</span>
          <button onClick={()=>onUpdate({...project,progressOverride:null})} style={{background:"none",border:"1px solid #1e2d3d",color:"#374151",cursor:"pointer",fontSize:9,fontFamily:"inherit",borderRadius:3,padding:"1px 5px"}}>Auto</button>
        </div>
        <div style={{marginTop:18,paddingTop:18,borderTop:"1px solid #1a2535"}}>
          <CommentSection comments={project.comments||[]} onAdd={c=>onUpdate({...project,comments:[...(project.comments||[]),c]})} onDelete={id=>onUpdate({...project,comments:(project.comments||[]).filter(c=>c.id!==id)})}/>
        </div>
      </div>
      <div style={{background:"#111827",border:"1px solid #1a2535",borderRadius:14,padding:"18px 22px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.8}}>Tasks</div>
          <div style={{fontSize:10,color:"#1e2d3d"}}>Drag to reorder · click name to edit</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {!project.tasks.length&&<div style={{color:"#1e2d3d",fontSize:12,padding:"10px 0",textAlign:"center"}}>No tasks yet.</div>}
          {project.tasks.map((t,idx)=>(
            <TaskRow key={t.id} task={t} index={idx} onUpdate={updateTask} onDelete={()=>deleteTask(t.id)}
              onDragStart={i=>{dragItem.current=i;}} onDragEnter={i=>{dragOver.current=i;setDragOverIdx(i);}} onDragEnd={handleDragEnd}
              isDragOver={dragOverIdx===idx}/>
          ))}
        </div>
        {addingTask
          ? <div style={{display:"flex",gap:7,marginTop:9}}>
              <input value={newTaskName} onChange={e=>setNewTaskName(e.target.value)} placeholder="Task name…" autoFocus onKeyDown={e=>e.key==="Enter"&&addTask()} style={{flex:1,background:"#141d2e",border:"1px solid #3b82f6",color:"#e2e8f0",borderRadius:7,padding:"6px 11px",fontSize:12,fontFamily:"inherit"}}/>
              <button onClick={addTask} style={{padding:"6px 13px",background:"#3b82f6",border:"none",color:"#fff",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12}}>Add</button>
              <button onClick={()=>setAddingTask(false)} style={{padding:"6px 10px",background:"transparent",border:"1px solid #1e2d3d",color:"#475569",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>✕</button>
            </div>
          : <button onClick={()=>setAddingTask(true)} style={{marginTop:9,background:"transparent",border:"1px dashed #1e2d3d",color:"#374151",borderRadius:7,padding:"7px 13px",cursor:"pointer",fontSize:11,fontFamily:"inherit",width:"100%"}}>+ Add Task</button>
        }
      </div>
    </div>
  );
}

// ─── OVERVIEW CARD ────────────────────────────────────────────────────────────
function OverviewCard({ project, onUpdate, onNavigate, onArchive, isDragOver, onDragStart, onDragEnter, onDragEnd }) {
  const progress = project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue = project.deadline&&project.deadline<today()&&project.status!=="complete";
  const [showTasks, setShowTasks] = useState(false);

  return (
    <div draggable onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()} onClick={onNavigate}
      style={{background:"#111827",border:`1px solid ${isDragOver?"#3b82f6":isOverdue?"#ef444428":"#1a2535"}`,borderRadius:11,padding:"15px 17px",cursor:"pointer",opacity:isDragOver?0.55:1,transition:"all .12s",boxShadow:isDragOver?"0 0 0 2px #3b82f638":"none"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:9,marginBottom:9}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:"#dde4f0",fontWeight:700,fontSize:13,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name}{project.descriptor?` — ${project.descriptor}`:""}</div>
          <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
            {project.categories.map(c=><span key={c} style={{background:"#1a2535",color:"#475569",fontSize:9,padding:"1px 6px",borderRadius:99,fontWeight:600}}>{c}</span>)}
          </div>
        </div>
        <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
        <div style={{flex:1}}><ProgressBar pct={progress}/></div>
        <span style={{color:"#475569",fontSize:10}}>{progress}%</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:7}}>
        <button onClick={e=>{e.stopPropagation();setShowTasks(s=>!s);}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit",fontSize:10,padding:0}}>
          {showTasks?"▲":"▼"} {project.tasks.filter(t=>t.complete).length}/{project.tasks.length} tasks{(project.comments||[]).length>0?` · 💬 ${(project.comments||[]).length}`:""}
        </button>
        <span style={{color:isOverdue?"#ef4444":"#374151",fontWeight:isOverdue?700:400}}>{isOverdue?"⚠ ":""}{fmtDate(project.deadline)}</span>
      </div>
      {showTasks&&(
        <div onClick={e=>e.stopPropagation()} style={{borderTop:"1px solid #1a2535",paddingTop:7,display:"flex",flexDirection:"column",gap:3,marginBottom:6}}>
          {project.tasks.map(t=>{
            const pm=priorityMeta(t.priority);
            return (
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 5px",borderRadius:5,background:"#ffffff03"}}>
                <input type="checkbox" checked={t.complete} onChange={e=>onUpdate({...project,tasks:project.tasks.map(x=>x.id===t.id?{...x,complete:e.target.checked}:x)})} style={{accentColor:"#22c55e",width:12,height:12,cursor:"pointer",flexShrink:0}}/>
                {pm&&<div style={{width:2,height:12,borderRadius:1,background:pm.color,flexShrink:0}}/>}
                <span style={{flex:1,fontSize:11,color:t.complete?"#2d3f55":"#7e8fa8",textDecoration:t.complete?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                <span style={{fontSize:9,color:t.deadline&&t.deadline<today()&&!t.complete?"#ef4444":"#2d3f55",flexShrink:0}}>{fmtDate(t.deadline)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{display:"flex",gap:8,paddingTop:7,borderTop:"1px solid #141d2e",alignItems:"center"}}>
        <span style={{color:"#3b82f6",fontSize:10}}>Open →</span>
        <button onClick={e=>{e.stopPropagation();onArchive();}} style={{marginLeft:"auto",background:"none",border:"none",color:"#2d3f55",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Archive</button>
      </div>
    </div>
  );
}

// ─── BOARD CARD (category) ────────────────────────────────────────────────────
function BoardCard({ project, onUpdate, onDelete, onOpen, onArchive, isDragOver, onDragStart, onDragEnter, onDragEnd }) {
  const progress = project.progressOverride!==null?project.progressOverride:calcProgress(project.tasks);
  const isOverdue = project.deadline&&project.deadline<today()&&project.status!=="complete";
  return (
    <div draggable onDragStart={e=>{e.stopPropagation();onDragStart();}} onDragEnter={e=>{e.stopPropagation();onDragEnter();}} onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()} onClick={onOpen}
      style={{background:"#0d1421",border:`1px solid ${isDragOver?"#3b82f6":isOverdue?"#ef444428":"#1a2535"}`,borderRadius:10,padding:"13px 15px",cursor:"pointer",opacity:isDragOver?0.55:1,transition:"all .12s"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:7,marginBottom:9}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:"#dde4f0",fontWeight:700,fontSize:12,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name}{project.descriptor?` — ${project.descriptor}`:""}</div>
          <div style={{color:"#1e2d3d",fontSize:9,marginTop:1}}>⠿ drag to reorder</div>
        </div>
        <StatusBadge value={project.status} onChange={v=>onUpdate({...project,status:v})}/>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{flex:1}}><ProgressBar pct={progress}/></div><span style={{color:"#475569",fontSize:10}}>{progress}%</span></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
        <span style={{color:"#374151"}}>{project.tasks.filter(t=>t.complete).length}/{project.tasks.length} tasks{(project.comments||[]).length>0?` · 💬 ${(project.comments||[]).length}`:""}</span>
        <span style={{color:isOverdue?"#ef4444":"#374151",fontWeight:isOverdue?700:400}}>{isOverdue?"⚠ ":""}{fmtDate(project.deadline)}</span>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:8,marginTop:7,borderTop:"1px solid #141d2e",alignItems:"center"}}>
        <span style={{color:"#3b82f6",fontSize:10}}>Open →</span>
        <button onClick={e=>{e.stopPropagation();onArchive();}} style={{marginLeft:"auto",background:"none",border:"none",color:"#2d3f55",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Archive</button>
        <button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",color:"#2d3f55",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Delete</button>
      </div>
    </div>
  );
}

// ─── ALL TASKS TAB ────────────────────────────────────────────────────────────
function AllTasksTab({ projects, onUpdateProject, onOpenProject }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showComplete, setShowComplete] = useState(false);

  const allTasks = [];
  projects.filter(p=>!p.archived).forEach(p=>{
    (p.tasks||[]).forEach(t=>{ allTasks.push({task:t,project:p}); });
  });

  const active = allTasks.filter(({task,project})=>{
    if(task.complete||project.status==="complete") return false;
    if(filterStatus!=="all"&&project.status!==filterStatus) return false;
    if(filterPriority!=="all"&&task.priority!==filterPriority) return false;
    return true;
  }).sort((a,b)=>(a.task.deadline||"9999").localeCompare(b.task.deadline||"9999"));

  const completed = allTasks.filter(({task})=>task.complete)
    .sort((a,b)=>(a.task.deadline||"9999").localeCompare(b.task.deadline||"9999"));

  function updateTask(project,updTask) {
    onUpdateProject({...project,tasks:project.tasks.map(t=>t.id===updTask.id?updTask:t)});
  }

  return (
    <div>
      <div style={{display:"flex",gap:9,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:"#111827",border:"1px solid #1a2535",color:"#94a3b8",borderRadius:7,padding:"6px 11px",fontSize:11,fontFamily:"inherit"}}>
          <option value="all">All Project Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{background:"#111827",border:"1px solid #1a2535",color:"#94a3b8",borderRadius:7,padding:"6px 11px",fontSize:11,fontFamily:"inherit"}}>
          <option value="all">All Priorities</option>
          {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <span style={{color:"#374151",fontSize:11,marginLeft:"auto"}}>{active.length} task{active.length!==1?"s":""} remaining</span>
      </div>

      {active.length===0
        ? <div style={{textAlign:"center",padding:"40px 20px",color:"#2d3f55",fontSize:13}}>No pending tasks — you're all caught up! 🎉</div>
        : <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {active.map(({task,project})=>{
              const pm=priorityMeta(task.priority);
              const overdue=task.deadline&&task.deadline<today()&&!task.complete;
              const d=daysUntil(task.deadline);
              const soon=d!==null&&d>=0&&d<=3;
              return (
                <div key={task.id} style={{background:"#111827",border:`1px solid ${overdue?"#ef444428":soon?"#f59e0b28":"#1a2535"}`,borderRadius:9,padding:"11px 15px",display:"flex",alignItems:"center",gap:9}}>
                  <input type="checkbox" checked={task.complete} onChange={e=>updateTask(project,{...task,complete:e.target.checked})} style={{accentColor:"#22c55e",width:14,height:14,cursor:"pointer",flexShrink:0}}/>
                  {pm&&<div style={{width:3,height:28,borderRadius:2,background:pm.color,flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"#dde4f0",fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                    <button onClick={()=>onOpenProject(project.id)} style={{background:"none",border:"none",color:"#3b82f6",fontSize:10,cursor:"pointer",fontFamily:"inherit",padding:0,marginTop:1}}>
                      {project.name}{project.descriptor?` — ${project.descriptor}`:""} →
                    </button>
                  </div>
                  {pm&&<span style={{background:pm.color+"1a",border:`1px solid ${pm.color}38`,color:pm.color,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,flexShrink:0}}>{pm.label}</span>}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {(overdue||soon)&&<div style={{fontSize:10,color:overdue?"#ef4444":"#f59e0b",fontWeight:700}}>{overdue?"⚠ Overdue":d===0?"Today":d===1?"Tomorrow":`${d}d`}</div>}
                    <div style={{fontSize:10,color:"#2d3f55"}}>{fmtDate(task.deadline)}</div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {completed.length>0&&(
        <div style={{marginTop:28}}>
          <button onClick={()=>setShowComplete(s=>!s)} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontFamily:"inherit",fontSize:11,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:10}}>
            {showComplete?"▼":"▶"} Completed tasks ({completed.length})
          </button>
          {showComplete&&(
            <div style={{display:"flex",flexDirection:"column",gap:4,opacity:0.5}}>
              {completed.map(({task,project})=>(
                <div key={task.id} style={{background:"#111827",border:"1px solid #1a2535",borderRadius:9,padding:"9px 15px",display:"flex",alignItems:"center",gap:9}}>
                  <input type="checkbox" checked={true} onChange={()=>updateTask(project,{...task,complete:false})} style={{accentColor:"#22c55e",width:14,height:14,cursor:"pointer",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:"#374151",fontSize:12,textDecoration:"line-through",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                    <div style={{color:"#1e2d3d",fontSize:10,marginTop:1}}>{project.name}{project.descriptor?` — ${project.descriptor}`:""}</div>
                  </div>
                  <div style={{color:"#2d3f55",fontSize:10}}>{fmtDate(task.deadline)}</div>
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
function AddProjectModal({ categories, defaultCategory, onAdd, onClose }) {
  const [name,setName]=useState(""); const [descriptor,setDescriptor]=useState("");
  const [templateType,setTemplateType]=useState(""); const [cats,setCats]=useState(defaultCategory?[defaultCategory]:[]);
  const [deadline,setDeadline]=useState(addBusinessDays(today(),5));
  const [mode,setMode]=useState("select"); const [customType,setCustomType]=useState("");
  const template=PROJECT_TEMPLATES[mode==="custom"?customType:templateType];

  function handleAdd() {
    if(!name.trim())return;
    const c=today();
    const tasks=template?template.tasks.map(t=>({id:uid(),name:t.name,complete:false,priority:"medium",deadline:addBusinessDays(c,t.offsetDays),notes:"",comments:[]})):[];
    onAdd({id:uid(),name:name.trim(),descriptor:descriptor.trim(),status:"not_started",categories:cats,deadline,createdAt:c,progressOverride:null,archived:false,comments:[],tasks});
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"#000d",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#111827",border:"1px solid #243044",borderRadius:14,padding:28,width:480,maxWidth:"95vw",boxShadow:"0 24px 80px #000a",maxHeight:"90vh",overflowY:"auto"}}>
        <h2 style={{margin:"0 0 20px",color:"#e2e8f0",fontSize:16,fontWeight:800}}>Add New Project</h2>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <label style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Project Type
            <div style={{display:"flex",gap:6,marginTop:5}}>
              {["select","custom"].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:"3px 11px",borderRadius:5,border:"1px solid",borderColor:mode===m?"#3b82f6":"#243044",background:mode===m?"#3b82f618":"transparent",color:mode===m?"#60a5fa":"#475569",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{m==="select"?"From Template":"Custom"}</button>)}
            </div>
            {mode==="select"
              ? <select value={templateType} onChange={e=>setTemplateType(e.target.value)} style={{marginTop:5,width:"100%",background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit"}}><option value="">— No template —</option>{TASK_TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select>
              : <input value={customType} onChange={e=>setCustomType(e.target.value)} placeholder="Custom type…" style={{marginTop:5,width:"100%",background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
            }
          </label>
          <label style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Project Name *
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Price Increase Communication" style={{display:"block",marginTop:5,width:"100%",background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </label>
          <label style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Descriptor <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span>
            <input value={descriptor} onChange={e=>setDescriptor(e.target.value)} placeholder="e.g. Example Name" style={{display:"block",marginTop:5,width:"100%",background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </label>
          <label style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Categories
            <div style={{marginTop:5}}><MultiCategorySelect selected={cats} options={categories} onChange={setCats}/></div>
          </label>
          <label style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>
            Deadline
            <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{display:"block",marginTop:5,background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"7px 11px",fontSize:12,fontFamily:"inherit"}}/>
          </label>
          {template&&(
            <div style={{background:"#3b82f60c",border:"1px solid #3b82f628",borderRadius:7,padding:"9px 13px"}}>
              <div style={{color:"#60a5fa",fontSize:10,fontWeight:700,marginBottom:5}}>AUTO-POPULATED TASKS ({template.tasks.length})</div>
              {template.tasks.map((t,i)=><div key={i} style={{color:"#7e8fa8",fontSize:11,padding:"1px 0"}}>• {t.name} <span style={{color:"#2d3f55"}}>(+{t.offsetDays}d)</span></div>)}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:9,marginTop:22,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",borderRadius:7,border:"1px solid #243044",background:"transparent",color:"#7e8fa8",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancel</button>
          <button onClick={handleAdd} style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#3b82f6",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Add Project</button>
        </div>
      </div>
    </div>
  );
}

function AddCategoryModal({ onAdd, onClose }) {
  const [name,setName]=useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"#000d",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#111827",border:"1px solid #243044",borderRadius:14,padding:28,width:340,boxShadow:"0 24px 80px #000a"}}>
        <h2 style={{margin:"0 0 18px",color:"#e2e8f0",fontSize:16,fontWeight:800}}>Add New Category</h2>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Category name…" autoFocus onKeyDown={e=>e.key==="Enter"&&name.trim()&&(onAdd(name.trim()),onClose())} style={{width:"100%",background:"#141d2e",border:"1px solid #243044",color:"#e2e8f0",borderRadius:7,padding:"9px 13px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:9,marginTop:18,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",borderRadius:7,border:"1px solid #243044",background:"transparent",color:"#7e8fa8",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancel</button>
          <button onClick={()=>{if(name.trim()){onAdd(name.trim());onClose();}}} style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#3b82f6",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [openProjectId, setOpenProjectId] = useState(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [catStatusFilter, setCatStatusFilter] = useState("all");
  const [catPriorityFilter, setCatPriorityFilter] = useState("all");
  const [catTaskFilter, setCatTaskFilter] = useState("all");
  const [syncStatus, setSyncStatus] = useState("syncing");
  const [loaded, setLoaded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const saveTimer = useRef(null);
  const dragItem=useRef(null); const dragOver=useRef(null); const [dragOverIdx,setDragOverIdx]=useState(null);

  useEffect(()=>{
    loadFromSupabase().then(d=>{setData(d||defaultState());setLoaded(true);setSyncStatus("synced");})
      .catch(()=>{setData(defaultState());setLoaded(true);setSyncStatus("error");});
  },[]);

  useEffect(()=>{
    if(!loaded||!data)return;
    setSyncStatus("syncing");
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      try{await saveToSupabase(data);setSyncStatus("synced");}
      catch{setSyncStatus("error");}
    },800);
    return()=>clearTimeout(saveTimer.current);
  },[data,loaded]);

  // Keyboard shortcut N
  useEffect(()=>{
    const h=e=>{if(e.key==="n"&&!e.metaKey&&!e.ctrlKey&&e.target.tagName!=="INPUT"&&e.target.tagName!=="TEXTAREA")setShowAddProject(true);};
    document.addEventListener("keydown",h); return()=>document.removeEventListener("keydown",h);
  },[]);

  // Single source of truth — all updates go through here
  const updateProject  = useCallback(proj=>setData(d=>({...d,projects:d.projects.map(p=>p.id===proj.id?proj:p)})),[]);
  const deleteProject  = useCallback(id=>{if(!confirm("Delete this project?"))return;setData(d=>({...d,projects:d.projects.filter(p=>p.id!==id)}));setOpenProjectId(null);},[]);
  const addProject     = useCallback(proj=>setData(d=>({...d,projects:[...d.projects,proj]})),[]);
  const archiveProject = useCallback((id,val)=>setData(d=>({...d,projects:d.projects.map(p=>p.id===id?{...p,archived:val}:p)})),[]);
  const setCategories  = useCallback(cats=>setData(d=>({...d,categories:cats})),[]);
  const addCategory    = useCallback(name=>setData(d=>({...d,categories:[...d.categories,name]})),[]);

  if(!data) return (
    <div style={{minHeight:"100vh",background:"#0b1220",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:32,height:32,border:"3px solid #1a2535",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:"#374151",fontSize:12}}>Connecting to cloud…</div>
    </div>
  );

  const { categories, projects } = data;
  const openProject = openProjectId ? projects.find(p=>p.id===openProjectId) : null;
  const activeProjects = projects.filter(p=>!p.archived);
  const archivedProjects = projects.filter(p=>p.archived);

  // Build category badge counts (active non-complete projects per category)
  const catCounts = {};
  categories.forEach(c=>{ catCounts[c]=activeProjects.filter(p=>p.categories.includes(c)&&p.status!=="complete").length; });

  // Overview filtered
  const overviewActive = activeProjects.filter(p=>{
    if(p.status==="complete") return false;
    if(filterStatus!=="all"&&p.status!==filterStatus) return false;
    if(filterCat!=="all"&&!p.categories.includes(filterCat)) return false;
    return true;
  });
  const overviewComplete = activeProjects.filter(p=>p.status==="complete"&&(filterCat==="all"||p.categories.includes(filterCat)));

  const stats = [
    {label:"Active",     value:activeProjects.filter(p=>p.status!=="complete").length, color:"#3b82f6", icon:"◈"},
    {label:"In Progress",value:activeProjects.filter(p=>p.status==="in_progress").length, color:"#06b6d4", icon:"◎"},
    {label:"Complete",   value:activeProjects.filter(p=>p.status==="complete").length, color:"#22c55e", icon:"✓"},
    {label:"Overdue",    value:activeProjects.filter(p=>p.deadline&&p.deadline<today()&&p.status!=="complete").length, color:"#ef4444", icon:"⚠"},
  ];

  // Category tab data — ALL reads from single projects array so it's always in sync
  const catActive   = activeProjects.filter(p=>p.categories.includes(activeTab)&&p.status!=="complete");
  const catComplete = activeProjects.filter(p=>p.categories.includes(activeTab)&&p.status==="complete");
  const catFiltered = catActive.filter(p=>{
    if(catStatusFilter!=="all"&&p.status!==catStatusFilter) return false;
    return true;
  }).map(p=>({
    ...p,
    tasks:(p.tasks||[]).filter(t=>{
      if(catPriorityFilter!=="all"&&t.priority!==catPriorityFilter) return false;
      if(catTaskFilter==="pending"&&t.complete) return false;
      if(catTaskFilter==="complete"&&!t.complete) return false;
      return true;
    })
  }));

  function handleBoardDragEnd(newList) {
    setData(d=>{
      const others = d.projects.filter(p=>!p.categories.includes(activeTab)||p.archived||p.status==="complete");
      return {...d, projects:[...others, ...newList]};
    });
    setDragOverIdx(null); dragItem.current=null; dragOver.current=null;
  }

  const defaultCat = activeTab!=="overview"&&activeTab!=="tasks" ? activeTab : null;

  return (
    <div style={{minHeight:"100vh",background:"#0b1220",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",color:"#e2e8f0",display:"flex"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.35)} ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-track{background:#0b1220} ::-webkit-scrollbar-thumb{background:#1e2d3d;border-radius:2px}`}</style>

      {/* SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={tab=>{ setActiveTab(tab); setOpenProjectId(null); setCatStatusFilter("all"); setCatPriorityFilter("all"); setCatTaskFilter("all"); }}
        categories={categories}
        setCategories={setCategories}
        addCategoryCount={catCounts}
        syncStatus={syncStatus}
        onAddCategory={()=>setShowAddCategory(true)}
      />

      {/* MAIN AREA */}
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>

        {/* TOP BAR */}
        <div style={{background:"#0d1421",borderBottom:"1px solid #141d2e",padding:"10px 22px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:13,color:"#475569"}}>
            {openProject ? <><span style={{color:"#374151"}}>←</span> {activeTab==="overview"?"Overview":activeTab}</> : activeTab==="overview"?"Overview":activeTab==="tasks"?"All Tasks":activeTab}
          </div>
          <div style={{flex:1}}/>
          <GlobalSearch projects={projects} onOpen={id=>{setOpenProjectId(id);}}/>
          <button onClick={()=>setShowAddProject(true)} title="New project (N)" style={{padding:"6px 14px",background:"#3b82f6",border:"none",color:"#fff",borderRadius:7,fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
            + New <span style={{opacity:0.55,fontSize:9}}>[N]</span>
          </button>
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"22px 24px"}}>

          {/* PROJECT DETAIL — full two-way sync: reads from projects array directly */}
          {openProject && (
            <ProjectDetailView
              project={openProject}
              categories={categories}
              onUpdate={updateProject}
              onBack={()=>setOpenProjectId(null)}
            />
          )}

          {/* OVERVIEW */}
          {!openProject && activeTab==="overview" && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:18}}>
                {stats.map(s=>(
                  <div key={s.label} style={{background:"#111827",border:"1px solid #1a2535",borderRadius:10,padding:"12px 15px",display:"flex",alignItems:"center",gap:9}}>
                    <div style={{fontSize:16,color:s.color,opacity:0.65}}>{s.icon}</div>
                    <div><div style={{fontSize:20,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div><div style={{fontSize:10,color:"#374151",marginTop:2}}>{s.label}</div></div>
                  </div>
                ))}
              </div>

              <DueSoonBanner projects={activeProjects} onOpen={id=>{setOpenProjectId(id);}}/>

              <div style={{display:"flex",gap:9,marginBottom:15,flexWrap:"wrap",alignItems:"center"}}>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{background:"#111827",border:"1px solid #1a2535",color:"#7e8fa8",borderRadius:7,padding:"6px 11px",fontSize:11,fontFamily:"inherit"}}>
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.filter(s=>s.value!=="complete").map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{background:"#111827",border:"1px solid #1a2535",color:"#7e8fa8",borderRadius:7,padding:"6px 11px",fontSize:11,fontFamily:"inherit"}}>
                  <option value="all">All Categories</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {overviewActive.length===0
                ? <div style={{textAlign:"center",padding:"36px 20px",color:"#2d3f55",fontSize:12}}>No active projects match your filters.</div>
                : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:11}}>
                    {overviewActive.map((p,idx)=>(
                      <OverviewCard key={p.id} project={p}
                        onUpdate={updateProject}
                        onNavigate={()=>setOpenProjectId(p.id)}
                        onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={dragOverIdx===idx}
                        onDragStart={()=>{dragItem.current=idx;}}
                        onDragEnter={()=>{dragOver.current=idx;setDragOverIdx(idx);}}
                        onDragEnd={()=>{
                          if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
                            setData(d=>({...d,projects:reorder(d.projects,dragItem.current,dragOver.current)}));
                          setDragOverIdx(null);dragItem.current=null;dragOver.current=null;
                        }}
                      />
                    ))}
                  </div>
              }

              {overviewComplete.length>0&&(
                <div style={{marginTop:32}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{flex:1,height:1,background:"#141d2e"}}/>
                    <span style={{color:"#2d3f55",fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.8}}>✓ COMPLETED ({overviewComplete.length})</span>
                    <div style={{flex:1,height:1,background:"#141d2e"}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:11,opacity:0.55}}>
                    {overviewComplete.map(p=>(
                      <OverviewCard key={p.id} project={p} onUpdate={updateProject} onNavigate={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)} isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
                    ))}
                  </div>
                </div>
              )}

              {archivedProjects.length>0&&(
                <div style={{marginTop:24}}>
                  <button onClick={()=>setShowArchived(s=>!s)} style={{background:"none",border:"none",color:"#2d3f55",cursor:"pointer",fontFamily:"inherit",fontSize:11,display:"flex",alignItems:"center",gap:5,padding:0}}>
                    {showArchived?"▼":"▶"} Archived ({archivedProjects.length})
                  </button>
                  {showArchived&&(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:11,marginTop:10,opacity:0.4}}>
                      {archivedProjects.map(p=>(
                        <OverviewCard key={p.id} project={p} onUpdate={updateProject} onNavigate={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,false)} isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ALL TASKS */}
          {!openProject && activeTab==="tasks" && (
            <AllTasksTab projects={activeProjects} onUpdateProject={updateProject} onOpenProject={id=>setOpenProjectId(id)}/>
          )}

          {/* CATEGORY TAB */}
          {!openProject && activeTab!=="overview" && activeTab!=="tasks" && (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:9}}>
                <div>
                  <h1 style={{margin:0,fontSize:18,fontWeight:800,color:"#e2e8f0"}}>{activeTab}</h1>
                  <div style={{color:"#374151",fontSize:11,marginTop:2}}>{catActive.length} active project{catActive.length!==1?"s":""}</div>
                </div>
              </div>

              {/* Filters */}
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",background:"#111827",border:"1px solid #1a2535",borderRadius:9,padding:"9px 13px",alignItems:"center"}}>
                <span style={{color:"#2d3f55",fontSize:10,fontWeight:700,letterSpacing:0.8}}>FILTER</span>
                <select value={catStatusFilter} onChange={e=>setCatStatusFilter(e.target.value)} style={{background:"#0d1421",border:"1px solid #1a2535",color:"#7e8fa8",borderRadius:6,padding:"4px 9px",fontSize:11,fontFamily:"inherit"}}>
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.filter(s=>s.value!=="complete").map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={catPriorityFilter} onChange={e=>setCatPriorityFilter(e.target.value)} style={{background:"#0d1421",border:"1px solid #1a2535",color:"#7e8fa8",borderRadius:6,padding:"4px 9px",fontSize:11,fontFamily:"inherit"}}>
                  <option value="all">All Priorities</option>
                  {PRIORITY_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select value={catTaskFilter} onChange={e=>setCatTaskFilter(e.target.value)} style={{background:"#0d1421",border:"1px solid #1a2535",color:"#7e8fa8",borderRadius:6,padding:"4px 9px",fontSize:11,fontFamily:"inherit"}}>
                  <option value="all">All Tasks</option>
                  <option value="pending">Pending Only</option>
                  <option value="complete">Completed Only</option>
                </select>
                {(catStatusFilter!=="all"||catPriorityFilter!=="all"||catTaskFilter!=="all")&&
                  <button onClick={()=>{setCatStatusFilter("all");setCatPriorityFilter("all");setCatTaskFilter("all");}} style={{background:"none",border:"none",color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕ Clear</button>
                }
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {catFiltered.length===0
                  ? <div style={{textAlign:"center",padding:"36px 20px",color:"#2d3f55",fontSize:12}}>No projects match your filters.</div>
                  : catFiltered.map((p,idx)=>(
                      <BoardCard key={p.id} project={p}
                        onUpdate={proj=>{
                          // When updating from category tab, merge filtered tasks back with real project tasks
                          const realProject = projects.find(x=>x.id===proj.id);
                          const realTasks = realProject ? realProject.tasks.map(rt=>{
                            const updated = proj.tasks.find(ut=>ut.id===rt.id);
                            return updated||rt;
                          }) : proj.tasks;
                          updateProject({...proj, tasks:realTasks});
                        }}
                        onDelete={()=>deleteProject(p.id)}
                        onOpen={()=>setOpenProjectId(p.id)}
                        onArchive={()=>archiveProject(p.id,true)}
                        isDragOver={dragOverIdx===idx}
                        onDragStart={()=>{dragItem.current=idx;}}
                        onDragEnter={()=>{dragOver.current=idx;setDragOverIdx(idx);}}
                        onDragEnd={()=>{
                          if(dragItem.current!==null&&dragOver.current!==null&&dragItem.current!==dragOver.current)
                            handleBoardDragEnd(reorder(catActive,dragItem.current,dragOver.current));
                          else{setDragOverIdx(null);dragItem.current=null;dragOver.current=null;}
                        }}
                      />
                    ))
                }
              </div>

              {catComplete.length>0&&(
                <div style={{marginTop:26}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:1,height:1,background:"#141d2e"}}/>
                    <span style={{color:"#2d3f55",fontSize:10,fontWeight:700,whiteSpace:"nowrap",letterSpacing:0.8}}>✓ COMPLETED ({catComplete.length})</span>
                    <div style={{flex:1,height:1,background:"#141d2e"}}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:7,opacity:0.5}}>
                    {catComplete.map(p=>(
                      <BoardCard key={p.id} project={p} onUpdate={updateProject} onDelete={()=>deleteProject(p.id)} onOpen={()=>setOpenProjectId(p.id)} onArchive={()=>archiveProject(p.id,true)} isDragOver={false} onDragStart={()=>{}} onDragEnter={()=>{}} onDragEnd={()=>{}}/>
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
