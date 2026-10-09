const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..');
const G=['G1','G2','G3','G4'].map(g=>({g,d:JSON.parse(fs.readFileSync(path.join(dir,'canon-'+g+'.json'),'utf8'))}));
const errs=[],warns=[];
const E=(m)=>errs.push(m), W=(m)=>warns.push(m);
const heroes=[],enemies=[],battles=[],eras=[];
for(const {g,d} of G){d.heroes.forEach(h=>heroes.push({...h,_g:g}));d.enemies.forEach(x=>enemies.push({...x,_g:g}));d.battles.forEach(b=>battles.push({...b,_g:g}));d.eras.forEach(e=>eras.push({...e,_g:g}));}
const dup=(arr,label)=>{const s={};arr.forEach(o=>{if(s[o.id])E(`${label} trùng ID ${o.id} (${s[o.id]} & ${o._g})`);s[o.id]=o._g;});};
dup(heroes,'hero');dup(enemies,'enemy');dup(battles,'battle');dup(eras,'era');
const pad=n=>String(n).padStart(2,'0');
for(let i=1;i<=56;i++) if(!heroes.find(h=>h.id==='H'+pad(i))) E('thiếu H'+pad(i));
for(let i=1;i<=30;i++) if(!battles.find(b=>b.id==='B'+pad(i))) E('thiếu B'+pad(i));
for(let i=1;i<=35;i++) if(!enemies.find(x=>x.id==='X'+pad(i))) E('thiếu X'+pad(i));
for(let i=1;i<=9;i++) if(!eras.find(e=>e.id==='E'+i)) E('thiếu E'+i);
const H=Object.fromEntries(heroes.map(h=>[h.id,h])),X=Object.fromEntries(enemies.map(x=>[x.id,x])),B=Object.fromEntries(battles.map(b=>[b.id,b]));
const heroEra=[[1,3,'E1'],[4,8,'E2'],[9,13,'E3'],[14,17,'E4'],[18,22,'E5'],[23,26,'E7'],[27,40,'E6'],[41,49,'E8'],[50,56,'E9']];
const battleEra=[[1,2,'E1'],[3,4,'E2'],[5,6,'E3'],[7,8,'E4'],[9,11,'E5'],[12,20,'E6'],[21,22,'E7'],[23,27,'E8'],[28,30,'E9']];
const rng=(id,t)=>{const n=+id.slice(1);return (t.find(([a,b])=>n>=a&&n<=b)||[])[2];};
const tierOf={E1:'U4',E2:'U4',E3:'U4',E4:'U3',E5:'U3',E6:'R1',E7:'U1',E8:'U1',E9:'U2'};
for(const h of heroes){ if(h.era!==rng(h.id,heroEra)) E(`${h.id} era ${h.era} ≠ dải ${rng(h.id,heroEra)}`);
  const exp=tierOf[h.era]; if(h.releaseTier!==exp && !(h.releaseTier==='VS'&&h.era==='E6')) E(`${h.id} releaseTier ${h.releaseTier} ≠ ${exp}`);}
for(const b of battles){ if(b.era!==rng(b.id,battleEra)) E(`${b.id} era ${b.era} ≠ ${rng(b.id,battleEra)}`);
  const exp=tierOf[b.era]; if(b.releaseTier!==exp && !(b.releaseTier==='VS'&&b.era==='E6')) E(`${b.id} releaseTier ${b.releaseTier} ≠ ${exp}`);}
