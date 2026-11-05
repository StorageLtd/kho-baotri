import {zipWorkbook} from './cnc-xlsx.js?v=20261105-maintenance';
const esc=value=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const col=index=>String.fromCharCode(65+index);
const xmlNs='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNs='http://schemas.openxmlformats.org/package/2006/relationships';
const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
function dateValue(value){
 if(!value)return null;
 const text=String(value),date=new Date(typeof value==='number'?value:/^\d{4}-\d{2}-\d{2}$/.test(text)?text+'T00:00:00+07:00':text);
 if(!Number.isFinite(+date)||(/^\d{4}-\d{2}-\d{2}$/.test(text)&&dayFormatter.format(date)!==text))return null;
 return date;
}
const displayDay=value=>{const date=dateValue(value);return date?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(date):'Chưa có ngày'};
const compareText=(a,b)=>String(a??'').localeCompare(String(b??''),'vi',{numeric:true});
export function maintenancePlan(jobs,machines,{generatedAt=new Date(),recurrenceLabel=()=>''}={}){
 const today=dayFormatter.format(generatedAt),lookup=new Map(machines.map(m=>[m.id,m]));
 const ordered=jobs.map(job=>({job,date:dateValue(job.nextDate),machine:lookup.get(job.machineId)||{}})).sort((a,b)=>(a.date?+a.date:Infinity)-(b.date?+b.date:Infinity)||compareText(a.job.machineName||a.machine.name,b.job.machineName||b.machine.name)||compareText(a.job.jobName,b.job.jobName));
 const state=date=>!date?'Chưa có ngày':dayFormatter.format(date)<today?'Quá hạn':dayFormatter.format(date)===today?'Đến hạn hôm nay':'Đã lên lịch';
 return {title:'KẾ HOẠCH BẢO TRÌ THIẾT BỊ',sheetName:'Kế hoạch bảo trì',tableName:'LTDMaintenancePlan',filename:'LTD-Ke-hoach-bao-tri',
  headings:['STT','Ngày đến hạn','Trạng thái','Tên máy','Model','Số Serial','Hạng mục bảo trì','Chu kỳ','Người phụ trách','Thời lượng dự kiến','Người lập','Công việc / Checklist'],
  widths:[6,16,20,25,16,18,28,16,22,18,22,48],statusColumn:2,
  summary:[['TỔNG CÔNG VIỆC',jobs.length],['QUÁ HẠN',ordered.filter(x=>state(x.date)==='Quá hạn').length],['ĐẾN HẠN HÔM NAY',ordered.filter(x=>state(x.date)==='Đến hạn hôm nay').length]],
  data:ordered.map(({job:j,date,machine:m},i)=>[i+1,displayDay(j.nextDate),state(date),j.machineName||m.name||'',m.model||'',m.serial||'',j.jobName||'',recurrenceLabel(j),j.owner||'',j.estimatedTime||'',j.createdBy||'',j.desc||''])};
}
export function repairHistoryForm(records){
 const ordered=records.map(record=>({record,date:dateValue(record.faultTime)})).sort((a,b)=>(b.date?+b.date:-Infinity)-(a.date?+a.date:-Infinity)||compareText(a.record.machine,b.record.machine));
 return {title:'NHẬT KÝ SỬA CHỮA & BẢO TRÌ',sheetName:'Lịch sử sửa chữa',tableName:'LTDRepairHistory',filename:'LTD-Lich-su-sua-chua',
  headings:['STT','Ngày sửa chữa','Tên máy','Người thực hiện','Mô tả lỗi / Hạng mục','Phương án xử lý'],widths:[6,23,34,29,64,80],
  summary:[['SỐ BẢN GHI',records.length],['THIẾT BỊ',new Set(records.map(r=>String(r.machine||'').trim()).filter(Boolean)).size],['CẬP NHẬT GẦN NHẤT',ordered.find(x=>x.date)?displayDay(ordered.find(x=>x.date).record.faultTime):'—']],
  data:ordered.map(({record:r},i)=>[i+1,displayDay(r.faultTime),r.machine||'',r.staff||'',r.fault||'',r.fix||''])};
}
const displayTimestamp=value=>{const date=dateValue(value);return date?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date):'Chưa có thời gian'};
export function alarmHistoryForm(records){
 const ordered=records.map(record=>({record,date:dateValue(record.timestamp)})).sort((a,b)=>(b.date?+b.date:-Infinity)-(a.date?+a.date:-Infinity)||compareText(a.record.cncName,b.record.cncName));
 return {title:'LỊCH SỬ ALARM MÁY CNC',sheetName:'Lịch sử Alarm CNC',tableName:'LTDCncAlarmHistory',filename:'LTD-Lich-su-Alarm-CNC',
  headings:['STT','Thời gian phát hiện','Tên máy CNC','Mã Alarm','Loại','Trục','Mô tả chi tiết lỗi','Trạng thái','Thời gian kết thúc'],widths:[6,24,26,16,10,10,70,26,24],statusColumn:7,
  summary:[['TỔNG SỰ CỐ',records.length],['CHƯA GHI NHẬN KẾT THÚC',records.filter(r=>!r.resolvedAt).length],['THIẾT BỊ',new Set(records.map(r=>r.cncId||r.cncName).filter(Boolean)).size]],
  data:ordered.map(({record:r},i)=>[i+1,displayTimestamp(r.timestamp),r.cncName||'',String(r.alarmCode??''),r.alarmType??'',r.axis??'',r.description||'',r.resolvedAt?(r.source==='focas'?'Hết tín hiệu lỗi':'Đã xử lý'):'Chưa ghi nhận kết thúc',r.resolvedAt?displayTimestamp(r.resolvedAt):''])};
}
function cell(ref,value,style){return value===null||value===undefined?`<c r="${ref}" s="${style}"/>`:typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`}
function row(number,values,height=30){return `<row r="${number}" ht="${height}" customHeight="1">${values.map(([column,value,style])=>cell(col(column)+number,value,style)).join('')}</row>`}
export function createMaintenanceWorkbook(layout,{logoBytes,generatedAt=new Date(),actor=''}={}){
 if(!(logoBytes instanceof Uint8Array)||!logoBytes.length)throw new Error('Chưa tải được logo LTD. Vui lòng thử lại.');
 const timestamp=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(generatedAt);
 const items=layout.data,headings=layout.headings,lastCol=col(headings.length-1),last=items.length+8,total=last+2;
 const rows=[row(1,[[2,'CÔNG TY LTD VIỆT NAM',1]],25),row(2,[[2,layout.title,2]],32),row(3,[[2,`Ngày xuất: ${timestamp}${actor?'   •   Người xuất: '+actor:''}`,3]],24),row(4,[],10)];
 const splits=headings.length===6?[0,3,5,6]:headings.length===9?[0,4,7,9]:[0,4,8,headings.length];
 rows.push(row(5,layout.summary.map(([label],i)=>[splits[i],label,4]),22),row(6,layout.summary.map(([,value],i)=>[splits[i],value,i===1&&layout.statusColumn!==undefined?6:5]),34),row(7,[],12),row(8,headings.map((h,i)=>[i,h,8]),32));
 items.forEach((values,index)=>{
  const lines=Math.max(...values.map((v,i)=>String(v??'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(1,layout.widths[i]-3))),0)));
  rows.push(row(index+9,values.map((value,i)=>[i,value,i===layout.statusColumn?(value==='Quá hạn'?15:['Đến hạn hôm nay','Chưa ghi nhận kết thúc'].includes(value)?16:['Đã lên lịch','Hết tín hiệu lỗi','Đã xử lý'].includes(value)?17:index%2?10:9):typeof value==='number'?(index%2?12:11):(index%2?10:9)]),Math.min(409,Math.max(38,lines*15+12))));
 });
 rows.push(row(total,[[0,`Tổng cộng: ${items.length} ${layout.tableName==='LTDCncAlarmHistory'?'sự cố':layout.statusColumn!==undefined?'công việc':'bản ghi'}`,18]],28),row(total+2,[[0,'LTD VIỆT NAM  •  QUẢN LÝ BẢO TRÌ THIẾT BỊ',3]],24));
 const merges=['A1:B3',`C1:${lastCol}1`,`C2:${lastCol}2`,`C3:${lastCol}3`,...layout.summary.flatMap((_,i)=>{const start=col(splits[i]),end=col(splits[i+1]-1);return start===end?[]:[`${start}5:${end}5`,`${start}6:${end}6`]}),`A${total}:${lastCol}${total}`,`A${total+2}:${lastCol}${total+2}`];
 const files={};
 files['[Content_Types].xml']=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${items.length?'<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>':''}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`;
 files['_rels/.rels']=`<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
 files['xl/workbook.xml']=`<workbook xmlns="${xmlNs}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${esc(layout.sheetName)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${esc(layout.sheetName)}'!$8:$8</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'${esc(layout.sheetName)}'!$A$1:$${lastCol}$${total+2}</definedName></definedNames></workbook>`;
 files['xl/_rels/workbook.xml.rels']=`<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const fonts=[['11','173D35',''],['13','0F5945','<b/>'],['22','123D31','<b/>'],['10','6A7E75',''],['10','5D756B','<b/>'],['21','123D31','<b/>'],['21','B36C11','<b/>'],['11','FFFFFF','<b/>'],['10','BC3F3F','<b/>'],['10','A66A13','<b/>'],['10','167454','<b/>'],['11','123D31','<b/>']];
 const fills=['none','gray125','FFFFFF','F2F7F4','EAF3EE','0F5945','FFF0EF','FFF6E5','E9F5EF'];
 // style: font, fill, border, number-format, horizontal alignment
 const specs=[[0,0,0,0,'left'],[1,0,0,0,'left'],[2,0,0,0,'left'],[3,0,0,0,'left'],[4,4,0,0,'left'],[5,4,0,164,'left'],[6,4,0,164,'left'],[5,4,0,165,'left'],[7,5,1,0,'center'],[0,2,1,0,'left'],[0,3,1,0,'left'],[0,2,1,164,'right'],[0,3,1,164,'right'],[0,2,1,165,'right'],[0,3,1,165,'right'],[8,6,1,0,'center'],[9,7,1,0,'center'],[10,8,1,0,'center'],[11,4,1,0,'left'],[11,4,1,164,'right'],[11,4,1,165,'right'],[0,2,1,166,'right'],[0,3,1,166,'right'],[5,4,0,166,'left'],[11,4,1,166,'right']];
 files['xl/styles.xml']=`<styleSheet xmlns="${xmlNs}"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0&quot; ₫&quot;"/></numFmts><fonts count="${fonts.length}">${fonts.map(([size,color,bold])=>`<font>${bold}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/></font>`).join('')}</fonts><fills count="${fills.length}">${fills.map((color,i)=>i<2?`<fill><patternFill patternType="${color}"/></fill>`:`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border/><border><left style="thin"><color rgb="FFB7CFC3"/></left><right style="thin"><color rgb="FFB7CFC3"/></right><top style="thin"><color rgb="FFB7CFC3"/></top><bottom style="thin"><color rgb="FFB7CFC3"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${specs.length}">${specs.map(([font,fill,border,format,align])=>`<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="${align}" vertical="center" wrapText="1" indent="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 files['xl/worksheets/sheet1.xml']=`<worksheet xmlns="${xmlNs}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastCol}${total+2}"/><sheetViews><sheetView showGridLines="0" zoomScale="85" workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${layout.widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>${items.length?'':'<autoFilter ref="A8:${lastCol}8"/>'}<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.2"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LLTD VIỆT NAM&amp;C${esc(timestamp)}&amp;RTrang &amp;P / &amp;N</oddFooter></headerFooter><drawing r:id="rIdLogo"/>${items.length?'<tableParts count="1"><tablePart r:id="rIdTable"/></tableParts>':''}</worksheet>`;
 files['xl/worksheets/_rels/sheet1.xml.rels']=`<Relationships xmlns="${relNs}"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>${items.length?'<Relationship Id="rIdTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>':''}</Relationships>`;
 files['xl/drawings/drawing1.xml']='<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from><xdr:ext cx="1752600" cy="763016"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo LTD"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
 files['xl/drawings/_rels/drawing1.xml.rels']=`<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.jpg"/></Relationships>`;
 if(items.length)files['xl/tables/table1.xml']=`<table xmlns="${xmlNs}" id="1" name="${layout.tableName}" displayName="${layout.tableName}" ref="A8:${lastCol}${last}" totalsRowShown="0"><autoFilter ref="A8:${lastCol}${last}"/><tableColumns count="${headings.length}">${headings.map((name,i)=>`<tableColumn id="${i+1}" name="${esc(name)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium4" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
 const logoWidth=Math.min(184,(layout.widths[0]+layout.widths[1])*7-20);
 files['xl/drawings/drawing1.xml']=files['xl/drawings/drawing1.xml'].replace('cx="1752600" cy="763016"',`cx="${Math.round(logoWidth*9525)}" cy="${Math.round(logoWidth*160/367*9525)}"`);
 files['xl/media/logo.jpg']=logoBytes;
 return zipWorkbook(files);
}
export async function downloadMaintenanceWorkbook(layout,{actor='',generatedAt=new Date(),logoUrl=new URL('../../logo.jpg',import.meta.url)}={}){
 const response=await fetch(logoUrl,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Không tải được logo LTD. Vui lòng thử lại.');
 const blob=createMaintenanceWorkbook(layout,{logoBytes:new Uint8Array(await response.arrayBuffer()),generatedAt,actor});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${layout.filename}-${dayFormatter.format(generatedAt)}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
