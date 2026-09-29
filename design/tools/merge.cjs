// Gộp canon-G1..G4 → canon.json + canon-summary.md
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..');
const G=['G1','G2','G3','G4'];
const D=Object.fromEntries(G.map(g=>[g,JSON.parse(fs.readFileSync(path.join(dir,'canon-'+g+'.json'),'utf8'))]));
const byId=(a,b)=>{const n=x=>[x.id[0],parseInt(x.id.slice(1).replace(/\D/g,''),10)];const [pa,na]=n(a),[pb,nb]=n(b);return pa<pb?-1:pa>pb?1:na-nb;};
const eras=[],heroes=[],enemies=[],battles=[],sources=[],openQuestions=[],conventions=[],chronicleMissions=[],reserveHeroes=[];
for(const g of G){const d=D[g];
  d.eras.forEach(e=>eras.push({...e,sourceGroup:g}));
  d.heroes.forEach(h=>heroes.push({...h,sourceGroup:g}));
  d.enemies.forEach(x=>enemies.push({...x,sourceGroup:g}));
  d.battles.forEach(b=>battles.push({...b,sourceGroup:g}));
  (d.openQuestions||[]).forEach(q=>openQuestions.push(`[${g}] ${q}`));
  (d.conventions||[]).forEach(c=>conventions.push(`[${g}] ${c}`));
  (d.designRules||[]).forEach(c=>conventions.push(`[${g}] ${c}`));
  (d.sources||[]).forEach(s=>sources.push({...s,group:g}));
  (d.chronicleMissions||[]).forEach(c=>chronicleMissions.push({...c,sourceGroup:g}));
  (d.reserveHeroes||[]).forEach(r=>reserveHeroes.push({...r,sourceGroup:g}));
}
[eras,heroes,enemies,battles,chronicleMissions].forEach(a=>a.sort(byId));
const B=Object.fromEntries(battles.map(b=>[b.id,b]));
// firstPlayable: trận đầu tiên (theo ID thời gian) mà tướng có trong playable
for(const h of heroes){const p=battles.filter(b=>b.playable.includes(h.id)).map(b=>b.id);h.firstPlayable=p[0]||null;h.playableIn=p;}
// sources: gộp, bỏ trùng theo URL chuẩn hóa
const normUrl=u=>{try{u=decodeURI(u);}catch(e){} return u.trim().replace(/^http:/,'https:').replace(/#.*$/,'').replace(/\/+$/,'').replace(/^https:\/\/([^/]+)/,(m,h)=>'https://'+h.toLowerCase()).replace(/ /g,'_');};
const srcMap=new Map();
for(const s of sources){const k=normUrl(s.url||s.title);if(!srcMap.has(k))srcMap.set(k,{title:s.title,url:s.url,groups:[s.group]});else{const o=srcMap.get(k);if(!o.groups.includes(s.group))o.groups.push(s.group);}}
const mergedSources=[...srcMap.values()].sort((a,b)=>a.url.localeCompare(b.url));
// Quy ước chung do bước hợp nhất thêm
const mergeConventions=[
 "[Hợp nhất] allies = chỉ tướng đồng minh AI không chơi được ở trận đó; tướng trong playable mà người chơi không chọn tự động thành đồng minh AI. Riêng B15 có trường variants (VS/R1) là nguồn đúng cho build (L13).",
 "[Hợp nhất] debut giữ nguyên chữ của từng nhóm (G1/G4: trận có mặt đầu tiên; G3: trận chơi được đầu tiên, kèm ghi chú VS); tướng chỉ ở Chronicle ghi 'Chronicle Cxx: …' trỏ vào mảng chronicleMissions. Trường firstPlayable/playableIn do máy tính từ playable là nguồn đúng cho mở khóa.",
 "[Hợp nhất] Hào Khí ghi bằng điểm (thang 0–100), không ghi %. Sĩ Khí ghi bằng điểm (thang 0–100); chỗ nào là hệ số nhân tương đối thì ghi rõ '(nhân tương đối)' (L8).",
 "[Hợp nhất] Sinh lực là thanh máu của tướng/lính; công trình và thuyền dùng 'độ bền'. Viết hoa thuật ngữ: Khí Lực, Tuyệt Kỹ, Hào Khí, Tổng Phản Công, Sĩ Khí, Kế Sách, Mệnh Lệnh, Cứ Điểm.",
 "[Thiết kế chính L5] Mọi Kế Sách có quyMo 'lon'/'nho' (tên kèm '(Lớn)'/'(Nhỏ)') và haoKhiMax 20/10. payoff mở đầu bằng '+20 Hào Khí'/'+10 Hào Khí', hoặc thưởng lẻ '+n Hào Khí mỗi …' cộng dồn không vượt mức quy mô. Mỗi trận 1 Kế Sách Lớn (ngoại lệ B20 có 3 Lớn theo systems §7). Kế Sách không có hồi chiêu; kỹ năng/commandTrait chỉ tăng hiệu quả (cửa sổ, hiệu ứng mô phỏng), không cộng Hào Khí ngoài khung.",
 "[Thiết kế chính L6] Tuyệt Kỹ không cộng Hào Khí. tuyetKy.cinematicTemplate = 'template-2-3s' (kèm cinematicCamera: xoáy quanh tướng / hạ góc thấp / lướt theo đòn / toàn cảnh chiến trường) hoặc 'bespoke-≤6s'. R1: 3 bespoke (H31, H35, H38 — phủ đủ 3 lớp P0 của VS); U1: H41, H43; U2: H50; U3: H18, H15; U4: H01, H04. tuyetKy.scope 'toàn bản đồ' tối đa 2 mỗi thời đại.",
 "[Thiết kế chính L7] battle.tongPhanCong = {variant, durationSec 20–30 (chuẩn 25), maxExtensionSec 10}. Mọi nguồn kéo dài (Hào Khí dư, H10, H51, Kế Sách B10, B22 — mỗi nguồn +5 s) cộng chung không quá +10 s.",
 "[Thiết kế chính L1 + v1.2] Cảnh cốt truyện giữa các trận là comic (khung tĩnh + chuyển động nhẹ; mở/kết chương, mở/kết Quyển, Chronicle), kể cả mở B15 và kết B20 — thay hẳn tranh sơn mài chuyển động 2.5D. Nhịp truyện giữa trận: khung comic chèn (≤ 2 mỗi trận, dừng đồng hồ trận) hoặc cảnh ngắn trong engine; cảnh kết trận trong engine ≤ 10 s. Không animation khuôn mặt; hội thoại trong trận dùng chân dung 2D vẽ tay. 3 cinematic 3D riêng của R1 chỉ dành cho Tuyệt Kỹ H31, H35, H38.",
 "[v1.2 §12.6] battle.chapter = {quyen: ID thời đại (Quyển I–IX), chuong: thứ tự chơi trong Quyển (E5: B09 → B11 → B10), quyetSach: {lichSu: tên Kế Sách Lớn chính, khac: 2 kế khác (Hư cấu), danhDau?: Kế Sách được đánh dấu Kế đã định khi chọn đúng (B20: 3 Lớn; B26: Cầu gãy + Thua giả), mien?: 'lanDau' (B12, B13 lần chơi đầu) | 'VS' (B15 bản VS)}}. Quyết sách không đổi trận, Kế Sách, khung Hào Khí +10/+20 hay xếp hạng.",
 "[v1.2] Thuật ngữ: Sử Ký = chế độ chiến dịch chính (GDD mục 13.2); kho thẻ sử liệu = Sử quán. 13 chỗ canon dùng 'Sử Ký' nghĩa kho thẻ đã đổi thành 'thẻ Sử quán'; 'Sử ký' (Tư Mã Thiên) và 'Đại Việt sử ký toàn thư' giữ nguyên.",
 "[Thiết kế chính L4] Hướng dẫn: R1 dạy ở B12 (di chuyển, chiến đấu, Mệnh Lệnh) và B13 (Kế Sách, Hào Khí, Tổng Phản Công); VS dạy toàn bộ ở B15 biến thể VS. Trường battle.tutorial ghi nội dung dạy.",
 "[Thiết kế chính L12] boss.defeatMeans ∈ {bị giết, bị bắt, rút chạy, tạm lui, giảng hòa, tử thủ}; mô tả dài ở boss.defeatNote.",
 "[Thiết kế chính L3] VS dùng 3 lớp P0 (WC01, WC03, WC14); R1 dùng 8 lớp (thêm P1: WC02, WC04, WC09, WC12, WC16); lớp địch R1: EWC01, EWC02, EWC04."
];
const extraQ=[
 "[Hợp nhất] Quy ước 'số lính hiển thị = số mô phỏng × tỉ lệ theo cài đặt (Thấp 20%… Cực đại 100%), tối thiểu 6 hình nhân' của G3 chưa có trong systems §13.1 và phải khớp trần hiển thị đã chốt (Thấp 100 · Vừa 200 · Cao 400 · Rất cao 800 · Cực đại 1.500 · Tùy chỉnh 50–2.500) cùng luật vùng chiến đấu r 25 m (luôn 30 địch, tối đa 20 quân ta). Cần đưa vào systems.",
 "[Hợp nhất] systems.md cần cập nhật theo các quyết định đã áp vào canon: §4.4 (8 lớp R1 và thứ tự P0–P4 theo L3), §6.4 (trần kéo dài TPC +10 s mọi nguồn, biến thể 20–30 s theo L7), §7 (quyMo/haoKhiMax), §12 (hướng dẫn ở B12/B13 cho R1, B15 cho VS theo L4), §13 (animation lính nướng theo xương, VAT theo đỉnh chỉ cho vật không xương theo L2; ngân sách tam giác low poly theo L1).",
 "[Hợp nhất] Engine: Unity 6 LTS (URP) là khuyến nghị; web (three.js/Babylon.js) là phương án thay thế — đang CHỜ người dùng chọn (L14).",
 "[Hợp nhất] GDD mục 22.2 tính ~87 thẻ Quyết sách = 29 Chương × 3, nhưng canon có quyetSach cho cả 30 trận (B12, B13 chỉ miễn ở lần chơi đầu; B15 miễn ở bản VS). Cần chốt: B12 (trận thua hướng dẫn) có Quyết sách khi chơi lại không; nếu không, thêm mien 'luon' cho B12 và giữ con số 29.",
 "[Hợp nhất] Thứ tự Chương Quyển V theo GDD 22.1 là B09 → B11 → B10 (chapter.chuong B11 = 2, B10 = 3); E5.campaignArc cho hai nhánh B10/B11 chạy song song. Cần xác nhận thứ tự hiển thị 'Chương n/3' khi người chơi đánh B10 trước.",
 "[Hợp nhất] B20 còn 3 Kế Sách Lớn (Nghi binh, Cọc, Con nước) theo systems §7, ngoại lệ duy nhất với luật '1 Lớn mỗi trận'. Cần xác nhận giữ ngoại lệ hay hạ Nghi binh xuống Nhỏ."
];
const canon={
  meta:{title:'Hào Khí Việt — canon hợp nhất',builtFrom:G.map(g=>'canon-'+g+'.json'),systems:'systems.md v1.2',counts:{eras:eras.length,heroes:heroes.length,enemies:enemies.length,battles:battles.length,chronicleMissions:chronicleMissions.length,reserveHeroes:reserveHeroes.length,sources:mergedSources.length},decisions:'L1–L14 của thiết kế chính + hướng comic/Quiz (systems v1.2 §12.6) đã áp (29/09/2026)'},
  eras,heroes,enemies,battles,sources:mergedSources,chronicleMissions,reserveHeroes,openQuestions:[...openQuestions,...extraQ],conventions:[...mergeConventions,...conventions]
};
fs.writeFileSync(path.join(dir,'canon.json'),JSON.stringify(canon,null,2)+'\n','utf8');

// ---------- Summary ----------
const H=Object.fromEntries(heroes.map(h=>[h.id,h])),X=Object.fromEntries(enemies.map(x=>[x.id,x])),E=Object.fromEntries(eras.map(e=>[e.id,e]));
const esc=s=>String(s??'').replace(/\|/g,'/').replace(/\n/g,' ');
const WCN={WC01:'Đại kiếm',WC02:'Kiếm & khiên mây',WC03:'Song đao',WC04:'Thương/giáo',WC05:'Trường đao',WC06:'Côn',WC07:'Rìu đồng/búa',WC08:'Nỏ',WC09:'Cung',WC10:'Roi & xích',WC11:'Cờ lệnh',WC12:'Quạt & bút',WC13:'Hỏa khí',WC14:'Đoản đao & lặn',WC15:'Trống đồng',WC16:'Voi chiến',EWC01:'Cung kỵ',EWC02:'Kích/đại phủ',EWC03:'Chùy',EWC04:'Mã tấu kỵ',EWC05:'Hỏa pháo',EWC06:'Voi chiến địch'};
const SYSP={WC01:'P0 – VS',WC03:'P0 – VS',WC14:'P0 – VS',WC02:'P1 – R1',WC04:'P1 – R1',WC09:'P1 – R1',WC12:'P1 – R1',WC16:'P1 – R1',WC06:'P2 – U1',WC07:'P2 – U1',WC08:'P2 – U1',WC13:'P2 – U1',WC15:'P2 – U1',WC05:'P3 – U2',WC11:'P3 – U2',WC10:'P4 – U4'};
const TORDER=['VS','R1','U1','U2','U3','U4'];
const L=[];
L.push('# Hào Khí Việt — Tóm tắt canon hợp nhất','');
L.push(`Nguồn: canon-G1…G4.json đã qua bước kiểm tra nhất quán, đối chiếu systems.md v1.2, đã áp quyết định L1–L14 của thiết kế chính và hướng comic/Quiz (§12.6) (29/09/2026). Số lượng: ${eras.length} thời đại · ${heroes.length} tướng Việt chơi được · ${enemies.length} tướng địch · ${battles.length} trận · ${chronicleMissions.length} màn Chronicle chính thức · ${reserveHeroes.length} tướng dự bị · ${mergedSources.length} nguồn đã mở (sau khi bỏ trùng).`,'');
L.push('Đợt phát hành: VS ⊂ R1 (E6) · U1 = E7 + E8 · U2 = E9 · U3 = E5 + E4 · U4 = E1 + E2 + E3.','');
L.push('## (a) Tướng chơi được','');
L.push('Σ = tổng 5 chỉ số (L8: 15–19). Cinematic: T = template 2–3 s (mẫu camera), R = 3D riêng ≤ 6 s. Phạm vi: ◎ = Tuyệt Kỹ toàn bản đồ (≤ 2 mỗi thời đại).','');
L.push('| ID | Tên | Nhãn | Thời đại | Lớp vũ khí | Archetype | Σ | Tuyệt Kỹ | Cinematic | Debut | Chơi được lần đầu | Đợt |','|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const h of heroes){const sum=Object.values(h.stats).reduce((a,b)=>a+b,0);const tk=h.tuyetKy;L.push(`| ${h.id} | ${esc(h.name)} | ${h.historicity}${h.legendFrame?' ('+h.legendFrame+')':''} | ${h.era} | ${h.weaponClass} ${WCN[h.weaponClass]} | ${esc(h.archetype)} | ${sum} | ${esc(tk.name)}${tk.scope==='toàn bản đồ'?' ◎':''} | ${tk.cinematicTemplate==='bespoke-≤6s'?'R':'T – '+tk.cinematicCamera} | ${esc(h.debut)} | ${h.firstPlayable||'—'} | ${h.releaseTier} |`);}
L.push('','## (b) Trận','');
L.push('Kế Sách: L = Lớn (+20), N = Nhỏ (+10). TPC = biến thể Tổng Phản Công và thời lượng. Q·C = Quyển · Chương (thứ tự chơi trong Quyển). Quyết sách (§12.6): ★ = cách người xưa (Kế Sách chính, được đánh dấu Kế đã định khi chọn đúng; + các Kế Sách đánh dấu thêm), hai kế sau là lựa chọn khác (Hư cấu); không đổi khung Hào Khí. "Miễn" = Chương không có Quyết sách ở lần đó.','');
L.push('| ID | Tên | Ngày | Thời đại | Q·C | Tướng chơi được | Boss (cách hạ) | Kế Sách | Quyết sách | TPC | Đợt |','|---|---|---|---|---|---|---|---|---|---|---|');
const ROMAN={E1:'I',E2:'II',E3:'III',E4:'IV',E5:'V',E6:'VI',E7:'VII',E8:'VIII',E9:'IX'};
const MIEN={lanDau:'lần chơi đầu',VS:'bản VS'};
for(const b of battles){const ks=(b.keSach.find(k=>/\(Lớn\)/.test(k.name))||b.keSach[0]||{}).name||'—';
  const boss=b.boss&&b.boss.enemy?`${b.boss.enemy} ${X[b.boss.enemy]?X[b.boss.enemy].name:''} (${esc(b.boss.defeatMeans)})`:'—';
  const kss=b.keSach.map(k=>(k.quyMo==='lon'?'L: ':'N: ')+k.name.replace(/ \((Lớn|Nhỏ)\)$/,'')).join('; ');
  const pl=b.variants?Object.entries(b.variants).map(([k,v])=>k+': '+v.playable.map(i=>i+' '+H[i].name).join(', ')+(v.allies?' (AI: '+v.allies.join(', ')+')':'')).join(' · '):b.playable.map(i=>i+' '+H[i].name).join(', ');
  const qs=b.chapter.quyetSach;const strip=n=>n.replace(/ \((Lớn|Nhỏ)\)$/,'');
  const qsTxt='★ '+strip(qs.lichSu)+((qs.danhDau||[]).filter(n=>n!==qs.lichSu).length?' (+ '+qs.danhDau.filter(n=>n!==qs.lichSu).map(strip).join(', ')+')':'')+' · '+qs.khac.join(' · ')+(qs.mien?' · Miễn: '+qs.mien.map(m=>MIEN[m]).join(', '):'');
  L.push(`| ${b.id} | ${esc(b.name)} | ${esc(b.date)} | ${b.era} | ${ROMAN[b.chapter.quyen]}·${b.chapter.chuong} | ${esc(pl)} | ${esc(boss)} | ${esc(kss)} | ${esc(qsTxt)} | ${esc(b.tongPhanCong.variant)} ${b.tongPhanCong.durationSec} s | ${b.releaseTier} |`);}
L.push('','## (c) Tướng địch','');
L.push('| ID | Tên | Tên gốc | Phe | Bậc | Lớp | Xuất hiện |','|---|---|---|---|---|---|---|');
for(const x of enemies) L.push(`| ${x.id} | ${esc(x.name)} | ${esc(x.original)} | ${esc(x.faction)} | ${esc(x.bossTier)} | ${x.weaponClass} | ${(x.appearsIn||[]).join(', ')} |`);
L.push('','## (d) Phân bổ lớp vũ khí','');
L.push('Trần mỗi lớp: tối thiểu 1, tối đa 7 tướng. "Đợt cần đầu tiên" = đợt sớm nhất có tướng dùng lớp đó (VS/R1 xếp trước U1…U4 theo thứ tự phát hành).','');
L.push('| Lớp | Tên | Số tướng | Tướng | Đợt cần đầu tiên | Ưu tiên ở systems §4.4 | Khớp? |','|---|---|---|---|---|---|---|');
for(const wc of Object.keys(SYSP).sort()){const hs=heroes.filter(h=>h.weaponClass===wc);
  const tiers=hs.map(h=>h.releaseTier);const first=TORDER.find(t=>tiers.includes(t))||'—';
  const sp=SYSP[wc];const spT=sp.includes('VS')?'VS':sp.includes('R1')?'R1':sp.includes('U1')?'U1':sp.includes('U2')?'U2':sp.includes('U3')?'U3':'U4';
  const rank=t=>TORDER.indexOf(t);const ok=rank(first)===rank(spT)?'khớp':(rank(first)<rank(spT)?'cần SỚM hơn plan':'plan sớm hơn nhu cầu');
  L.push(`| ${wc} | ${WCN[wc]} | ${hs.length} | ${hs.map(h=>h.id+' '+h.name).join(', ')} | ${first} | ${sp} | ${ok} |`);}
L.push('');
const r1=[...new Set(heroes.filter(h=>h.era==='E6').map(h=>h.weaponClass))].sort();
const vs=[...new Set(['B15','B20'].flatMap(b=>B[b].playable).filter(i=>H[i].releaseTier==='VS').map(i=>H[i].weaponClass))].sort();
L.push(`- Lớp VS (tướng VS chơi được ở B15/B20): ${vs.join(', ')} — khớp P0 của systems.`);
L.push(`- Lớp R1 (14 tướng E6): ${r1.length} lớp: ${r1.join(', ')} — khớp L3 (8 lớp R1).`);
L.push('- Thứ tự sản xuất (L3): P0 VS: WC01, WC03, WC14 · P1 R1: WC02, WC04, WC09, WC12, WC16 · P2 U1: WC06, WC07, WC08, WC13, WC15 · P3 U2: WC05, WC11 · P4 U4: WC10.');
const ewcR1=[...new Set(enemies.filter(x=>x.era==='E6').map(x=>x.weaponClass))].sort();
L.push(`- Lớp địch R1: ${ewcR1.join(', ')} (systems: EWC01, EWC02, EWC04).`);
L.push('- Đổi lớp trong đợt hợp nhất: H05 Trưng Nhị WC03 → WC10 · H34 Trần Khánh Dư WC07 → WC01 · H36 Trần Bình Trọng WC06 → WC04 · H40 Nguyễn Khoái WC08 → WC09 · X19 Toa Đô EWC03 → EWC02 · X23 Trương Văn Hổ EWC05 → EWC02. Mọi binh khí bị đổi đều mang nhãn Hư cấu.','');
L.push('## (e) Màn Chronicle chính thức (L11)','');
L.push('| ID | Tên | Tướng | Thời đại | Bản đồ dùng lại | Nhãn | Tiền đề | Đợt |','|---|---|---|---|---|---|---|---|');
for(const c of chronicleMissions) L.push(`| ${c.id} | ${esc(c.title)} | ${c.heroes.map(i=>i+' '+H[i].name).join(', ')} | ${c.era} | ${c.mapReuse} ${esc(B[c.mapReuse].name)} | ${c.historicity||'—'} | ${esc(c.premise)} | ${c.releaseTier} |`);
L.push('','C01–C06 là 6 màn chính thức cho tướng chỉ có ở Chronicle (L11); C07, C08 thêm sau kiểm chứng web 29/09/2026 (Đặng Dung; Nguyễn Lữ và Trần Quang Diệu).','');
L.push('## (f) Tướng dự bị cho cập nhật','');
L.push('| Tên | Thời đại | Lý do | Đợt dự kiến |','|---|---|---|---|');
for(const r of reserveHeroes) L.push(`| ${esc(r.name)} | ${r.era} | ${esc(r.reason)} | ${esc(r.plannedTier)} |`);
L.push('','## (g) Nguồn đã mở (gộp, bỏ trùng)','');
for(const s of mergedSources) L.push(`- [${esc(s.title)}](${encodeURI(decodeURISafe(s.url))}) — ${s.groups.join(', ')}`);
function decodeURISafe(u){try{return decodeURI(u);}catch(e){return u;}}
L.push('','## (h) Câu hỏi mở','');
L.push('Đã xóa các câu đã được quyết theo L1–L14 và kiểm chứng web (Thánh Gióng, màn Chronicle, Đặng Dung, Hồ Nguyên Trừng, bè lửa, Nguyễn Lữ/Trần Quang Diệu, defeatMeans, cinematic, trần lớp R1, thứ tự sản xuất, khung Kế Sách, nhãn Hỗn hợp, ngân sách chỉ số, Sĩ Khí %, TPC, VAT, B15 variant, B12/B13 hướng dẫn, Chiêu Văn, Đỗ Hành/Thánh Tông).','');
L.push('### Do bước hợp nhất phát hiện','');extraQ.forEach(q=>L.push('- '+q.replace(/^\[Hợp nhất\] /,'')));
for(const g of G){L.push('',`### Từ ${g}`,'');(D[g].openQuestions||[]).forEach(q=>L.push('- '+q));}
fs.writeFileSync(path.join(dir,'canon-summary.md'),L.join('\n')+'\n','utf8');
console.log('chronicle',chronicleMissions.map(c=>c.id).join(','),JSON.stringify(canon.meta.counts),'openQuestions',canon.openQuestions.length,'conventions',canon.conventions.length,'R1',r1.join(','),'VS',vs.join(','),'EWC R1',ewcR1.join(','));
