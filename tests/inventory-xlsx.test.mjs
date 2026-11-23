import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
const dataUri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const zipSource=await readFile(new URL('../assets/js/cnc-xlsx.js',import.meta.url),'utf8');
const periodSource=await readFile(new URL('../assets/js/inventory-period.js',import.meta.url),'utf8');
const {inventoryBalances,defaultInventoryPeriod}=await import(dataUri(periodSource));
const source=(await readFile(new URL('../assets/js/inventory-xlsx.js',import.meta.url),'utf8')).replace('./cnc-xlsx.js?v=20261105-inventory',dataUri(zipSource)).replace('./inventory-period.js?v=2',dataUri(periodSource));
const {createInventoryWorkbook}=await import(dataUri(source));
const logoBytes=new Uint8Array(await readFile(new URL('../logo.jpg',import.meta.url)));
const records=[
 {id:'tools',unit:'bộ',name:'Cờ lê tự động',sku:'000123',category:'Đồ nghề bảo trì',specs:'Bộ dụng cụ cơ khí',quantity:3,min:1,price:150000,location:'A-01',supplier:'Sửa máy'},
 {id:'sensor',unit:'cái',name:'Cảm biến tiệm cận',sku:'SENSOR-02',category:'Điện',specs:'M18 • 24VDC',quantity:1,min:2,price:220000},
 {name:'=HYPERLINK("unsafe")',sku:'<SKU&>',category:'Khí',quantity:0,min:1,price:100000,note:'Một ghi chú dài cần xuống dòng trong file Excel để người đọc không bị mất nội dung.'},
 {name:'Chưa nhập tồn',sku:'UNKNOWN',quantity:null,min:null,price:null}
];
test('inventory exports a branded real XLSX with original logo, numeric values, text SKU and stock movements',async()=>{
 const movements=[
  {itemId:'tools',sku:'OLD',type:'in',amount:12.5,at:'2026-11-01T00:00:00+07:00'},
  {itemId:'tools',type:'out',amount:4,at:'2026-11-05T08:00:00+07:00'},
  {sku:' sensor-02 ',type:'out',amount:3,at:'2026-11-03T01:00:00+07:00'},
  {itemId:'removed',sku:'SENSOR-02',type:'out',amount:100,at:'2026-11-03T01:00:00+07:00'},
 ];
 const bytes=new Uint8Array(await createInventoryWorkbook(records,{logoBytes,movements,generatedAt:new Date('2026-11-05T02:30:00Z'),actor:'Người kiểm tra'}).arrayBuffer());
 assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
 await writeFile('/tmp/ltd-inventory-fixture.xlsx',bytes);
 const text=new TextDecoder().decode(bytes);
 for(const value of ['BÁO CÁO TỒN KHO LINH KIỆN','CÔNG TY LTD VIỆT NAM','Đơn vị tính','Tồn đầu kỳ','Nhập kho','Xuất kho','Tồn cuối kỳ','TỒN KHO','TỔNG KẾT NHẬP / XUẤT / TỒN THEO ĐƠN VỊ TÍNH','000123','xl/media/logo.jpg','showGridLines="0"','topLeftCell="A9"','autoFilter ref="A8:M12"','xl/tables/table1.xml','displayName="LTDInventory"'])assert.ok(text.includes(value),value);
 for(const title of ['Cần bổ sung','Tồn tối thiểu','TỔNG SỐ LƯỢNG','DANH MỤC','Nhập/xuất cộng theo toàn bộ lịch sử','Tồn đầu/cuối kỳ được tính'])assert.ok(!text.includes(title),title);
 assert.match(text, /r="H9"[^>]*><v>12.5<\/v>/);
 assert.match(text, /r="I9"[^>]*><v>4<\/v>/);
 assert.match(text, /r="I10"[^>]*><v>3<\/v>/);
 assert.match(text, /r="H15"[^>]*><v>12.5<\/v>/);
 assert.ok(!text.includes('<f>'));assert.ok(text.includes('=HYPERLINK(&quot;unsafe&quot;)'));
 assert.ok(!text.includes('Giá tham khảo'));assert.ok(!text.includes('GIÁ TRỊ THAM KHẢO'));assert.ok(!text.includes('<v>670000</v>'));
 assert.ok(text.includes('&lt;SKU&amp;&gt;'));
});
test('empty inventory is valid and missing logo fails explicitly',async()=>{
 assert.throws(()=>createInventoryWorkbook([]),/logo LTD/);
 const blob=createInventoryWorkbook([],{logoBytes});assert.ok(blob.size>logoBytes.length);
});

test('historical balances use inclusive Vietnam dates and roll back later movements',()=>{
 const [item]=records;
 const movements=[
  {itemId:'tools',type:'in',amount:90,at:'2026-10-31T16:59:59Z'},
  {itemId:'tools',type:'in',amount:4,at:'2026-10-31T17:00:00Z'},
  {itemId:'tools',type:'out',amount:2,at:'2026-11-02T16:59:59Z'},
  {itemId:'tools',type:'in',amount:1,at:'2026-11-02T17:00:00Z'},
  {itemId:'tools',type:'out',amount:50,at:'2027-01-01T00:00:00Z'},
 ];
 const now=new Date('2026-11-05T00:00:00Z');
 assert.deepEqual(inventoryBalances([item],movements,{start:'2026-11-01',end:'2026-11-02'},now).get(item),
  {opening:0,received:4,issued:2,closing:2});
 assert.deepEqual(defaultInventoryPeriod(new Date('2026-10-31T17:00:00Z')),{start:'2026-11-01',end:'2026-11-01'});
 assert.throws(()=>inventoryBalances([item],[],{start:'2026-11-01',end:'2026-12-01'},now),/tương lai/);
});