const VSb=battles.filter(b=>b.releaseTier==='VS').map(b=>b.id).sort(); if(VSb.join()!=='B15,B20') E('VS battles = '+VSb);
for(const h of heroes.filter(h=>h.releaseTier==='VS')) if(!['B15','B20'].some(b=>B[b].playable.includes(h.id))) E(`${h.id} VS nhưng không chơi được ở B15/B20`);
for(const b of ['B15','B20']) for(const id of B[b].playable) if(H[id].releaseTier!=='VS' && !/Trong VS chỉ là đồng minh AI/.test(H[id].unlock||'')) E(`${id} chơi được ở ${b} (VS) nhưng releaseTier=${H[id].releaseTier}`);
const exr=[[1,8,'G1'],[9,15,'G2'],[16,25,'G3'],[26,35,'G4']];
for(const x of enemies){ if(x._g!==rng(x.id,exr)) E(`${x.id} định nghĩa ở ${x._g} sai dải`);}
if(!X.X13||!/Mộc Thạnh/.test(X.X13.name)) E('X13 không phải Mộc Thạnh');
const chkH=(id,ctx)=>{if(!H[id])E(`${ctx}: hero ${id} không tồn tại`);};
const chkX=(id,ctx)=>{if(!X[id])E(`${ctx}: enemy ${id} không tồn tại`);};
const chkB=(id,ctx)=>{if(!B[id])E(`${ctx}: battle ${id} không tồn tại`);};
for(const b of battles){ (b.playable||[]).forEach(i=>chkH(i,b.id+'.playable'));(b.allies||[]).forEach(i=>chkH(i,b.id+'.allies'));(b.enemies||[]).forEach(i=>chkX(i,b.id+'.enemies'));
  if(!b.playable||!b.playable.length) E(b.id+' không có tướng chơi được');
  if(b.boss&&b.boss.enemy){chkX(b.boss.enemy,b.id+'.boss'); if(!b.enemies.includes(b.boss.enemy)) E(`${b.id}: boss ${b.boss.enemy} không nằm trong enemies`);}
  for(const i of [...b.playable,...(b.allies||[])]) if(H[i]&&!(H[i].battlesPresent||[]).includes(b.id)) E(`${b.id} có ${i} nhưng ${i}.battlesPresent thiếu ${b.id}`);
  for(const i of b.enemies) if(X[i]&&!(X[i].appearsIn||[]).includes(b.id)) E(`${b.id} có ${i} nhưng ${i}.appearsIn thiếu ${b.id}`);
  if(b.allies&&b.playable.some(p=>b.allies.includes(p))) W(`${b.id}: allies chứa cả tướng playable (quy ước G3)`);
}
for(const h of heroes){ (h.battlesPresent||[]).forEach(i=>{chkB(i,h.id+'.battlesPresent'); if(B[i]&&![...B[i].playable,...(B[i].allies||[])].includes(h.id)) E(`${h.id}.battlesPresent có ${i} nhưng ${i} không liệt kê ${h.id}`);});
  const d=h.debut||''; const m=d.match(/B\d\d/g)||[]; m.forEach(i=>chkB(i,h.id+'.debut'));
  if(!(h.battlesPresent||[]).length && !/^Chronicle/.test(d)) E(`${h.id} không có mặt trận nào nhưng debut='${d}'`);
  if((h.battlesPresent||[]).length && /^Chronicle/.test(d)) W(`${h.id} có battlesPresent ${h.battlesPresent} nhưng debut Chronicle`);
  if(m.length){ const playableIn=battles.filter(b=>b.playable.includes(h.id)).map(b=>b.id); if(!m.some(x=>playableIn.includes(x))) W(`${h.id} debut ${d} nhưng chơi được ở ${playableIn}`);
    const first=[...(h.battlesPresent||[])].sort()[0]; if(first&&m[0]!==first) W(`${h.id} debut ${d} nhưng có mặt sớm nhất ở ${first} (battlesPresent ${h.battlesPresent})`);}
  if(!battles.some(b=>b.playable.includes(h.id)) && !/^Chronicle/.test(d)) W(`${h.id} không chơi được ở trận nào, debut '${d}'`);
}
for(const x of enemies){ (x.appearsIn||[]).forEach(i=>{chkB(i,x.id+'.appearsIn'); if(B[i]&&!B[i].enemies.includes(x.id)) E(`${x.id}.appearsIn có ${i} nhưng ${i}.enemies thiếu`);});
  if(!battles.some(b=>b.enemies.includes(x.id))) E(`${x.id} không xuất hiện ở trận nào`);}
