'use strict';
// Headless Chromium smoke against only the checked-out, sanitized public examples.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const chrome=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
if(!chrome){console.error('Chrome/Chromium not found; browser smoke cannot be validated');process.exit(1);}
const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.md':'text/markdown','.svg':'image/svg+xml','.json':'application/json'};
function tinyPdf(){
  const chunks=['%PDF-1.4\\n'], offsets=[0];
  const add=object=>{offsets.push(Buffer.byteLength(chunks.join('')));chunks.push(object);};
  add('1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n');
  add('2 0 obj\\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\\nendobj\\n');
  add('3 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 250 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\\nendobj\\n');
  add('4 0 obj\\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\\nendobj\\n');
  const stream='BT /F1 18 Tf 30 90 Td (Synthetic PDF only) Tj ET';
  add('5 0 obj\\n<< /Length '+Buffer.byteLength(stream)+' >>\\nstream\\n'+stream+'\\nendstream\\nendobj\\n');
  const start=Buffer.byteLength(chunks.join(''));
  chunks.push('xref\\n0 6\\n0000000000 65535 f \\n');
  offsets.slice(1).forEach(offset=>chunks.push(String(offset).padStart(10,'0')+' 00000 n \\n'));
  chunks.push('trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n'+start+'\\n%%EOF\\n');
  return Buffer.from(chunks.join(''),'ascii');
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const requested=decodeURIComponent(url.pathname);
  if(requested==='/tests/synthetic.pdf'){
    const pdf=tinyPdf();
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:pdf);return;
  }
  if(requested==='/tests/slow-demo.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    if(req.method==='HEAD'){res.end();return;}
    setTimeout(()=>res.end('<!doctype html><title>Delayed synthetic HTML</title><p>Fixture only</p>'),3000);return;
  }
  const target=path.resolve(root,'.'+requested);
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
    res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');return;
  }
  res.writeHead(200,{'Content-Type':(type[path.extname(target)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
});
server.listen(0,'127.0.0.1',async()=>{
  const port=server.address().port,profile=fs.mkdtempSync(path.join(os.tmpdir(),'vault-chrome-'));
  const url='http://127.0.0.1:'+port+'/tests/browser_fixture.html';
  const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking',
    '--no-first-run','--user-data-dir='+profile,'--virtual-time-budget=12000','--dump-dom',url];
  const child=spawn(chrome,args,{stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',chunk=>{out+=chunk.toString();});
  child.stderr.on('data',chunk=>{err+=chunk.toString();});
  const timer=setTimeout(()=>child.kill('SIGKILL'),40000);
  let code;
  try{
    code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    const marker=out.match(/<div id="browser-smoke-result" data-outcome="([^"]+)">([^<]*)<\/div>/);
    console.log('Browser smoke:',marker?.[1],marker?.[2]);
    assert.equal(code,0,'Chromium exit code');
    assert.equal(marker?.[1],'pass','Browser smoke did not finish successfully; stderr '+err.slice(-1200));
  }catch(e){console.error(e);process.exitCode=1;}
  finally{clearTimeout(timer);server.close();fs.rmSync(profile,{recursive:true,force:true});}
});
