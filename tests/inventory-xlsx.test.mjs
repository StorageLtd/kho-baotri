import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
const dataUri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const zipSource=await readFile(new URL('../assets/js/cnc-xlsx.js',import.meta.url),'utf8');
const source=(await readFile(new URL('../assets/js/inventory-xlsx.js',import.meta.url),'utf8')).replace('./cnc-xlsx.js?v=20261105-inventory',dataUri(zipSource));
const {createInventoryWorkbook}=await import(dataUri(source));
const logoBytes=new Uint8Array(await readFile(new URL('../logo.jpg',import.meta.url)));
const records=[
 {name:'Cờ lê tự động',sku:'000123',category:'Đồ nghề bảo trì',specs:'Bộ dụng cụ cơ khí',quantity:3,min:1,price:150000,location:'A-01',supplier:'Sửa máy'},
 {name:'Cảm biến tiệm cận',sku:'SENSOR-02',category:'Điện',specs:'M18 • 24VDC',quantity:1,min:2,price:220000},
 {name:'=HYPERLINK("unsafe")',sku:'<SKU&>',category:'Khí',quantity:0,min:1,price:100000,note:'Một ghi chú dài cần xuống dòng trong file Excel để người đọc không bị mất nội dung.'},
 {name:'Chưa nhập tồn',sku:'UNKNOWN',quantity:null,min:null,price:null}
];
test('inventory exports a branded real XLSX with original logo, numeric values, text SKU and stock status',async()=>{
 const bytes=new Uint8Array(await createInventoryWorkbook(records,{logoBytes,generatedAt:new Date('2026-11-05T02:30:00Z'),actor:'Người kiểm tra'}).arrayBuffer());
 assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
 await writeFile('/tmp/ltd-inventory-fixture.xlsx',bytes);
 const text=new TextDecoder().decode(bytes);
 for(const value of ['BÁO CÁO TỒN KHO LINH KIỆN','CÔNG TY LTD VIỆT NAM','Cần bổ sung','Hết hàng','Đủ tồn','Chưa có số liệu','000123','xl/media/logo.jpg','showGridLines="0"','topLeftCell="A9"','autoFilter ref="A8:K12"','xl/tables/table1.xml','displayName="LTDInventory"'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes('<f>'));assert.ok(text.includes('=HYPERLINK(&quot;unsafe&quot;)'));
 assert.ok(!text.includes('Giá tham khảo'));assert.ok(!text.includes('GIÁ TRỊ THAM KHẢO'));assert.ok(!text.includes('<v>670000</v>'));
 assert.ok(text.includes('&lt;SKU&amp;&gt;'));
});
test('empty inventory is valid and missing logo fails explicitly',async()=>{
 assert.throws(()=>createInventoryWorkbook([]),/logo LTD/);
 const blob=createInventoryWorkbook([],{logoBytes});assert.ok(blob.size>logoBytes.length);
});