const b15=B.B15,b20=B.B20;
if(!/Hàm Tử/.test(b15.name)||!/1285/.test(b15.date)) E('B15 không phải Hàm Tử 1285');
if(!b15.playable.includes('H35')) E('B15 thiếu H35 playable');
if(!/Bạch Đằng/.test(b20.name)||!/1288/.test(b20.date)) E('B20 không phải Bạch Đằng 1288');
['H31','H34','H38'].forEach(i=>{if(!b20.playable.includes(i))E('B20 thiếu playable '+i);});
if([...b20.playable,...b20.allies].includes('H35')||H.H35.battlesPresent.includes('B20')) E('H35 có mặt ở B20');
if(!/Đông Bộ Đầu/.test(B.B13.name)) E('B13 không phải Đông Bộ Đầu');
const names={};
const addN=(n,who)=>{if(!n)return;const k=n.trim().toLowerCase();(names[k]=names[k]||[]).push(who);};
for(const h of heroes){(h.skills||[]).forEach((s,i)=>addN(s.name,h.id+'.skill'+i));addN(h.tuyetKy&&h.tuyetKy.name,h.id+'.tuyetKy');addN(h.commandTrait&&h.commandTrait.name,h.id+'.trait');}
for(const [k,v] of Object.entries(names)) if(v.length>1) E(`tên trùng "${k}": ${v.join(', ')}`);
const txt=JSON.stringify(G.map(x=>x.d));
for(const bad of ['Musou','musou','MUSOU','Dynasty Warriors','giặc Tàu','quân Tàu','Vô Song']) if(txt.includes(bad)) E('từ cấm/lệch: '+bad);
const tiers=['Đội trưởng','Phó tướng','Tướng','Đại tướng','Chủ soái'];
for(const x of enemies) if(!tiers.includes(x.bossTier)) E(`${x.id} bossTier '${x.bossTier}' ngoài bậc chuẩn`);
const WC={};for(const h of heroes){(WC[h.weaponClass]=WC[h.weaponClass]||[]).push(h.id); if(!/^WC(0[1-9]|1[0-6])$/.test(h.weaponClass)) E(h.id+' weaponClass lạ '+h.weaponClass);}
for(const x of enemies) if(!/^(WC(0[1-9]|1[0-6])|EWC0[1-6])$/.test(x.weaponClass)) E(x.id+' weaponClass lạ '+x.weaponClass);
const out={wc:Object.fromEntries(Object.entries(WC).sort()),counts:{heroes:heroes.length,enemies:enemies.length,battles:battles.length,eras:eras.length}};
console.log(JSON.stringify(out,null,1));

