const endpoint='http://127.0.0.1:8766/transfer';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const pairedSessions=new Map();let pairingOwner=null,pairingGeneration=0;
export function clearCncTransferSessions(){for(const session of pairedSessions.values()){void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-LTD-Token':session.token},body:JSON.stringify({action:'logout',ip:session.ip,port:session.port}),keepalive:true}).catch(()=>{});}pairedSessions.clear();pairingOwner=null;pairingGeneration++;}
export function openCncTransfer(machine,{ownerId=''}={}){
 if(pairingOwner!==ownerId){clearCncTransferSessions();pairingOwner=ownerId;}
 const sessionKey=JSON.stringify([ownerId,machine.id,machine.ip,Number(machine.port||8193)]),cached=pairedSessions.get(sessionKey),generation=pairingGeneration;
 function rememberPairing(token){if(pairingGeneration!==generation||pairingOwner!==ownerId)return;if(pairedSessions.size>=12&&!pairedSessions.has(sessionKey))pairedSessions.delete(pairedSessions.keys().next().value);pairedSessions.set(sessionKey,{token,ip:machine.ip,port:Number(machine.port||8193)});}

 const dialog=document.createElement('dialog');dialog.className='cnc-transfer-dialog';dialog.setAttribute('aria-label','Truyền chương trình CNC');
 dialog.innerHTML=`<header><div><small>LTD · PROGRAM TRANSFER</small><h2>${esc(machine.name)}</h2><span>${esc(machine.ip)}:${esc(machine.port||8193)} · Bộ nhớ CNC</span></div><button class="btn" data-close>Đóng</button></header>
 <section class="ct-pair"><label>Mật khẩu truyền/nhận riêng<input type="password" autocomplete="off" spellcheck="false" maxlength="128" placeholder="Nhập mật khẩu truyền/nhận đã đặt trong Manager"></label><button class="btn" data-pair>Đăng nhập truyền/nhận</button><button class="btn" data-forget>Đăng xuất truyền/nhận</button><a class="btn" href="downloads/FANUC-Bridge-Manager-Path1.zip" download>Tải cầu nối tích hợp</a></section>
 <div class="ct-workspace"><section><div class="ct-pane-title"><h3>MÁY TÍNH → CNC</h3><label class="btn ct-file-label">Chọn file NC<input type="file" accept=".nc,.txt,.tap,.cnc" hidden></label></div><p class="ct-file-meta">Chưa chọn file</p><pre class="ct-local-preview" tabindex="0"></pre><div class="ct-actions"><button class="btn" data-inspect>Kiểm tra trước truyền</button><button class="btn primary" data-send>Truyền vào bộ nhớ CNC →</button></div></section>
 <section><div class="ct-pane-title"><h3 data-directory-title>BỘ NHỚ CNC</h3><button class="btn" data-list>Làm mới</button></div><div class="ct-directory"><table><thead><tr><th>Chương trình</th><th>Dung lượng</th><th>Chú thích</th></tr></thead><tbody><tr><td colspan="3">Đăng nhập truyền/nhận để đọc bộ nhớ CNC.</td></tr></tbody></table></div><div class="ct-actions"><button class="btn" data-preview>Xem chương trình</button><button class="btn" data-receive>← Nhận về máy tính</button></div></section></div>
 <footer><progress hidden></progress><p role="status">Mở cầu nối Manager cho máy này rồi đăng nhập bằng mật khẩu truyền/nhận riêng.</p><small>Lưu chương trình vào bộ nhớ · Người vận hành chọn và chạy tại máy</small></footer>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),key=$('.ct-pair input'),file=$('input[type=file]'),status=$('[role=status]'),progress=$('progress');
 let paired=false,busy=false,content='',filename='',prepared=null,selected=null,closed=false,fileRevision=0,localProgram=null,sessionToken='';
 function showFileMeta(size){
  const meta=$('.ct-file-meta');meta.replaceChildren();
  const name=document.createElement('span');name.textContent=`${filename} · ${size.toLocaleString('vi-VN')} byte`;meta.append(name);
  const label=document.createElement('strong');label.textContent=localProgram?`Số O trong nội dung: ${localProgram}`:'Chưa xác định được một số O trong nội dung';meta.append(label);
  const named=/^O0*(\d+)(?:\.|$)/i.exec(filename);
  if(localProgram&&named&&Number(named[1])!==Number(localProgram.slice(1))){const note=document.createElement('small');note.textContent=`Tên file khác số O bên trong. CNC sẽ nhận ${localProgram}.`;meta.append(note);}
 }
 const buttons=['pair','forget','inspect','send','list','preview','receive'].map(a=>$(`[data-${a}]`));
 function update(){for(const b of buttons)b.disabled=busy||((b.hasAttribute('data-inspect')||b.hasAttribute('data-list'))&&!paired)||((b.hasAttribute('data-send'))&&(!paired||!content))||((b.hasAttribute('data-preview')||b.hasAttribute('data-receive'))&&(!paired||!selected||selected.number>7999));$('[data-inspect]').disabled=busy||!paired||!content;file.disabled=busy;key.disabled=busy||paired;key.placeholder=paired?'Đã đăng nhập truyền/nhận':'Nhập mật khẩu truyền/nhận riêng';$('[data-close]').disabled=busy;progress.hidden=!busy;$('[data-forget]').disabled=busy||(!paired&&!pairedSessions.has(sessionKey));$('[data-pair]').textContent=paired?'Đã đăng nhập':'Đăng nhập truyền/nhận';$('[data-pair]').disabled=busy||paired;for(const action of ['preview','receive'])$(`[data-${action}]`).title=!selected?'Chọn một chương trình trong bảng bộ nhớ CNC trước':selected.number>7999?'Bản thử hỗ trợ O0001–O7999':`Đọc ${selected.program} từ bộ nhớ CNC`;$('[data-send]').title=!paired?'Đăng nhập truyền/nhận trước':!content?'Chọn file NC ở khung Máy tính trước':'Gửi vào bộ nhớ CNC sau khi kiểm tra đạt';}
 async function call(action,extra={}){
  if(closed||busy||pairingGeneration!==generation)return null;
  if(action!=='login'&&!sessionToken)throw new Error('Đăng nhập bằng mật khẩu truyền/nhận riêng trước.');
  busy=true;update();status.textContent=action==='send'?'Đang ghi chương trình vào bộ nhớ CNC. Không đóng tiện ích hoặc rút cáp…':'Đang '+({login:'đăng nhập truyền/nhận',connect:'kiểm tra phiên truyền/nhận',list:'đọc danh sách CNC',inspect:'kiểm tra file và CNC',receive:'nhận chương trình từ CNC'}[action]||'xử lý')+'…';
  try{
   let response;
   try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-LTD-Token':sessionToken},body:JSON.stringify({action,ip:machine.ip,port:Number(machine.port||8193),...extra}),signal:AbortSignal.timeout(140000),cache:'no-store'});}catch{throw new Error(action==='send'?'Kết nối bị gián đoạn. Có thể còn chương trình chưa hoàn chỉnh trên CNC; kiểm tra tại máy trước khi truyền lại.':'Không kết nối được tiện ích. Mở START-MANAGER.cmd → Truyền trên web, bật đúng máy và cho phép trình duyệt truy cập mạng cục bộ nếu được hỏi.');}
   const data=await response.json();if(closed||pairingGeneration!==generation)return null;if(!response.ok||!data.ok){if(response.status===401||response.status===403){pairedSessions.delete(sessionKey);paired=false;prepared=null;sessionToken='';key.value='';}throw new Error(data.message||'Tiện ích từ chối yêu cầu.');}
   if((data.ip&&data.ip!==machine.ip)||(data.port&&Number(data.port)!==Number(machine.port||8193)))throw new Error('Phản hồi thuộc máy khác. Đã chặn thao tác; kiểm tra cấu hình máy.');
   status.textContent=data.message;return data;
  }finally{busy=false;update();}
 }
 function fail(error){
  if(closed||pairingGeneration!==generation)return;
  const raw=error.message||String(error);let message=raw;if(/Máy trên web khác máy đã chọn/.test(raw))message='Cập nhật Bridge Manager bản đa máy. Bản mới tự chọn CNC theo máy đang mở trên web, không cần đổi phiên trong Manager.';else if(/Invalid session code/i.test(raw))message='Cập nhật Bridge Manager bản mật khẩu truyền/nhận riêng. Bản Manager cũ còn yêu cầu mã ghép.';else if(/Program already exists/i.test(raw))message=`${localProgram||'Số O trong nội dung file'} đã có trong bộ nhớ CNC. Chương trình vẫn phải có số O, nhưng bản hiện tại không ghi đè một số O đã có. Đổi tên file không làm đổi số O bên trong.\n\nChi tiết: ${raw}`;else if(/must be stopped/i.test(raw))message='CNC chưa sẵn sàng nhận chương trình: cần dừng, ở EDIT, không có Alarm/Emergency. Kiểm tra tại máy.\n\nChi tiết: '+raw;else if(/two % markers/i.test(raw))message='File NC cần có dấu % ở đầu và cuối chương trình.\n\nChi tiết: '+raw;status.textContent=message;
  const note=document.createElement('dialog');note.className='ct-transfer-error';note.setAttribute('aria-label','Thông báo truyền chương trình');
  note.innerHTML='<h3>Chưa hoàn tất thao tác</h3><p></p><button class="btn">Đóng</button>';note.querySelector('p').textContent=message;note.querySelector('button').onclick=()=>note.close();note.onclose=()=>note.remove();document.body.append(note);note.showModal();
 }
 function downloadProgram(data){const url=URL.createObjectURL(new Blob([data.text],{type:'text/plain;charset=us-ascii'})),a=document.createElement('a');a.href=url;a.download=`${data.program}.nc`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function showProgram(data){
  const viewer=document.createElement('dialog');viewer.className='ct-program-view';viewer.setAttribute('aria-label','Nội dung chương trình CNC');
  viewer.innerHTML=`<header><div><small>BỘ NHỚ CNC · ${esc(machine.name)}</small><h3>${esc(data.program)}</h3>${data.path?`<small>${esc(data.path)}</small>`:''}</div><div><button class="btn" data-download>Tải file NC</button><button class="btn" data-close-view>Đóng</button></div></header><pre tabindex="0"></pre>`;
  viewer.querySelector('pre').textContent=data.text;viewer.querySelector('[data-download]').onclick=()=>downloadProgram(data);viewer.querySelector('[data-close-view]').onclick=()=>viewer.close();viewer.onclose=()=>viewer.remove();document.body.append(viewer);viewer.showModal();viewer.querySelector('pre').focus();
 }
 key.addEventListener('keydown',e=>{if(e.key==='Enter'&&!busy&&!paired){e.preventDefault();void login();}});
 async function login(){
  const password=key.value;key.value='';if(password.length<6){fail(new Error('Nhập mật khẩu truyền/nhận riêng đã đặt trong Manager.'));return;}
  try{const data=await call('login',{password});if(!data)return;if(!/^[A-Fa-f0-9]{64}$/.test(data.token||''))throw new Error('Cần cập nhật cầu nối Manager bản đăng nhập bằng mật khẩu riêng.');sessionToken=data.token;paired=true;prepared=null;rememberPairing(sessionToken);update();}
  catch(e){paired=false;update();fail(e);return;}
  try{await loadDirectory();}catch(e){fail(e);}
 }
 async function restore(){
  try{const data=await call('connect');if(!data)return;paired=true;update();}
  catch(e){paired=false;update();status.textContent='Đăng nhập lại bằng mật khẩu truyền/nhận riêng. '+e.message;return;}
  try{await loadDirectory();}catch(e){fail(e);}
 }
 $('[data-pair]').onclick=()=>login();
 $('[data-forget]').onclick=async()=>{try{if(sessionToken)await call('logout');}catch{}pairedSessions.delete(sessionKey);paired=false;prepared=null;selected=null;sessionToken='';key.value='';update();status.textContent='Đã đăng xuất truyền/nhận. Cầu nối giám sát vẫn hoạt động.';};
 file.onchange=async()=>{prepared=null;content='';localProgram=null;update();const revision=++fileRevision,chosen=file.files[0];if(!chosen)return;try{if(chosen.size<8||chosen.size>2*1024*1024)throw new Error('Chọn file NC từ 8 byte đến 2 MiB.');const bytes=new Uint8Array(await chosen.arrayBuffer());if(revision!==fileRevision||closed)return;if([...bytes].some(b=>b!==9&&b!==10&&b!==13&&(b<32||b>126)))throw new Error('File phải là NC ASCII, không có BOM/Unicode.');content=new TextDecoder('ascii').decode(bytes);filename=chosen.name;const headers=[...content.replace(/\([^)]*\)/gs,'').matchAll(/^\s*O(\d{1,8})(?=\D|$)/gm)];localProgram=headers.length===1?'O'+String(Number(headers[0][1])).padStart(4,'0'):null;showFileMeta(chosen.size);$('.ct-local-preview').textContent=content.slice(0,200000)+(content.length>200000?'\n… Bản xem trước rút gọn; truyền toàn bộ file.':'');status.textContent='Đã chọn file. Kiểm tra trước truyền hoặc bấm Truyền để kiểm tra và gửi.';update();}catch(e){content='';$('.ct-local-preview').textContent='';$('.ct-file-meta').textContent='File không hợp lệ';fail(e);}};
 async function loadDirectory(){selected=null;prepared=null;const data=await call('list');if(!data)return;const rows=Array.isArray(data.programs)?data.programs:[];$('[data-directory-title]').textContent=data.directory?'BỘ NHỚ CNC · PATH1':'BỘ NHỚ CNC';$('[data-directory-title]').title=(data.directory||'')+' · '+(data.source||'');if(data.note)status.textContent=data.message+' '+data.note;if(!content)status.textContent=data.message+(data.note?' '+data.note:'')+' Chọn file NC ở khung Máy tính nếu cần truyền vào CNC.';$('tbody').innerHTML=rows.length?rows.map((r,i)=>`<tr tabindex="0" data-row="${i}"><td><b>${esc(r.program)}</b>${r.path?`<small class="ct-program-path">${esc(r.path)}</small>`:''}</td><td>${Number.isInteger(r.length)&&r.length>=0?esc(r.length)+' B':'—'}</td><td>${esc(r.comment)}</td></tr>`).join(''):'<tr><td colspan="3">Bộ nhớ không có chương trình.</td></tr>';$('tbody').onclick=e=>{const row=e.target.closest('[data-row]');if(!row||busy)return;selected=rows[Number(row.dataset.row)];for(const el of $('tbody').querySelectorAll('tr'))el.classList.toggle('selected',el===row);status.textContent=`Đã chọn ${selected.program} trong bộ nhớ CNC. Bấm Xem chương trình hoặc Nhận về máy tính.`;update();};$('tbody').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-row]')?.click();}};update();}
 $('[data-list]').onclick=()=>loadDirectory().catch(fail);
 async function inspectFile(){prepared=null;const data=await call('inspect',{content});if(data){prepared={...data,content,checkedAt:performance.now()};status.textContent=`${data.program} · CNC dừng ở EDIT · Số O chưa tồn tại. Sẵn sàng truyền vào bộ nhớ CNC.`;}update();return !!prepared;}
 $('[data-inspect]').onclick=()=>inspectFile().catch(fail);
 $('[data-send]').onclick=async()=>{
  if(busy)return;
  if(!paired||!content){fail(new Error('Đăng nhập truyền/nhận và chọn file NC ở khung Máy tính trước khi truyền.'));return;}
  try{if((!prepared||performance.now()-prepared.checkedAt>90000)&&!await inspectFile())return;}catch(e){fail(e);return;}

  const check=prepared;prepared=null;
  try{const data=await call('send',{content:check.content,hash:check.hash,ticket:check.ticket,confirmation:`TRUYEN ${check.program}`});if(data){status.textContent=`CNC đã nhận ${check.program}. Kiểm tra nội dung tại máy trước khi chọn chạy.`;}}catch(e){fail(e);}update();
 };
 async function receive(download){if(!selected)return;const number=selected.number;const data=await call('receive',{number,path:selected.path||null});if(!data)return;if(typeof data.text!=='string'||!data.text.trim())throw new Error('CNC chưa trả về nội dung chương trình. Không hiển thị bản trống.');if(download){downloadProgram(data);}else{showProgram(data);}}
 $('[data-preview]').onclick=()=>receive(false).catch(fail);$('[data-receive]').onclick=()=>receive(true).catch(fail);
 $('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{closed=true;key.value='';sessionToken='';content='';prepared=null;document.querySelectorAll('.ct-program-view,.ct-transfer-error').forEach(child=>child.close());dialog.remove();});update();dialog.showModal();if(cached){sessionToken=cached.token;void restore();}
}
