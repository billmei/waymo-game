// Rebuild the shared relaxed-mode routes from the island's actual streets and colliders.
// Serve the repo on :8123, then run node tools/playtest/build-road-map.js.
// Output is staged in work/road-map.json for inspection before updating js/road-data.js.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function build() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.on("pageerror", e => console.error(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.waitForFunction(() => window.WG?.G?.state === "title", null, { timeout: 180000 });
    const result = await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
      const I = WG.isle, island = I.ISL, nodes = [], byPoint = new Map(), segments = new Set(), streets = [];
      const clearance = 4, step = 6;
      const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
      function clear(a, b) {
        const n = Math.max(1, Math.ceil(distance(a, b) / 2));
        let prev;
        for (let k = 0; k <= n; k++) {
          const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n;
          const y = I.groundH(x, z);
          if (y < 2.5 || I.hitsBuilding(x, y + 1, z, clearance)) return false;
          if (prev !== undefined && Math.abs(y - prev) > distance(a, b) / n * 0.85) return false;
          prev = y;
        }
        return true;
      }
      function node(x, z) {
        if (z < -1750 || z > 2250 || x < -2050 || x > 1900) return null;
        const key = x.toFixed(3) + "," + z.toFixed(3);
        if (byPoint.has(key)) return byPoint.get(key);
        const p = { x, z, id: nodes.length, nb: new Map() };
        if (!clear(p, p)) return null;
        nodes.push(p); byPoint.set(key, p);
        return p;
      }
      function link(a, b) {
        if (!a || !b || a === b || a.nb.has(b.id) || !clear(a, b)) return;
        const len = distance(a, b);
        a.nb.set(b.id, len); b.nb.set(a.id, len);
      }
      function segment(a, b) {
        const keys = [a, b].map(p => p.map(n => n.toFixed(3)).join(",")).sort();
        const key = keys.join("|");
        if (segments.has(key)) return;
        segments.add(key);
        streets.push({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},cuts:[0,1]});
      }
      // Block boundaries are the existing street centerlines, including each district's rotation.
      for (const [x, z, , angle, u, v] of island.cityBlocks()) {
        if (z > 2400 || z < -1900) continue;
        const c = Math.cos(angle), s = Math.sin(angle);
        const corners = [[-u/2,-v/2],[u/2,-v/2],[u/2,v/2],[-u/2,v/2]].map(([a,b]) => [x+a*c-b*s,z+a*s+b*c]);
        for (let k = 0; k < 4; k++) segment(corners[k], corners[(k+1)%4]);
      }
      // The street-level play areas add finer grids in the parks and around landmarks.
      for (const zone of Object.values(WG.world.ZONES)) {
        const c = Math.cos(zone.ang*Math.PI/180), s = Math.sin(zone.ang*Math.PI/180);
        const p = (i,j) => [i*zone.u*c-j*zone.v*s,i*zone.u*s+j*zone.v*c];
        for (let i=zone.i0; i<=zone.i1; i++) for(let j=zone.j0;j<=zone.j1;j++) {
          if(i<zone.i1) segment(p(i,j),p(i+1,j));
          if(j<zone.j1) segment(p(i,j),p(i,j+1));
        }
      }
      // Existing curving arterials and park drives, never straight neighborhood shortcuts.
      for (const line of [island.RING,island.MARKET,island.TPK,...island.PATHS,island.LOMBARD])
        for(let k=1;k<line.length;k++) segment(line[k-1],line[k]);
      // Split at exact intersections before sampling. This preserves right-angle turns;
      // proximity-linking samples here would cut diagonally across every street corner.
      const streetBins=new Map(), pairs=new Set();
      for(let id=0;id<streets.length;id++) {
        const road=streets[id], {a,b}=road;
        for(let i=Math.floor(Math.min(a.x,b.x)/100);i<=Math.floor(Math.max(a.x,b.x)/100);i++)
          for(let j=Math.floor(Math.min(a.z,b.z)/100);j<=Math.floor(Math.max(a.z,b.z)/100);j++) {
            const key=i+","+j;
            for(const other of streetBins.get(key)||[]) {
              const pair=other+":"+id;if(pairs.has(pair))continue;pairs.add(pair);
              const r=streets[other],dx=b.x-a.x,dz=b.z-a.z,ex=r.b.x-r.a.x,ez=r.b.z-r.a.z;
              const cross=dx*ez-dz*ex;if(Math.abs(cross)<1e-7)continue;
              const ox=r.a.x-a.x,oz=r.a.z-a.z,t=(ox*ez-oz*ex)/cross,u=(ox*dz-oz*dx)/cross;
              if(t>=0&&t<=1&&u>=0&&u<=1){road.cuts.push(t);r.cuts.push(u);}
            }
            if(!streetBins.has(key))streetBins.set(key,[]);streetBins.get(key).push(id);
          }
      }
      for(const {a,b,cuts} of streets) {
        cuts.sort((a,b)=>a-b);
        let prev=null;
        for(let j=1;j<cuts.length;j++) {
          const lo=cuts[j-1],hi=cuts[j],n=Math.max(1,Math.ceil(distance(a,b)*(hi-lo)/step));
          for(let k=0;k<=n;k++) {
            const t=lo+(hi-lo)*k/n,p=node(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);
            link(prev,p);prev=p;
          }
        }
      }
      // Only dangling street ends may bridge short gaps at a district boundary.
      const bins=new Map(),cell=20,key=(x,z)=>x+","+z;
      for(const p of nodes){const k=key(Math.floor(p.x/cell),Math.floor(p.z/cell));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);}
      const ends=nodes.filter(p=>p.nb.size===1);
      for(const p of ends) {
        const x=Math.floor(p.x/cell),z=Math.floor(p.z/cell),near=[];
        for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)
          for(const q of bins.get(key(i,j))||[])if(q!==p&&!p.nb.has(q.id)&&distance(p,q)<16)near.push(q);
        near.sort((a,b)=>distance(p,a)-distance(p,b));
        for(const q of near){const size=p.nb.size;link(p,q);if(p.nb.size>size)break;}
      }
      const components=[];
      for(const p of nodes) {
        if(p.component!==undefined) continue;
        const comp=[], stack=[p];p.component=components.length;
        while(stack.length) {const q=stack.pop();comp.push(q);for(const id of q.nb.keys())if(nodes[id].component===undefined){nodes[id].component=p.component;stack.push(nodes[id]);}}
        components.push(comp);
      }
      const largest=components.reduce((a,b)=>a.length>b.length?a:b,[]);
      const hoods={},snap=[];
      for(const row of island.DIST) {
        if(!WG.adoptData.HOODS[row[1]])continue;
        const p=largest.reduce((a,b)=>Math.hypot(a.x-row[2],a.z-row[3])<Math.hypot(b.x-row[2],b.z-row[3])?a:b);
        hoods[row[1]]=p.id;snap.push([row[1],Math.round(Math.hypot(p.x-row[2],p.z-row[3])),p.x,p.z]);
      }
      return {nodes:nodes.map(p=>[p.x,p.z,[...p.nb]]),hoods,edgeSpec:WG.adoptData.EDGES,stats:{nodes:nodes.length,components:components.map(c=>c.length).sort((a,b)=>b-a).slice(0,20),snap}};
    });
    const out=path.join(__dirname,"../../work/road-map.json");
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result));
    const data = { width: 6, clearance: 4, hoods: {}, edges: {} };
    const xy = id => result.nodes[id].slice(0, 2).map(v => +v.toFixed(5));
    for (const [name,id] of Object.entries(result.hoods)) data.hoods[name] = xy(id);
    for (const line of result.edgeSpec.trim().split("\n")) {
      const [from, rest] = line.split(":");
      for (const to of rest.split(",").map(s=>s.trim())) {
        const names=[from.trim(),to].sort(),key=names.join("|");
        if(data.edges[key])continue;
        const ids=route(result.nodes,result.hoods[names[0]],result.hoods[names[1]]);
        if(!ids)throw new Error("No street route: "+key);
        // Only remove collinear points; never smooth turns into building corners.
        const points=[];
        for(const id of ids) {
          const p=xy(id);
          if(points.length && Math.hypot(p[0]-points.at(-1)[0],p[1]-points.at(-1)[1])<0.001)continue;
          while(points.length>1) {
            const a=points.at(-2),b=points.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],ex=p[0]-b[0],ez=p[1]-b[1];
            if(Math.abs(dx*ez-dz*ex)>0.0005 || dx*ex+dz*ez<0)break;
            points.pop();
          }
          points.push(p);
        }
        data.edges[key]=points;
      }
    }
    const source="/* Generated from the island's street grids, arterials and building clearances.\n"+
      "   Rebuild with tools/playtest/build-road-map.js; shared by Adopt and Sunday Drive. */\n"+
      "(typeof window !== \"undefined\" ? window : globalThis).WG.roadData = "+JSON.stringify(data,null,2)+";\n";
    fs.writeFileSync(path.join(path.dirname(out),"road-data.js"),source);
    console.log("Routed",Object.keys(data.edges).length,"connections; staged work/road-data.js");
    console.log(JSON.stringify(result.stats,null,2));
  } finally { await browser.close(); }
}
// A* on the actual street graph. Distances are island units, including every turn.
function route(nodes,start,goal) {
  const dist=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),heap=[];
  const heuristic=id=>Math.hypot(nodes[id][0]-nodes[goal][0],nodes[id][1]-nodes[goal][1]);
  function push(v){let i=heap.length;heap.push(v);while(i){const p=(i-1)>>1;if(heap[p][0]<=v[0])break;heap[i]=heap[p];i=p;}heap[i]=v;}
  function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=last[0])break;heap[i]=heap[j];i=j;}heap[i]=last;}return top;}
  dist[start]=0;push([heuristic(start),start,0]);
  while(heap.length){const [,id,d]=pop();if(d!==dist[id])continue;if(id===goal){const path=[id];while(path[0]!==start)path.unshift(prev[path[0]]);return path;}
    for(const [next,len] of nodes[id][2]){const n=d+len;if(n<dist[next]){dist[next]=n;prev[next]=id;push([n+heuristic(next),next,n]);}}
  }
  return null;
}
build().catch(e=>{console.error(e);process.exitCode=1;});