// ===== Kiểm theo quyết định L1–L14 của thiết kế chính (thêm 29/09/2026) =====
{
const L=[];const EL=m=>{L.push(m);errs.push('[L] '+m);};
const walkS=(o,p,cb)=>{if(typeof o==='string')cb(p,o);else if(Array.isArray(o))o.forEach((x,i)=>walkS(x,p+'['+i+']',cb));else if(o&&typeof o==='object')for(const k in o)walkS(o[k],p+'.'+k,cb);};
// L5 Kế Sách
for(const b of battles){let lon=0;for(const k of b.keSach||[]){
  if(!['lon','nho'].includes(k.quyMo))EL(`${b.id} Kế Sách '${k.name}' thiếu quyMo`);
  const cap=k.quyMo==='lon'?20:10; if(k.haoKhiMax!==cap)EL(`${b.id} '${k.name}' haoKhiMax ${k.haoKhiMax} ≠ ${cap}`);
  const tag=k.quyMo==='lon'?'(Lớn)':'(Nhỏ)'; if(!k.name.endsWith(tag))EL(`${b.id} '${k.name}' tên không khớp quy mô`);
  const p=k.payoff||''; if(!(p.startsWith('+'+cap+' Hào Khí')||(/^\+\d+ Hào Khí/.test(p)&&new RegExp('tối đa [+]'+cap+'(?![0-9])').test(p))))EL(`${b.id} '${k.name}' payoff ngoài khung +10/+20: ${p.slice(0,60)}`);
  if(/hồi chiêu|cooldown/i.test(JSON.stringify(k)))EL(`${b.id} '${k.name}' Kế Sách có hồi chiêu`);
  if(k.quyMo==='lon')lon++;}
 if(!lon)EL(`${b.id} không có Kế Sách Lớn`); if(lon>1&&b.id!=='B20')EL(`${b.id} có ${lon} Kế Sách Lớn (chỉ B20 được ngoại lệ)`);}
// L6 Tuyệt Kỹ
const tierKey=h=>h.releaseTier==='VS'?'R1':h.releaseTier;const bes={};const mw={};
for(const h of heroes){const t=h.tuyetKy;
  if(!['template-2-3s','bespoke-≤6s'].includes(t.cinematicTemplate))EL(`${h.id} cinematicTemplate lạ ${t.cinematicTemplate}`);
  if(t.cinematicTemplate==='bespoke-≤6s')(bes[tierKey(h)]=bes[tierKey(h)]||[]).push(h.id);
  else if(!['xoáy quanh tướng','hạ góc thấp','lướt theo đòn','toàn cảnh chiến trường'].includes(t.cinematicCamera))EL(`${h.id} cinematicCamera lạ`);
  if(!['toàn bản đồ','cục bộ'].includes(t.scope))EL(`${h.id} tuyetKy.scope lạ`); if(t.scope==='toàn bản đồ')(mw[h.era]=mw[h.era]||[]).push(h.id);
  if(/\+\d+ Hào Khí|Hào Khí \+\d/.test(t.effect))EL(`${h.id} Tuyệt Kỹ cộng Hào Khí`);}
for(const [k,v] of Object.entries(bes))if(v.length>(k==='R1'?3:2))EL(`đợt ${k} có ${v.length} cinematic riêng: ${v}`);
for(const [k,v] of Object.entries(mw))if(v.length>2)EL(`${k} có ${v.length} Tuyệt Kỹ toàn bản đồ: ${v}`);
// L7 Tổng Phản Công
for(const b of battles){const t=b.tongPhanCong;if(!t)EL(b.id+' thiếu tongPhanCong');else{if(t.durationSec<20||t.durationSec>30)EL(`${b.id} TPC ${t.durationSec}s ngoài 20–30`);if(t.maxExtensionSec>10)EL(b.id+' TPC kéo dài >10s');}}
for(const {g,d} of G)walkS({h:d.heroes,b:d.battles},g,(p,s)=>{for(const m of s.match(/Tổng Phản Công[^.;]{0,40}kéo dài thêm \d+ giây/g)||[]){const n=+m.match(/(\d+) giây/)[1];if(n>10)EL(`${p}: TPC kéo dài ${n}s`);if(!/trần kéo dài chung/.test(s))EL(`${p}: kéo dài TPC chưa ghi trần chung`);}});
// L8 Sĩ Khí điểm + chỉ số
for(const {g,d} of G)walkS({h:d.heroes,x:d.enemies,b:d.battles},g,(p,s)=>{if(/\d+ ?% Sĩ Khí/.test(s))EL(`${p}: còn '% Sĩ Khí'`);if(/Sĩ Khí [^.;,()%]{0,25}?[+\-−]?\d+ ?%(?! ?(tốc|chính xác|thủ))/.test(s)&&!/nhân tương đối/.test(s))EL(`${p}: Sĩ Khí dạng % chưa ghi rõ`);});
for(const h of heroes){const s=Object.values(h.stats).reduce((a,b)=>a+b,0);if(s<15||s>19)EL(`${h.id} tổng chỉ số ${s} ngoài 15–19`);}
// L9 nhãn
for(const h of heroes)if(!['Chính sử','Tương truyền','Hư cấu','Hỗn hợp'].includes(h.historicity))EL(h.id+' historicity lạ');
for(const x of enemies)if(!['Chính sử','Tương truyền','Hư cấu'].includes(x.historicity))EL(x.id+' historicity lạ');
for(const {g,d} of G)walkS({h:d.heroes,x:d.enemies,b:d.battles},g,(p,s)=>{if(/basis$/.test(p)){if(!/Chính sử|Tương truyền|Hư cấu/.test(s))EL(p+' basis không có nhãn');if(/Hỗn hợp|Chính sử\/khảo cổ/.test(s))EL(p+' basis dùng nhãn ngoài 3 nhãn');}});
// L10
if(H.H03.historicity!=='Tương truyền'||H.H03.legendFrame!=='Huyền sử'||(H.H03.battlesPresent||[]).length)EL('H03 chưa đúng khung Huyền sử');
if(!/Dịch Hu Tống/.test(B.B01.mapNotes))EL('B01 mapNotes thiếu NPC Dịch Hu Tống');
// L11 chronicleMissions + reserveHeroes
const CM=G.flatMap(({d})=>d.chronicleMissions||[]);const cids=new Set();
for(const c of CM){if(cids.has(c.id))EL('trùng '+c.id);cids.add(c.id);['id','title','heroes','era','mapReuse','premise','releaseTier'].forEach(k=>{if(c[k]==null)EL(c.id+' thiếu '+k);});
  c.heroes.forEach(i=>{if(!H[i])EL(c.id+' hero lạ '+i);else if(!new RegExp('Chronicle '+c.id+'(?![0-9])').test(H[i].debut))EL(`${i} debut '${H[i].debut}' không trỏ ${c.id}`);});
  if(!B[c.mapReuse])EL(c.id+' mapReuse lạ');if((c.premise.match(/[.!?](\s|$)/g)||[]).length!==2)EL(c.id+' premise không đúng 2 câu');}
for(let i=1;i<=6;i++)if(!cids.has('C0'+i))EL('thiếu C0'+i);
for(const h of heroes)if(!(h.battlesPresent||[]).length&&!CM.some(c=>c.heroes.includes(h.id)))EL(h.id+' chỉ ở Chronicle nhưng không có chronicleMission');
const RH=G.flatMap(({d})=>d.reserveHeroes||[]);['Trần Thánh Tông','Đỗ Hành','Chiêu Văn'].forEach(n=>{if(!RH.some(r=>r.name===n))EL('reserveHeroes thiếu '+n);});
// L12
for(const b of battles)if(b.boss&&!['bị giết','bị bắt','rút chạy','tạm lui','giảng hòa','tử thủ'].includes(b.boss.defeatMeans))EL(`${b.id} defeatMeans '${b.boss.defeatMeans}'`);
// L13
const v=B.B15.variants;if(!v||JSON.stringify(v.VS.playable)!=='["H35"]'||!v.VS.allies.includes('H33')||JSON.stringify(v.R1.playable)!=='["H35","H33"]')EL('B15.variants sai');
// L3 lớp vũ khí R1/VS
const r1wc=[...new Set(heroes.filter(h=>h.era==='E6').map(h=>h.weaponClass))].sort().join();if(r1wc!=='WC01,WC02,WC03,WC04,WC09,WC12,WC14,WC16')EL('lớp R1 = '+r1wc);
const vswc=[...new Set(heroes.filter(h=>h.releaseTier==='VS').map(h=>h.weaponClass))].sort().join();if(vswc!=='WC01,WC03,WC14')EL('lớp VS = '+vswc);
const xr1=[...new Set(enemies.filter(x=>x.era==='E6').map(x=>x.weaponClass))].sort().join();if(xr1!=='EWC01,EWC02,EWC04')EL('lớp địch R1 = '+xr1);
// kiểm chứng web
if(B.B22.playable.includes('H25'))EL('H25 còn ở B22');if(B.B28.playable.some(i=>['H52','H54'].includes(i)))EL('H52/H54 còn ở B28');
if(B.B21.name!=='Phòng tuyến Đa Bang')EL('B21 chưa đổi tên');if(B.B20.keSach.some(k=>/Bè lửa/.test(k.name)))EL('B20 còn Bè lửa');
console.log('Kiểm L1–L14:',L.length,'lỗi');
}
// ===== Kiểm hướng comic + Quiz (systems v1.2 §12.6, thêm 29/09/2026) =====
{
const C=[];const EC=m=>{C.push(m);errs.push('[C] '+m);};
const walkS=(o,p,cb)=>{if(typeof o==='string')cb(p,o);else if(Array.isArray(o))o.forEach((x,i)=>walkS(x,p+'['+i+']',cb));else if(o&&typeof o==='object')for(const k in o)walkS(o[k],p+'.'+k,cb);};
// cảnh cốt truyện đã chuyển sang comic: không còn tranh động 2.5D / cutscene / codex
for(const {g,d} of G)walkS(d,g,(p,s)=>{if(/2[.,]5D|tranh động|tranh sơn mài chuyển động|tranh vẽ tĩnh|tranh 2D|cutscene|codex/i.test(s))EC(`${p}: còn cách gọi cảnh cốt truyện cũ`);
  if(/Sử Ký/.test(s))EC(`${p}: 'Sử Ký' là tên chế độ chiến dịch; kho thẻ là 'Sử quán'`);
  if(/cinematic/i.test(s)&&!/tuyetKy\.cinematic$|conventions|designRules/.test(p)&&!/Tuyệt Kỹ|cinematic dùng chung|không làm cinematic/.test(s))EC(`${p}: 'cinematic' ngoài Tuyệt Kỹ (cảnh cốt truyện là comic)`);});
// chapter
const byQ={};
for(const b of battles){const c=b.chapter;if(!c){EC(b.id+' thiếu chapter');continue;}
  if(c.quyen!==b.era)EC(`${b.id} chapter.quyen ${c.quyen} ≠ era ${b.era}`);
  if(!Number.isInteger(c.chuong)||c.chuong<1)EC(`${b.id} chapter.chuong lạ`);(byQ[c.quyen]=byQ[c.quyen]||[]).push(c.chuong);
  const q=c.quyetSach;if(!q){EC(b.id+' thiếu quyetSach');continue;}
  const names=b.keSach.map(k=>k.name);
  if(!names.includes(q.lichSu))EC(`${b.id} quyetSach.lichSu '${q.lichSu}' không có trong keSach`);
  else if(!/\(Lớn\)$/.test(q.lichSu))EC(`${b.id} quyetSach.lichSu không phải Kế Sách Lớn`);
  if(!Array.isArray(q.khac)||q.khac.length!==2||q.khac.some(x=>typeof x!=='string'||!x.trim()||x.length>80))EC(`${b.id} quyetSach.khac phải là 2 chuỗi ngắn (≤ 80 ký tự)`);
  if(Array.isArray(q.khac)&&q.khac.length===2&&new Set([q.lichSu,...q.khac].map(s=>s.toLowerCase())).size!==3)EC(`${b.id} quyetSach trùng lựa chọn`);
  if(q.danhDau){if(!q.danhDau.includes(q.lichSu))EC(`${b.id} danhDau thiếu lichSu`);q.danhDau.forEach(n=>{if(!names.includes(n))EC(`${b.id} danhDau '${n}' không có trong keSach`);});}
  if(q.mien)q.mien.forEach(m=>{if(!['lanDau','VS'].includes(m))EC(`${b.id} mien lạ '${m}'`);});
  const extra=Object.keys(q).filter(k=>!['lichSu','khac','danhDau','mien'].includes(k));if(extra.length)EC(`${b.id} quyetSach có trường lạ ${extra}`);
  if(JSON.stringify(q).match(/Hào Khí|\+\d/))EC(`${b.id} quyetSach nhắc thưởng (Quyết sách không đổi khung Hào Khí)`);}
for(const [q,arr] of Object.entries(byQ)){const s=[...arr].sort((a,b)=>a-b);if(s.some((v,i)=>v!==i+1))EC(`Quyển ${q}: số chương ${s} không liên tục 1..n`);}
const mien=battles.filter(b=>b.chapter&&b.chapter.quyetSach&&b.chapter.quyetSach.mien).map(b=>b.id+':'+b.chapter.quyetSach.mien).sort().join();
if(mien!=='B12:lanDau,B13:lanDau,B15:VS')EC('mien Quyết sách = '+mien+' (chuẩn: B12, B13 lần đầu; B15 bản VS)');
// cờ sáu chữ H35: một nhãn Chính sử
if(!/Chính sử/.test(H.H35.quote.basis))EC('H35 cờ sáu chữ phải mang nhãn Chính sử (Toàn thư)');
console.log('Kiểm comic/Quyết sách:',C.length,'lỗi');
}
console.log(JSON.stringify({errs,warns},null,1));console.log('TỔNG errs =',errs.length,'warns =',warns.length);
