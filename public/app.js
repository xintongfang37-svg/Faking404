const $ = id => document.getElementById(id);
let stream, generation = 0, items = [], selected = 0, lastImage = null, phase = 'idle';
function status(message) { $('status').textContent = message; }
function reset() {
  generation++; phase = 'idle'; items = []; selected = 0; lastImage = null;
  $('proposal').hidden = $('results').hidden = $('retry').hidden = true;
  $('source').value = ''; $('photo').hidden = true; $('photo').removeAttribute('src'); status('待扫描'); $('hint').textContent = '等待扫描';
}
async function post(url, data) {
  const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '请求失败');
  return payload;
}
async function recognize(image) {
  const current = ++generation; lastImage = image; phase = 'recognizing';
  $('photo').src = image; $('photo').hidden = false;
  $('proposal').hidden = $('results').hidden = $('retry').hidden = true; status('本地识别中…');
  const started = performance.now();
  try {
    const result = await post('/api/ocr', { image });
    if (current !== generation) return;
    $('source').value = result.text;
    const quality = result.confidence < 70 ? '识别可信度偏低，请重新对焦拍摄或修正文字。' : '请核对并修正文字。';
    $('hint').textContent = `OCR 用时 ${((performance.now()-started)/1000).toFixed(1)} 秒；${quality}`;
    phase = 'ready'; status(result.text ? '已识别，可检查文字' : '未识别到文字，请重拍');
    $('proposal').hidden = !result.suggested;
    if (!result.text) $('retry').hidden = false;
  } catch (error) { if (current === generation) { phase='error'; status(error.message); $('retry').hidden=false; } }
}
function readFile(file) {
  if (!file) return;
  const reader = new FileReader(); reader.onload = () => recognize(reader.result); reader.readAsDataURL(file);
}
$('file').onchange = event => readFile(event.target.files[0]);
$('camera').onclick = async () => {
  try {
    stream?.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false });
    $('video').srcObject=stream; $('video').hidden=false;
    await $('video').play(); $('capture').disabled=false;
  }
  catch (error) { status(`后置摄像头不可用：${error.message}`); }
};
$('capture').onclick = () => {
  const video=$('video'), canvas=$('canvas');
  if (!video.videoWidth || !video.videoHeight) return status('摄像头尚未准备好，请稍后重试');
  const scale=Math.min(1,2800/Math.max(video.videoWidth,video.videoHeight)); canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height); recognize(canvas.toDataURL('image/jpeg',.9));
};
$('source').oninput = () => { if (phase !== 'analyzing' && phase !== 'checking') { phase='ready'; $('proposal').hidden = $('source').value.trim().length < 15; status('文字已修改，请检查后确认'); } };
$('dismiss').onclick = () => { $('proposal').hidden=true; status('已忽略本次提示'); };
$('confirm').onclick = async () => {
  const text=$('source').value.trim(), current=++generation; phase='analyzing'; $('proposal').hidden=true; $('retry').hidden=true; status('正在生成材料清单…');
  const started=performance.now();
  try { const result=await post('/api/analyze',{text}); if(current!==generation)return; items=result.items; phase='checking'; render(); $('results').hidden=false; status(`清单已生成 · 云端耗时 ${((performance.now()-started)/1000).toFixed(1)} 秒`); }
  catch(error){if(current===generation){phase='error'; status(error.message); $('retry').hidden=false;}}
};
function render(){
  const done=items.filter(x=>x.checked).length;
  $('progress').textContent=done===items.length ? '材料已由用户核对完毕' : `已确认 ${done} 项，还缺 ${items.length-done} 项`;
  $('items').replaceChildren(...items.map((item,index)=>{
    const li=document.createElement('li'); li.className=index===selected?'active':'';
    const mark=document.createElement('strong'); mark.textContent=`${item.checked?'☑':'□'} ${item.name}`;
    const evidence=document.createElement('small'); evidence.textContent=`原文：${item.evidence}${item.verified?'':' · 待核实：未找到完全一致的原文'}`;
    li.append(mark,evidence); li.onclick=()=>{selected=index;render()}; li.ondblclick=()=>toggle(index); return li;
  }));
}
function toggle(index){if(phase!=='checking')return;items[index].checked=!items[index].checked;render()}
$('items').onwheel = event => {if(!items.length)return;event.preventDefault();selected=Math.max(0,Math.min(items.length-1,selected+Math.sign(event.deltaY)));render()};
document.onkeydown=event=>{if(phase!=='checking'||!items.length)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){selected=Math.max(0,Math.min(items.length-1,selected+(event.key==='ArrowDown'?1:-1)));render()}if(event.key==='Enter')toggle(selected)};
$('retry').onclick=()=>{if(lastImage&&phase==='error'&&!$('source').value.trim())recognize(lastImage);else $('confirm').click()};
$('cancel').onclick=reset;
$('save').onclick=()=>{const record={savedAt:new Date().toISOString(),source:$('source').value,items};const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='材料核对结果.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
