/* Campaign Builder — section logic (self-contained, runs on inject) */
(function(){

//// ============ DOCX GENERATOR (no external deps) ============
function crc32(bytes){let t=crc32._t;if(!t){t=crc32._t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}}let crc=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^t[(crc^bytes[i])&0xFF];return(crc^0xFFFFFFFF)>>>0;}
function zipStore(files){const enc=new TextEncoder();const chunks=[];const central=[];let offset=0;const push=a=>{chunks.push(a);offset+=a.length;};const u16=n=>[n&0xFF,(n>>>8)&0xFF];const u32=n=>[n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF];
  for(const f of files){const nb=enc.encode(f.name);const data=f.data;const crc=crc32(data);const lo=offset;push(new Uint8Array([].concat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0))));push(nb);push(data);central.push({nb,crc,size:data.length,lo});}
  const cdStart=offset;for(const c of central){push(new Uint8Array([].concat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0),u32(c.crc),u32(c.size),u32(c.size),u16(c.nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(c.lo))));push(c.nb);}
  push(new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),u32(offset-cdStart),u32(cdStart),u16(0))));
  const total=chunks.reduce((s,c)=>s+c.length,0);const out=new Uint8Array(total);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;}
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DC={navy:'0A2540',cream:'FAF8F3',border:'E3DDD0',body:'1A1A1A',red:'E3004B',link:'1155CC',white:'FFFFFF',grey:'5B6675'};
const LOGO_URL='https://info.scalecomputing.com/l/46782/2026-05-22/9ncf6z/46782/1779485235Zbzzbthu/PRIMARY_horizontal_scale_logo_blue_grey_tm.png';

// --- shared run properties / page geometry (named so they read + edit cleanly) ---
const ARIAL='<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
const PAGE_W=12240, PAGE_H=15840;   // US Letter, portrait (twips; 1440 = 1in)
const MARGIN=1440;                  // 1in right/bottom/left margins
const HEADER_TOP=2060;              // taller top margin to clear the logo header
const HEADER_DIST=700, FOOTER_DIST=640; // header/footer offset from the page edge
const LOGO_EMU_W=1554480;           // logo width in EMUs (~1.62in; 914400 EMU = 1in)

function pngSize(b){if(!b||b.length<24)return null;const w=((b[16]<<24)|(b[17]<<16)|(b[18]<<8)|b[19])>>>0;const h=((b[20]<<24)|(b[21]<<16)|(b[22]<<8)|b[23])>>>0;return (w&&h)?{w,h}:null;}
function runsXml(text,base){base=base||'';const t=String(text==null?'':text);if(t==='')return`<w:r>${base?`<w:rPr>${base}</w:rPr>`:''}<w:t xml:space="preserve"></w:t></w:r>`;
  return t.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p=>{const b=/^\*\*[^*]+\*\*$/.test(p);const inner=b?p.slice(2,-2):p;const props=base+(b?'<w:b/>':'');return`<w:r>${props?`<w:rPr>${props}</w:rPr>`:''}<w:t xml:space="preserve">${esc(inner)}</w:t></w:r>`;}).join('');}
function valueParas(text,color){color=color||DC.body;const base=`${ARIAL}<w:color w:val="${color}"/><w:sz w:val="20"/>`;return String(text==null?'':text).split(/\n/).map(b=>`<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${runsXml(b,base)}</w:p>`).join('');}
function decodeEntities(s){return String(s).replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function bodyParas(html){
  html=String(html==null?'':html);
  if(!html.trim()) return `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr>${ARIAL}<w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"></w:t></w:r></w:p>`;
  const parts=html.split(/(<[^>]+>)/);
  const paras=[];let runs=[];const stack=[];const listStack=[];
  function fmt(){let b=false,i=false,u=false;for(const s of stack){b=b||s.b;i=i||s.i;u=u||s.u;}return{b,i,u};}
  function flush(){if(runs.length){paras.push(runs);runs=[];}}
  parts.forEach(tok=>{
    if(tok.charAt(0)==='<'){
      const closing=/^<\s*\//.test(tok);
      const mm=tok.match(/^<\s*\/?\s*([a-zA-Z0-9]+)/);if(!mm)return;const n=mm[1].toLowerCase();
      if(n==='br'){runs.push({br:true});return;}
      if(n==='ul'){if(runs.length)flush();if(!closing)listStack.push({type:'ul'});else listStack.pop();return;}
      if(n==='ol'){if(runs.length)flush();if(!closing)listStack.push({type:'ol',n:0});else listStack.pop();return;}
      if(n==='li'){if(runs.length)flush();if(!closing){const ls=listStack[listStack.length-1];let pre='\u2022  ';if(ls&&ls.type==='ol'){ls.n=(ls.n||0)+1;pre=ls.n+'.  ';}runs.push({t:pre});}return;}
      if(/^(p|div|h[1-6]|blockquote|tr)$/.test(n)){if(runs.length)flush();return;}
      const sB=/font-weight\s*:\s*(bold|[6-9]00)/i.test(tok),sI=/font-style\s*:\s*italic/i.test(tok),sU=/text-decoration[^;"']*underline/i.test(tok);
      if(!closing){stack.push({name:n,b:(n==='b'||n==='strong'||sB),i:(n==='i'||n==='em'||sI),u:(n==='u'||n==='a'||sU)});}
      else{for(let k=stack.length-1;k>=0;k--){if(stack[k].name===n){stack.splice(k,1);break;}}}
    } else if(tok!==''){
      const text=decodeEntities(tok);if(text==='')return;const f=fmt();runs.push({t:text,b:f.b,i:f.i,u:f.u});
    }
  });
  flush();
  if(!paras.length)paras.push([{t:''}]);
  return paras.map(arr=>{
    const inner=arr.map(r=>{
      if(r.br)return '<w:r><w:br/></w:r>';
      const props=`${ARIAL}<w:color w:val="${DC.body}"/><w:sz w:val="20"/>`+(r.b?'<w:b/>':'')+(r.i?'<w:i/>':'')+(r.u?'<w:u w:val="single"/>':'');
      return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`;
    }).join('');
    return `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${inner||'<w:r><w:t xml:space="preserve"></w:t></w:r>'}</w:p>`;
  }).join('');
}
const DBORDER=`<w:tcBorders><w:top w:val="single" w:sz="4" w:color="${DC.border}"/><w:left w:val="single" w:sz="4" w:color="${DC.border}"/><w:bottom w:val="single" w:sz="4" w:color="${DC.border}"/><w:right w:val="single" w:sz="4" w:color="${DC.border}"/></w:tcBorders>`;
const DCMAR=`<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
const LW=2520,VW=6840,FW=9360;
function dbanner(title){return`<w:tr><w:tc><w:tcPr><w:tcW w:w="${FW}" w:type="dxa"/><w:gridSpan w:val="2"/><w:tcBorders><w:top w:val="single" w:sz="4" w:color="${DC.navy}"/><w:left w:val="single" w:sz="4" w:color="${DC.navy}"/><w:bottom w:val="single" w:sz="4" w:color="${DC.navy}"/><w:right w:val="single" w:sz="4" w:color="${DC.navy}"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="${DC.navy}"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.white}"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${esc(title)}</w:t></w:r></w:p></w:tc></w:tr>`;}
function drow(label,value,o){o=o||{};const vc=o.valueColor||DC.body;const lbl=`<w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.navy}"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(label)}</w:t></w:r>`+(o.required?`<w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.red}"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">  *</w:t></w:r>`:'');
  return`<w:tr><w:tc><w:tcPr><w:tcW w:w="${LW}" w:type="dxa"/>${DBORDER}<w:shd w:val="clear" w:color="auto" w:fill="${DC.cream}"/>${DCMAR}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${lbl}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="${VW}" w:type="dxa"/>${DBORDER}<w:shd w:val="clear" w:color="auto" w:fill="${DC.white}"/>${DCMAR}<w:vAlign w:val="center"/></w:tcPr>${o.html?bodyParas(value):valueParas(value,vc)}</w:tc></w:tr>`;}
function dtable(rows){return`<w:tbl><w:tblPr><w:tblW w:w="${FW}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${LW}"/><w:gridCol w:w="${VW}"/></w:tblGrid>${rows}</w:tbl>`;}
const dspacer=()=>`<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="12"/></w:rPr></w:pPr></w:p>`;
function dheading(text,size,before,after,border){return`<w:p><w:pPr>${border?`<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="${DC.border}"/></w:pBdr>`:''}<w:spacing w:before="${before}" w:after="${after}"/></w:pPr><w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.navy}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;}
function titleBlock(camp){const q=camp.quarterLabel&&camp.quarterLabel!=='N/A'?camp.quarterLabel:'';const y=camp.yearLabel&&camp.yearLabel!=='N/A'?camp.yearLabel:'';
  let dt='';try{dt=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}catch(e){}
  const meta=[(q||y)?((q?q+' ':'')+y).trim():'',dt?('Generated '+dt):''].filter(Boolean).join('  \u00b7  ');
  const eyebrow=`<w:p><w:pPr><w:spacing w:before="0" w:after="50"/></w:pPr><w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.red}"/><w:sz w:val="18"/><w:spacing w:val="60"/></w:rPr><w:t xml:space="preserve">CAMPAIGN BUILD</w:t></w:r></w:p>`;
  const title=`<w:p><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr><w:r><w:rPr>${ARIAL}<w:b/><w:color w:val="${DC.navy}"/><w:sz w:val="46"/></w:rPr><w:t xml:space="preserve">${esc(camp.name||'Untitled Campaign')}</w:t></w:r></w:p>`;
  const sub=`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="8" w:color="${DC.red}"/></w:pBdr><w:spacing w:before="0" w:after="260"/></w:pPr><w:r><w:rPr>${ARIAL}<w:color w:val="${DC.grey}"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(meta)}</w:t></w:r></w:p>`;
  return eyebrow+title+sub;}
function dsection(title,rows){return dtable(dbanner(title)+rows.filter(Boolean).map(r=>drow(r.label,r.value,{required:r.required,valueColor:r.valueColor,html:r.html})).join(''))+dspacer();}
function buildDocBody(data){const parts=[];const camp=data.campaign||{};const inc=data.include||{email:true};
  parts.push(titleBlock(camp));
  parts.push(dsection('Campaign',[{label:'Campaign Name',value:camp.name,required:true},{label:'CRM Campaign Link',value:camp.crm,valueColor:DC.link},{label:'Quarter',value:camp.quarterLabel,required:true},{label:'Year',value:camp.yearLabel,required:true}]));
  if(inc.email)(data.emails||[]).forEach((e,i)=>{
    parts.push(dheading(e.audience?('Email - '+e.audience):('Email '+(i+1)),28,300,140,true));
    parts.push(dsection('Basic email information',[{label:'Pardot Email Name',value:e.pardotName},{label:'Tags',value:e.tags}]));
    const tagRows=[{label:'Campaign',value:camp.name}];
    if(e.hasOrder)tagRows.push({label:'Email #',value:e.number||String(i+1)});
    tagRows.push({label:'Email Type',value:e.emailType,required:true},{label:'Content Type',value:e.contentType,required:true},{label:'Audience',value:e.audience,required:true},{label:'Theme',value:e.theme,required:true},{label:'A/B Test',value:e.abTest||'No'},{label:'CTA',value:e.cta});
    parts.push(dsection('Tagging \u2014 feeds the Tag Builder',tagRows));
    parts.push(dsection('To \u2014 choose who gets this email',[{label:'Lists (Send To)',value:e.lists},{label:'Suppression Lists',value:e.suppression}]));
    parts.push(dsection('From \u2014 choose who it is sent from',[{label:'Sender Name',value:e.senderName||'Scale Computing'},{label:'From Email Address',value:e.fromEmail||'noreply@scalecomputing.com'},{label:'Reply-To Email Address',value:e.replyTo||'noreply@scalecomputing.com'}]));
    parts.push(dsection('Subject',[{label:'Subject Line A',value:e.subjectA,required:true},{label:'Subject Line B',value:e.subjectB},{label:'Preview Copy',value:e.preview}]));
    parts.push(dsection('External',[{label:'Send Date (MM/DD/YYYY)',value:e.sendDate},{label:'Send Time',value:e.sendTime}]));
    const ebRows=[{label:'Hero Image',value:e.hero,valueColor:DC.link},{label:'Body Copy',value:e.body,html:true},{label:'Main CTA',value:e.mainCta}];
    if((e.secCtaCopy&&String(e.secCtaCopy).trim())||(e.secCta&&String(e.secCta).trim())){ebRows.push({label:'Secondary CTA Copy',value:e.secCtaCopy},{label:'Secondary CTA',value:e.secCta});}
    parts.push(dsection('Email build',ebRows));
  });
  if(inc.form&&data.form){const f=data.form;
    parts.push(dheading('Pardot Form',32,320,140,true));
    parts.push(dsection('Pardot Form',[{label:'Internal Name',value:f.name}]));
    const fr=(f.fields||[]).map(fl=>({label:fl.label||'(unnamed field)',value:[fl.req?'Required':'Optional',fl.custom?'Custom field':''].filter(Boolean).join('  \u00b7  ')}));
    parts.push(dsection('Form Fields',fr.length?fr:[{label:'\u2014',value:'No fields added'}]));
    parts.push(dsection('Form Link & Code',[{label:'Form Preview Link',value:f.previewLink,valueColor:DC.link},{label:'iFrame Code',value:f.iframe}]));
    parts.push(dsection('Completion Actions',[{label:'Source',value:f.source},{label:'Detailed Lead Source',value:f.leadSource},{label:'Notify Slack Channel',value:f.slack},{label:'Add to CRM Campaign',value:camp.name},{label:'CRM Campaign Link',value:camp.crm,valueColor:DC.link},{label:'Send Email (Autoresponder)',value:f.autoresponder},{label:'Display Message',value:f.displayMsg}]));
    parts.push(dsection('Terms & Conditions',[{label:'Terms & Conditions',value:f.tc,html:true}]));
  }
  if(inc.cadence&&data.cadence){var cad=data.cadence;
    parts.push(dheading('SalesLoft Cadence',32,320,140,true));
    parts.push(dsection('SalesLoft Cadence',[{label:'Internal Flow Name',value:cad.name}]));
    (cad.steps||[]).forEach(function(stp,i){parts.push(dsection('Email Step '+(i+1),[{label:'Subject Line',value:stp.subject},{label:'Body Copy',value:stp.body}]));});
  }
  if(inc.qualified&&data.qualified){var qx=data.qualified;
    parts.push(dheading('Qualified Experience',32,320,140,true));
    parts.push(dsection('Qualified Experience',[{label:'Internal Experience Name',value:qx.name},{label:'Page or Audience Segment',value:qx.segment}]));
    parts.push(dsection('Experience Copy',[{label:'Headline',value:qx.headline},{label:'Body Copy',value:qx.body},{label:'Image & Image URL',value:qx.imageUrl,valueColor:DC.link},{label:'Subtext Below Image',value:qx.subtext},{label:'CTA Buttons',value:qx.ctas}]));
  }
  return parts.join('\n');}
function buildDocx(data,logo){const body=buildDocBody(data);
  const hasLogo=!!(logo&&logo.bytes&&logo.w&&logo.h);
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${HEADER_TOP}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="${HEADER_DIST}" w:footer="${FOOTER_DIST}" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:color w:val="${DC.body}"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  // header content: logo image or styled wordmark
  let headerInner;
  if(hasLogo){const cx=LOGO_EMU_W;const cy=Math.round(cx*logo.h/logo.w);
    headerInner=`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Scale Computing logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  } else {
    headerInner='';
  }
  const headerXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="8" w:color="${DC.navy}"/></w:pBdr><w:spacing w:after="60"/></w:pPr>${headerInner}</w:p></w:hdr>`;
  const footerXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="${DC.border}"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${FW}"/></w:tabs><w:spacing w:before="20"/><w:rPr>${ARIAL}<w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr></w:pPr><w:r><w:rPr>${ARIAL}<w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Scale Computing \u00b7 Marketing Operations</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr>${ARIAL}<w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r><w:r><w:rPr>${ARIAL}<w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:rPr><w:color w:val="${DC.grey}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasLogo?'<Default Extension="png" ContentType="image/png"/>':''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
  const enc=new TextEncoder();
  const files=[{name:'[Content_Types].xml',data:enc.encode(contentTypes)},{name:'_rels/.rels',data:enc.encode(rels)},{name:'word/document.xml',data:enc.encode(documentXml)},{name:'word/styles.xml',data:enc.encode(stylesXml)},{name:'word/header1.xml',data:enc.encode(headerXml)},{name:'word/footer1.xml',data:enc.encode(footerXml)},{name:'word/_rels/document.xml.rels',data:enc.encode(docRels)}];
  if(hasLogo){
    files.push({name:'word/media/logo.png',data:logo.bytes});
    const hdrRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`;
    files.push({name:'word/_rels/header1.xml.rels',data:enc.encode(hdrRels)});
  }
  return zipStore(files);}


//// ============ TAG LIBRARY VALUES (canonical) ============
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function labelOf(tag,prefix){return cap(tag.replace(prefix,'').replace(/-/g,' '));}
const SENDTYPE=[['One-time send','one-time-send'],['Manual sequence','manual-sequence'],['Drip / automated sequence','drip-sequence'],['Newsletter','newsletter'],['Transactional','transactional'],['Re-engagement','re-engagement'],['Announcement','announcement'],['A/B test','a-b-test']];
const AUDIENCE=[['Customer','audience-customer'],['Partner','audience-partner'],['End user','audience-end-user'],['Prospect','audience-prospect'],['Partner prospect','audience-partner-prospect'],['End user prospect','audience-end-user-prospect'],['Internal','audience-internal'],['MSP','audience-msp'],['Reseller','audience-reseller']];
const FUNNEL=[['Top of funnel (awareness)','stage-tofu'],['Middle of funnel (consideration)','stage-mofu'],['Bottom of funnel (decision)','stage-bofu'],['Nurture','stage-nurture'],['Retention','stage-retention'],['Expansion','stage-expansion'],['Advocacy','stage-advocacy']];
const CONTENT=['content-webinar-invite','content-webinar-followup','content-post-event','content-event-invite','content-event-reminder','content-gated-content','content-report-syndication','content-product-launch','content-case-study','content-survey','content-award','content-holiday-card','content-meeting-maker','content-review-solicitation','content-save-the-date','content-partner-enablement','content-support-notice','content-customer-referral-program'].map(t=>[labelOf(t,/^content-/),t]);
const THEME=['theme-vmware-alternative','theme-platform-event','theme-vdi','theme-edge-computing','theme-ransomware-bcdr','theme-retail','theme-healthcare','theme-education','theme-sysadmin','theme-partner-program','theme-product-launch','theme-gartner','theme-dcig','theme-anniversary','theme-customer-advocacy','theme-demo','theme-channel-advocacy'].map(t=>[labelOf(t,/^theme-/),t]).map(p=>p[1]==='theme-dcig'?['DCIG','theme-dcig']:p);
const CTAOPTS=['cta-pricing','cta-demo','cta-contact','cta-learn-more','cta-register','cta-survey','cta-partner-portal','cta-trial','cta-download','cta-vmware-alternative'].map(t=>[labelOf(t,/^cta-/),t]);
const AB=[['No','No'],['Yes','Yes']];
const QUARTERS=[['Q1','1'],['Q2','2'],['Q3','3'],['Q4','4'],['N/A','na']];
const YEARS=[['2025','2025'],['2026','2026'],['2027','2027'],['2028','2028'],['N/A','na']];
const TIME_OPTS=(function(){const out=['As soon as available'];for(let h=0;h<24;h++){for(let m=0;m<60;m+=15){const ap=h<12?'AM':'PM';let hh=h%12;if(hh===0)hh=12;out.push(hh+':'+String(m).padStart(2,'0')+' '+ap+' EST');}}return out;})();
const DEFAULT_SUPPRESSION=['Suppression | Global','SC Employees'];
function fmtDate(v){if(!v)return '';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?(m[2]+'/'+m[3]+'/'+m[1]):v;}
const REGISTRY=[
  {name:'Imaging Service',tag:'campaign-imaging-service-q2-2026',quarter:'2',year:'2026',salesloft:true},
  {name:'DTX Manchester',tag:'campaign-dtx-manchester-q2-2026',quarter:'2',year:'2026',salesloft:false},
  {name:'CRN ARC Survey',tag:'campaign-crn-arc-survey-q2-2026',quarter:'2',year:'2026',salesloft:false},
  {name:'MES Spring',tag:'campaign-mes-spring-q2-2026',quarter:'2',year:'2026',salesloft:true},
  {name:'VMware Alternative',tag:'campaign-vmware-alternative-q2-2026',quarter:'2',year:'2026',salesloft:true}
];
function norm(s){return(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function slug(s){return(s||'').toLowerCase().trim().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function cleanName(s){return String(s||'').replace(/^\s*Q[1-4]\s*[-\/\s]?\s*\d{4}\s*[|\u2013\-]*\s*/i,'').trim();}
function revLabel(opts,tag){for(var i=0;i<opts.length;i++)if(opts[i][1]===tag)return opts[i][0];return tag||'';}
function findCampaign(name){if(!name)return null;var nn=norm(name);for(var i=0;i<REGISTRY.length;i++)if(norm(REGISTRY[i].name)===nn)return REGISTRY[i];for(var i=0;i<REGISTRY.length;i++){var cn=norm(REGISTRY[i].name);if(cn&&(nn.indexOf(cn)>=0||cn.indexOf(nn)>=0))return REGISTRY[i];}return null;}

//// ============ STATE ============
const state={include:{email:true,form:false,cadence:false,qualified:false},campaign:{name:'',crm:'',quarter:'',year:''},emails:[],form:null,cadence:null,qualified:null};
function newFormFields(){return [{label:'First Name',req:true,custom:false},{label:'Last Name',req:true,custom:false},{label:'Business Email',req:true,custom:false},{label:'Phone',req:true,custom:false},{label:'Company',req:true,custom:false},{label:'Country',req:true,custom:false}];}
function newForm(){return{nameEdited:false,name:'',fields:newFormFields(),previewLink:'',iframe:'',source:'Marketing',leadSource:'Website',slack:'pardot_notifications',autoresponder:'',displayMsg:'Thank you! Check your inbox for the report.',tc:'',open:false};}
function newCadence(){return{nameEdited:false,name:'',steps:[{subject:'',body:''}],open:true};}
function newQualified(){return{nameEdited:false,name:'',segment:'',headline:'',body:'',imageUrl:'',subtext:'',ctas:'',open:true};}
const TC_TYPES=[];
function newEmail(){return{pardotName:'',pardotEdited:false,hasOrder:true,number:'',emailType:'',contentType:'',audience:'',theme:'',ab:'No',cta:[],
  lists:'',suppressionList:DEFAULT_SUPPRESSION.slice(),senderName:'Scale Computing',fromEmail:'noreply@scalecomputing.com',replyTo:'noreply@scalecomputing.com',
  subjectA:'',subjectB:'',preview:'',sendDate:'',sendTime:'',hero:'',body:'',mainCta:'',secCtaCopy:'',secCta:'',open:false};}

//// ============ COMPUTE (Pardot name + tags) ============
function isEvergreen(){return state.campaign.quarter==='na'||state.campaign.year==='na';}
function computeEmail(i){
  const c=state.campaign,e=state.emails[i];
  const reg=findCampaign(c.name);
  const matched=!!reg;
  const ever=isEvergreen();
  const prefix=ever?'':('Q'+(c.quarter||'?')+'-'+(c.year||'YYYY')+' | ');
  const nm=cleanName(c.name)||'Campaign name';
  const num=e.number||String(i+1);
  const pardotName=prefix+nm+(e.hasOrder?(' | Email '+num):'');
  const campaignTag=matched?reg.tag:(ever?('campaign-'+(slug(cleanName(c.name))||'name')):('campaign-'+(slug(cleanName(c.name))||'name')+'-q'+(c.quarter||'?')+'-'+(c.year||'yyyy')));
  const tags=[{t:campaignTag,c:'Campaign',req:true,src:matched?'reg':'doc'}];
  if(e.emailType)tags.push({t:e.emailType,c:'Send Type',req:true,src:'doc'});
  if(e.contentType)tags.push({t:e.contentType,c:'Content Type',req:true,src:'doc'});
  if(e.audience)tags.push({t:e.audience,c:'Audience',req:true,src:'doc'});
  if(e.theme)tags.push({t:e.theme,c:'Theme',req:true,src:'doc'});
  (e.cta||[]).forEach(t=>tags.push({t:t,c:'CTA',req:false,src:'doc'}));
  return {pardotName,tags,matched};
}
function cadenceName(){const c=state.campaign;const reg=findCampaign(c.name);if(!reg||!reg.salesloft)return '';const ever=isEvergreen();return (ever?'':('Q'+(c.quarter||'?')+'-'+(c.year||'YYYY')+' | '))+(c.name||'Campaign name');}
function effPardot(i){const e=state.emails[i];return e.pardotEdited?(e.pardotName||''):computeEmail(i).pardotName;}

//// ============ RENDER ============
function fieldHtml(f,val,key){
  if(f.type==='check'){
    return `<label class="cb-check"><input type="checkbox" data-k="${key}" ${val?'checked':''}><span>${f.l}${f.hint?` <span style="color:var(--ed-mono);opacity:.8">${f.hint}</span>`:''}</span></label>`;
  }
  const lab=f.l?`<span class="cb-fl">${f.l}${f.req?'<span class="rq">*</span>':''}${f.hint?` <span style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.8">${f.hint}</span>`:''}</span>`:'';
  let ctrl;
  if(f.type==='select'){
    const opts=f.opts.map(o=>`<option value="${o[1]}" ${o[1]===val?'selected':''}>${o[0]}</option>`).join('');
    ctrl=`<select data-k="${key}">${f.noEmpty?'':`<option value="">${f.none||'\u2014 select \u2014'}</option>`}${opts}</select>`;
  } else if(f.type==='tokens'){
    const arr=val||[];
    ctrl=`<div class="cb-tokens">${arr.map((t,j)=>`<span class="cb-token">${escH(t)}<button data-rmtoken="${key}|${j}" title="Remove">\u00d7</button></span>`).join('')}<span class="cb-token-add"><input data-addtoken="${key}" placeholder="${f.ph||'Add\u2026'}"><button data-addbtn="${key}">Add</button></span></div>`;
  } else if(f.type==='textarea'){
    ctrl=`<textarea data-k="${key}" class="${f.tall?'tall':''}" placeholder="${f.ph||''}">${val?String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;'):''}</textarea>`;
  } else if(f.type==='chips'){
    ctrl=`<div class="cb-chips" data-k="${key}">${f.opts.map(o=>`<span class="cb-opt ${(val||[]).indexOf(o[1])>=0?'on':''}" data-tag="${o[1]}">${o[0]}</span>`).join('')}</div>`;
  } else if(f.type==='rte'){
    ctrl=`<div class="rte-tools" data-rte-tools="${key}">`
      +`<button type="button" class="rte-btn" data-cmd="bold" title="Bold"><b>B</b></button>`
      +`<button type="button" class="rte-btn" data-cmd="italic" title="Italic"><i>I</i></button>`
      +`<button type="button" class="rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>`
      +`<button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Bulleted list">&bull; List</button>`
      +`<button type="button" class="rte-btn" data-cmd="insertOrderedList" title="Numbered list">1. List</button>`
      +`<button type="button" class="rte-btn" data-cmd="createLink" title="Insert link">Link</button>`
      +`<button type="button" class="rte-btn" data-cmd="removeFormat" title="Clear formatting">Clear</button>`
      +`</div><div class="rte" contenteditable="true" data-rte="${key}" data-ph="${f.ph||''}">${val||''}</div>`;
  } else if(f.type==='datalist'){
    ctrl=`<input list="${f.listId}" data-k="${key}" value="${val?String(val).replace(/"/g,'&quot;'):''}" placeholder="${f.ph||''}" autocomplete="off">`;
  } else if(f.type==='date'){
    ctrl=`<input type="date" data-k="${key}" value="${val||''}">`;
  } else if(f.numeric){
    ctrl=`<input type="number" min="1" step="1" inputmode="numeric" data-k="${key}" value="${val?String(val).replace(/"/g,'&quot;'):''}" placeholder="${f.ph||''}">`;
  } else {
    ctrl=`<input data-k="${key}" value="${val?String(val).replace(/"/g,'&quot;'):''}" placeholder="${f.ph||''}">`;
  }
  return `<div class="cb-f ${f.wide?'wide':''}" data-req="${f.req?1:''}">${lab}${ctrl}</div>`;
}

const campaignFields=[
  {k:'name',l:'Campaign Name',req:true,wide:true,ph:'Imaging Service'},
  {k:'crm',l:'CRM Campaign Link',wide:true,ph:'https://scalecomputing.lightning.force.com/...'},
  {k:'quarter',l:'Quarter',req:true,type:'select',opts:QUARTERS},
  {k:'year',l:'Year',req:true,type:'select',opts:YEARS},
];
const emailGroups=[
  {title:'Tagging — feeds the Tag Builder',fields:[
    {k:'pardotName',l:'Pardot Email Name',hint:'(auto — editable)',wide:true,ph:'Q2-2026 | Campaign | Email 1'},
    {k:'hasOrder',l:'This send has an email order #',type:'check'},
    {k:'number',l:'Email #',numeric:true,ph:'1',onlyIfOrder:true},
    {k:'emailType',l:'Email Type',req:true,type:'select',opts:SENDTYPE},
    {k:'contentType',l:'Content Type',req:true,type:'select',opts:CONTENT},
    {k:'audience',l:'Audience',req:true,type:'select',opts:AUDIENCE},
    {k:'theme',l:'Theme',req:true,type:'select',opts:THEME},
    {k:'ab',l:'A/B Test',type:'select',opts:AB,noEmpty:true},
    {k:'cta',l:'CTA',type:'chips',opts:CTAOPTS,wide:true},
  ]},
  {title:'To — audience & lists',fields:[
    {k:'lists',l:'Lists (Send To)',wide:true,type:'textarea',ph:'One per line\nGlobal - Leads - End User'},
    {k:'suppressionList',l:'Suppression Lists',wide:true,type:'tokens',ph:'Add a suppression list…'},
  ]},
  {title:'From — sender',fields:[
    {k:'senderName',l:'Sender Name',ph:'Scale Computing'},
    {k:'fromEmail',l:'From Email Address',ph:'noreply@scalecomputing.com'},
    {k:'replyTo',l:'Reply-To Email Address',wide:true,ph:'noreply@scalecomputing.com'},
  ]},
  {title:'Subject',fields:[
    {k:'subjectA',l:'Subject Line A',req:true,wide:true},
    {k:'subjectB',l:'Subject Line B',hint:'(if A/B testing)',wide:true},
    {k:'preview',l:'Preview Copy',wide:true,type:'textarea'},
  ]},
  {title:'Schedule',fields:[
    {k:'sendDate',l:'Send Date',type:'date'},
    {k:'sendTime',l:'Send Time',hint:'(pick or type · 15-min steps)',type:'datalist',listId:'timeopts',ph:'10:00 AM EST'},
  ]},
  {title:'Email build',fields:[
    {k:'hero',l:'Hero Image URL',wide:true,ph:'https://info.scalecomputing.com/...'},
    {k:'body',l:'Body Copy',hint:'(rich text)',wide:true,type:'rte',ph:'Write the email body…'},
    {k:'mainCta',l:'Main CTA — button / link',wide:true,ph:'[Get Pricing] → https://www.scalecomputing.com/pricing'},
    {k:'secCtaCopy',l:'Secondary CTA — copy',hint:'(optional)',wide:true,type:'textarea'},
    {k:'secCta',l:'Secondary CTA — button / link',wide:true,ph:'[Schedule a Demo] → https://...'},
  ]},
];
const chev=`<svg class="cb-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderScope(){
  const opts=[['email','Email',true],['form','Pardot Form',true],['cadence','SalesLoft Cadence',true],['qualified','Qualified Experience',true]];
  document.getElementById('scope').innerHTML='<div class="scope-bar"><span class="scope-lbl">This build includes</span>'+
    opts.map(o=>`<button type="button" class="scope-opt ${state.include[o[0]]?'on':''} ${o[2]?'':'soon'}" ${o[2]?`data-scope="${o[0]}"`:'disabled'}>${o[1]}${o[2]?'':' · soon'}</button>`).join('')+'</div>';
}
function showModules(){
  document.getElementById('emailModule').style.display=state.include.email?'':'none';
  const fm=document.getElementById('formModule');
  if(state.include.form){if(!state.form)state.form=newForm();fm.style.display='';renderForm();}else fm.style.display='none';
  const cm=document.getElementById('cadenceModule');
  if(state.include.cadence){if(!state.cadence)state.cadence=newCadence();cm.style.display='';renderCadence();}else cm.style.display='none';
  const qm=document.getElementById('qualifiedModule');
  if(state.include.qualified){if(!state.qualified)state.qualified=newQualified();qm.style.display='';renderQualified();}else qm.style.display='none';
}
function autoFormName(){const c=state.campaign;const ever=isEvergreen();const prefix=ever?'':('Q'+(c.quarter||'?')+'-'+(c.year||'YYYY')+' | ');return prefix+(cleanName(c.name)||'Campaign name');}
function effFormName(){const f=state.form;return f&&f.nameEdited?(f.name||''):autoFormName();}
function updateFormName(){const f=state.form;if(!f||f.nameEdited)return;const auto=autoFormName();f.name=auto;const inp=document.querySelector('[data-k="f.name"]');if(inp&&document.activeElement!==inp)inp.value=auto;}
function autoCadenceName(){const c=state.campaign;const ever=isEvergreen();const prefix=ever?'':('Q'+(c.quarter||'?')+'-'+(c.year||'YYYY')+' | ');return prefix+(cleanName(c.name)||'Campaign name');}
function effCadenceName(){const c=state.cadence;return c&&c.nameEdited?(c.name||''):autoCadenceName();}
function updateCadenceName(){const c=state.cadence;if(!c||c.nameEdited)return;const auto=autoCadenceName();const inp=document.querySelector('[data-k="cad.name"]');if(inp&&document.activeElement!==inp)inp.value=auto;const sub=document.getElementById('cadenceSub');if(sub)sub.textContent='\u00b7 '+auto;}
function autoQualifiedName(){const c=state.campaign;const ever=isEvergreen();const prefix=ever?'':('Q'+(c.quarter||'?')+'-'+(c.year||'YYYY')+' | ');return prefix+(cleanName(c.name)||'Campaign name');}
function effQualifiedName(){const q=state.qualified;return q&&q.nameEdited?(q.name||''):autoQualifiedName();}
function updateQualifiedName(){const q=state.qualified;if(!q||q.nameEdited)return;const auto=autoQualifiedName();const inp=document.querySelector('[data-k="q.name"]');if(inp&&document.activeElement!==inp)inp.value=auto;const sub=document.getElementById('qualifiedSub');if(sub)sub.textContent='\u00b7 '+auto;}
function crmDisplay(){const c=state.campaign;return (escH(c.name||'\u2014'))+(c.crm?(' \u00b7 '+escH(c.crm)):'');}
function updateCrmLine(){const c=state.campaign;const n=document.querySelector('[data-crmname]');if(n)n.innerHTML=escH(c.name||'\u2014');const l=document.querySelector('[data-crmlink]');if(l)l.innerHTML=escH(c.crm||'\u2014');}
const formGroups=[
  {title:'',fields:[
    {k:'name',l:'Pardot Form Name',hint:'(auto — editable)',wide:true,ph:'Q2-2026 | Campaign'},
  ]},
  {title:'',fields:[
    {k:'previewLink',l:'Form Preview Link',wide:true,ph:'https://info.scalecomputing.com/l/...'},
    {k:'iframe',l:'iFrame Code',wide:true,type:'textarea'},
  ]},
  {title:'Completion actions',fields:[
    {k:'source',l:'Source'},{k:'leadSource',l:'Detailed Lead Source'},
    {k:'slack',l:'Notify Slack Channel'},
    {k:'autoresponder',l:'Send Email (Autoresponder)',wide:true,ph:'Autoresponder email name / link'},
    {k:'displayMsg',l:'Display Message',wide:true,type:'textarea'},
  ]},
];
function renderForm(){
  const f=state.form;if(!f)return;
  const detail=formGroups.map(g=>{
    let inner=g.fields.map(fl=>fieldHtml(fl,fl.k==='name'?effFormName():f[fl.k],'f.'+fl.k)).join('');
    if(g.title==='Completion actions'){const note=' <span style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.8">(pulled from campaign)</span>';
      inner+=`<div class="cb-f wide"><span class="cb-fl">Add to CRM Campaign${note}</span><div class="cb-readonly" data-crmname>${escH(state.campaign.name||'\u2014')}</div></div>`
        +`<div class="cb-f wide"><span class="cb-fl">CRM Campaign Link${note}</span><div class="cb-readonly" data-crmlink>${escH(state.campaign.crm||'\u2014')}</div></div>`;}
    return `<div class="cb-group">${g.title?`<div class="cb-glabel">${g.title}</div>`:''}<div class="cb-grid">${inner}</div></div>`;
  });
  const fieldsRows=f.fields.map((fl,j)=>`<div class="ff-row">
    <input class="ff-label" data-ff="${j}" value="${(fl.label||'').replace(/"/g,'&quot;')}" placeholder="Field label…">
    <label class="ff-chk"><input type="checkbox" data-ffreq="${j}" ${fl.req?'checked':''}>Req</label>
    <label class="ff-chk"><input type="checkbox" data-ffcustom="${j}" ${fl.custom?'checked':''}>Custom</label>
    <button class="ff-del" data-ffdel="${j}" title="Remove">\u00d7</button></div>`).join('');
  const fieldsGroup=`<div class="cb-group"><div class="cb-glabel">Form fields</div>
    <div class="ff-list">${fieldsRows}<button type="button" class="cb-add sm" data-ffadd>+ Add field</button></div></div>`;
  const tcGroup=`<div class="cb-group"><div class="cb-glabel">Terms &amp; conditions</div><div class="cb-grid">${fieldHtml({k:'tc',l:'',wide:true,type:'rte',ph:'Enter terms & conditions…'},f.tc,'f.tc')}</div></div>`;
  document.getElementById('formModule').innerHTML=`<section class="cb-card ${f.open?'':'collapsed'}" data-card="form">
    <div class="cb-head" data-toggle="form">${chev}<span class="cb-title">Pardot Form<span class="sub" id="formSub"></span></span></div>
    <div class="cb-body">${detail[0]}${fieldsGroup}${detail[1]}${detail[2]}${tcGroup}</div>
  </section>`;
  const sub=document.getElementById('formSub');if(sub)sub.textContent='· '+effFormName();
}
function renderCadence(){
  const c=state.cadence;if(!c)return;
  const nameField=fieldHtml({k:'name',l:'Internal Flow Name',hint:'(auto — editable)',wide:true,ph:'Q3-2026 | Campaign'},effCadenceName(),'cad.name');
  const steps=c.steps.map((stp,i)=>`<div class="cb-group"><div class="cb-glabel">Email Step ${i+1}${c.steps.length>1?` <button class="ff-del" data-cadstepdel="${i}" title="Remove step">×</button>`:''}</div><div class="cb-grid">${fieldHtml({k:'subject',l:'Subject Line',wide:true,ph:'(blank = reply in thread)'},stp.subject,'cad.'+i+'.subject')}${fieldHtml({k:'body',l:'Body Copy',hint:'(merge tokens ok, e.g. {!firstname})',wide:true,type:'textarea',ph:'Hi {!firstname},…'},stp.body,'cad.'+i+'.body')}</div></div>`).join('');
  document.getElementById('cadenceModule').innerHTML=`<section class="cb-card ${c.open?'':'collapsed'}" data-card="cadence">
    <div class="cb-head" data-toggle="cadence">${chev}<span class="cb-title">SalesLoft Cadence<span class="sub" id="cadenceSub"></span></span></div>
    <div class="cb-body"><div class="cb-group"><div class="cb-grid">${nameField}</div></div>${steps}<button type="button" class="cb-add sm" data-cadstepadd>+ Add email step</button></div>
  </section>`;
  const sub=document.getElementById('cadenceSub');if(sub)sub.textContent='· '+effCadenceName();
}
function renderQualified(){
  const q=state.qualified;if(!q)return;
  const f=(k,l,opts)=>fieldHtml(Object.assign({k:k,l:l},opts||{}),k==='name'?effQualifiedName():q[k],'q.'+k);
  document.getElementById('qualifiedModule').innerHTML=`<section class="cb-card ${q.open?'':'collapsed'}" data-card="qualified">
    <div class="cb-head" data-toggle="qualified">${chev}<span class="cb-title">Qualified Experience<span class="sub" id="qualifiedSub"></span></span></div>
    <div class="cb-body">
      <div class="cb-group"><div class="cb-grid">${f('name','Internal Experience Name',{hint:'(auto — editable)',wide:true})}${f('segment','Page or Audience Segment',{wide:true,type:'textarea',ph:'Which page or audience segment this experience targets'})}</div></div>
      <div class="cb-group"><div class="cb-glabel">Experience copy</div><div class="cb-grid">${f('headline','Headline',{wide:true})}${f('body','Body Copy',{wide:true,type:'textarea'})}${f('imageUrl','Image & Image URL',{wide:true,ph:'https://…'})}${f('subtext','Subtext Below Image',{wide:true})}${f('ctas','CTA Buttons',{hint:'(one per line)',wide:true,type:'textarea',ph:'Book a meeting\nConnect with an expert\nGet Pricing'})}</div></div>
    </div>
  </section>`;
  const sub=document.getElementById('qualifiedSub');if(sub)sub.textContent='· '+effQualifiedName();
}
function renderCampaign(){
  const c=state.campaign,open=state.campaign.open;
  document.getElementById('campaignCard').innerHTML=
    `<section class="cb-card ${open?'':'collapsed'}" data-card="campaign">
      <div class="cb-head" data-toggle="campaign">${chev}<span class="cb-title">Campaign<span class="sub" id="campaignSub"></span></span></div>
      <div class="cb-body"><div class="cb-group"><div class="cb-grid">
        ${campaignFields.map(f=>fieldHtml(f,c[f.k],'c.'+f.k)).join('')}
      </div></div></div>
    </section>`;
}
function renderEmails(){
  document.getElementById('emails').innerHTML=state.emails.map((e,i)=>{
    const groups=emailGroups.map(g=>{const fs=g.fields.filter(f=>!(f.onlyIfOrder&&!e.hasOrder));return `<div class="cb-group"><div class="cb-glabel">${g.title}</div><div class="cb-grid">${fs.map(f=>fieldHtml(f,f.k==='pardotName'?effPardot(i):e[f.k],`e.${i}.${f.k}`)).join('')}</div></div>`;}).join('');
    return `<section class="cb-card ${e.open?'':'collapsed'}" data-card="${i}">
      <div class="cb-head" data-toggle="${i}">${chev}<span class="cb-title"><span data-emailtitle="${i}"></span><span class="sub" data-emailsub="${i}"></span></span>
        <span class="cb-acts"><button class="iconbtn" data-dup="${i}">Duplicate</button>${state.emails.length>1?`<button class="iconbtn danger" data-del="${i}">Remove</button>`:''}</span></div>
      <div class="cb-body">${groups}
        <div class="cb-out">
          <div class="cb-out-lbl">Tags <span class="cb-count" data-tcount="${i}"></span> <button class="cb-copy sm" data-copytags="${i}">Copy all</button></div>
          <div class="cb-tags" data-tags="${i}"></div>
        </div>
      </div>
    </section>`;
  }).join('');
  state.emails.forEach((e,i)=>updateCardOutput(i));
}
function updateCardOutput(i){
  const e=state.emails[i];
  if(!e.pardotEdited){const auto=computeEmail(i).pardotName;e.pardotName=auto;const inp=document.querySelector(`[data-k="e.${i}.pardotName"]`);if(inp&&document.activeElement!==inp)inp.value=auto;}
  const sub=document.querySelector(`[data-emailsub="${i}"]`);if(sub)sub.textContent='· '+effPardot(i);
  const ttl=document.querySelector(`[data-emailtitle="${i}"]`);if(ttl){const aud=e.audience?revLabel(AUDIENCE,e.audience):'';ttl.textContent=aud?('Email - '+aud):('Email '+(i+1));}
  const r=computeEmail(i);
  const tw=document.querySelector(`[data-tags="${i}"]`);
  if(tw){const order=['Campaign','Send Type','Content Type','Audience','Theme','CTA'];const byCat={};r.tags.forEach(x=>{(byCat[x.c]=byCat[x.c]||[]).push(x);});
    tw.innerHTML=order.filter(c=>byCat[c]&&byCat[c].length).map(c=>`<div class="cb-taggroup"><span class="cb-tagcat">${c}</span><div class="cb-tagchips">${byCat[c].map(x=>`<span class="cb-tag${x.req?' req':''}" title="${c}${x.src==='reg'?' · from registry':' · from build doc'}">${escH(x.t)}<span class="src${x.src==='reg'?' reg':''}">${x.src==='reg'?'reg':'doc'}</span></span>`).join('')}</div></div>`).join('');}
  const tc=document.querySelector(`[data-tcount="${i}"]`);if(tc)tc.textContent='· '+r.tags.length;
  window['_tags'+i]=r.tags.map(x=>x.t);
}
function updateAllOutputs(){state.emails.forEach((e,i)=>updateCardOutput(i));updateRegMatch();updateFormName();if(state.cadence)updateCadenceName();if(state.qualified)updateQualifiedName();updateCrmLine();}
function updateRegMatch(){const reg=findCampaign(state.campaign.name);const sub=document.getElementById('campaignSub');if(sub)sub.textContent=reg?'· registry match':'';}
function updateStatus(){
  const inc=state.include;const bits=[];
  if(inc.email)bits.push(`<b>${state.emails.length}</b> email send${state.emails.length!==1?'s':''}`);
  if(inc.form)bits.push('<b>Pardot form</b>');
  if(inc.cadence)bits.push('<b>SalesLoft cadence</b>');
  if(inc.qualified)bits.push('<b>Qualified experience</b>');
  if(!bits.length)bits.push('nothing selected');
  const miss=missingRequired();
  document.getElementById('status').innerHTML=bits.join(' · ')+' · '+
    (miss.length?`<span class="warn">${miss.length} required field${miss.length!==1?'s':''} blank</span>`:`<span class="ok">required fields complete</span>`);
}
function missingRequired(){const m=[];const c=state.campaign;const inc=state.include;
  if(inc.email||inc.form||inc.cadence||inc.qualified){if(!c.name.trim())m.push('Campaign Name');if(!c.quarter)m.push('Quarter');if(!c.year)m.push('Year');}
  if(inc.email)state.emails.forEach((e,i)=>{[['emailType','Email Type'],['contentType','Content Type'],['audience','Audience'],['theme','Theme'],['subjectA','Subject Line A']].forEach(([k,l])=>{if(!String(e[k]||'').trim())m.push('Email '+(i+1)+': '+l);});});
  return m;}

//// ============ IMPORT — read a generated/edited .docx back into state ============
// Works on docs produced by this builder, including after a Google Docs round-trip
// (we parse the visible label/value tables, so edits made in Google Docs are honored).
var CB_WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function cbU16(b,o){return b[o]|(b[o+1]<<8);}
function cbU32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function cbFindEOCD(b){for(var i=b.length-22;i>=0;i--){if(b[i]===0x50&&b[i+1]===0x4b&&b[i+2]===0x05&&b[i+3]===0x06)return i;}return -1;}
function cbReadZip(bytes){
  var b=bytes,eocd=cbFindEOCD(b);
  if(eocd<0)throw new Error('That file isn\u2019t a .docx (no zip directory found).');
  var count=cbU16(b,eocd+10),cdOff=cbU32(b,eocd+16),entries={},p=cdOff,dec=new TextDecoder();
  for(var i=0;i<count;i++){
    if(cbU32(b,p)!==0x02014b50)break;
    var method=cbU16(b,p+10),compSize=cbU32(b,p+20),nameLen=cbU16(b,p+28),extraLen=cbU16(b,p+30),commentLen=cbU16(b,p+32),lho=cbU32(b,p+42);
    var name=dec.decode(b.subarray(p+46,p+46+nameLen));
    entries[name]={method:method,compSize:compSize,lho:lho};
    p+=46+nameLen+extraLen+commentLen;
  }
  return {bytes:b,entries:entries};
}
function cbReadEntry(zip,name){
  var e=zip.entries[name];
  if(!e)throw new Error('That .docx is missing '+name+'.');
  var b=zip.bytes,q=e.lho;
  if(cbU32(b,q)!==0x04034b50)throw new Error('Corrupt .docx (bad header for '+name+').');
  var nameLen=cbU16(b,q+26),extraLen=cbU16(b,q+28),start=q+30+nameLen+extraLen,comp=b.subarray(start,start+e.compSize);
  if(e.method===0)return Promise.resolve(comp.slice());
  if(e.method===8){
    if(typeof DecompressionStream==='undefined')return Promise.reject(new Error('This browser can\u2019t open compressed .docx files \u2014 try Chrome or Edge.'));
    var ds=new DecompressionStream('deflate-raw');
    var stream=new Blob([comp]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function(ab){return new Uint8Array(ab);});
  }
  return Promise.reject(new Error('Unsupported compression in .docx.'));
}
function cbGetDocumentXml(bytes){
  var zip=cbReadZip(bytes);
  return cbReadEntry(zip,'word/document.xml').then(function(u8){return new TextDecoder('utf-8').decode(u8);});
}
function cbGel(node,local){return node.getElementsByTagNameNS(CB_WNS,local);}
function cbParaText(p){var ts=cbGel(p,'t'),s='';for(var i=0;i<ts.length;i++)s+=ts[i].textContent;return s;}
function cbCellParas(tc){var ps=cbGel(tc,'p'),out=[];for(var i=0;i<ps.length;i++)out.push(cbParaText(ps[i]));return out;}
function cbDirectCells(tr){var out=[],k=tr.childNodes;for(var i=0;i<k.length;i++){var n=k[i];if(n.nodeType===1&&n.namespaceURI===CB_WNS&&n.localName==='tc')out.push(n);}return out;}
function cbLabelToValue(opts,label){if(label==null)return '';var t=String(label).trim().toLowerCase();for(var i=0;i<opts.length;i++)if(String(opts[i][0]).trim().toLowerCase()===t)return opts[i][1];return '';}
function cbUnfmtDate(v){var m=String(v||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return '';var mm=('0'+m[1]).slice(-2),dd=('0'+m[2]).slice(-2);return m[3]+'-'+mm+'-'+dd;}
function cbParasToHtml(paras){
  if(!paras||!paras.length)return '';
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  var out=[],listType=null,buf=[];
  function flush(){if(listType){out.push('<'+listType+'>'+buf.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</'+listType+'>');buf=[];listType=null;}}
  for(var i=0;i<paras.length;i++){
    var line=paras[i]==null?'':String(paras[i]);
    var ulm=line.match(/^\s*\u2022\s+(.*)$/),olm=line.match(/^\s*\d+\.\s+(.*)$/);
    if(ulm){if(listType&&listType!=='ul')flush();listType='ul';buf.push(ulm[1]);}
    else if(olm){if(listType&&listType!=='ol')flush();listType='ol';buf.push(olm[1]);}
    else{flush();if(line.trim()==='')out.push('<div><br></div>');else out.push('<div>'+esc(line)+'</div>');}
  }
  flush();
  return out.join('');
}
function cbParseBuildDoc(xml){
  var doc=new DOMParser().parseFromString(xml,'application/xml');
  var tbls=cbGel(doc,'tbl'),sections=[];
  for(var i=0;i<tbls.length;i++){
    var trs=cbGel(tbls[i],'tr'),rows=[];
    for(var r=0;r<trs.length;r++){rows.push(cbDirectCells(trs[r]).map(cbCellParas));}
    if(!rows.length)continue;
    var title=((rows[0][0]||[]).join(' ')).trim();
    sections.push({title:title,rows:rows});
  }
  function mapOf(sec){var m={};for(var r=1;r<sec.rows.length;r++){var c=sec.rows[r];if(c.length<2)continue;var label=((c[0]||[]).join(' ')).replace(/\s*\*+\s*$/,'').trim();m[label]={text:(c[1]||[]).join('\n'),paras:c[1]||[]};}return m;}
  function v(m,l){return m[l]?m[l].text:'';}
  var st={include:{email:false,form:false,cadence:false,qualified:false},campaign:{name:'',crm:'',quarter:'',year:'',open:true},emails:[],form:null,cadence:null,qualified:null};
  var warn=[],cur=null;
  for(var s=0;s<sections.length;s++){
    var sec=sections[s],t=sec.title,m;
    if(t==='Campaign'){m=mapOf(sec);
      st.campaign.name=v(m,'Campaign Name');st.campaign.crm=v(m,'CRM Campaign Link');
      st.campaign.quarter=cbLabelToValue(QUARTERS,v(m,'Quarter'));st.campaign.year=cbLabelToValue(YEARS,v(m,'Year'));
    } else if(t==='Basic email information'){cur=newEmail();cur.open=false;st.emails.push(cur);m=mapOf(sec);
      var pn=v(m,'Pardot Email Name');if(pn)cur.pardotName=pn;
    } else if(cur&&t.indexOf('Tagging')===0){m=mapOf(sec);
      if(m['Email #']){cur.hasOrder=true;cur.number=v(m,'Email #');}else{cur.hasOrder=false;}
      var sel=[['Email Type',SENDTYPE,'emailType'],['Content Type',CONTENT,'contentType'],['Audience',AUDIENCE,'audience'],['Theme',THEME,'theme']];
      for(var x=0;x<sel.length;x++){var raw=v(m,sel[x][0]),vv=cbLabelToValue(sel[x][1],raw);cur[sel[x][2]]=vv;if(raw&&!vv)warn.push('Email '+st.emails.length+' \u2014 '+sel[x][0]+': "'+raw+'" not recognized');}
      cur.ab=/yes/i.test(v(m,'A/B Test'))?'Yes':'No';
      var ctaStr=v(m,'CTA');cur.cta=ctaStr?ctaStr.split(/,\s*/).map(function(c){return cbLabelToValue(CTAOPTS,c.trim());}).filter(Boolean):[];
    } else if(cur&&t.indexOf('To')===0){m=mapOf(sec);
      cur.lists=v(m,'Lists (Send To)');var sup=v(m,'Suppression Lists');cur.suppressionList=sup?sup.split('\n').map(function(s2){return s2.trim();}).filter(Boolean):[];
    } else if(cur&&t.indexOf('From')===0){m=mapOf(sec);
      cur.senderName=v(m,'Sender Name')||cur.senderName;cur.fromEmail=v(m,'From Email Address')||cur.fromEmail;cur.replyTo=v(m,'Reply-To Email Address')||cur.replyTo;
    } else if(cur&&t==='Subject'){m=mapOf(sec);
      cur.subjectA=v(m,'Subject Line A');cur.subjectB=v(m,'Subject Line B');cur.preview=v(m,'Preview Copy');
    } else if(cur&&t==='External'){m=mapOf(sec);
      cur.sendDate=cbUnfmtDate(v(m,'Send Date (MM/DD/YYYY)'));cur.sendTime=v(m,'Send Time');
    } else if(cur&&t==='Email build'){m=mapOf(sec);
      cur.hero=v(m,'Hero Image');cur.body=cbParasToHtml(m['Body Copy']?m['Body Copy'].paras:[]);
      cur.mainCta=v(m,'Main CTA');cur.secCtaCopy=v(m,'Secondary CTA Copy');cur.secCta=v(m,'Secondary CTA');
    } else if(t==='Pardot Form'){if(!st.form)st.form=newForm();st.form.open=false;m=mapOf(sec);var nm=v(m,'Internal Name');if(nm)st.form.name=nm;
    } else if(st.form&&t==='Form Fields'){var fields=[];
      for(var r2=1;r2<sec.rows.length;r2++){var c2=sec.rows[r2];if(c2.length<2)continue;var lab=((c2[0]||[]).join(' ')).trim(),val2=(c2[1]||[]).join(' ');if(lab==='\u2014'||/No fields added/i.test(val2))continue;fields.push({label:lab,req:/Required/i.test(val2),custom:/Custom/i.test(val2)});}
      if(fields.length)st.form.fields=fields;
    } else if(st.form&&t.indexOf('Form Link')===0){m=mapOf(sec);st.form.previewLink=v(m,'Form Preview Link');st.form.iframe=v(m,'iFrame Code');
    } else if(st.form&&t.indexOf('Completion')===0){m=mapOf(sec);
      st.form.source=v(m,'Source')||st.form.source;st.form.leadSource=v(m,'Detailed Lead Source')||st.form.leadSource;st.form.slack=v(m,'Notify Slack Channel')||st.form.slack;
      st.form.autoresponder=v(m,'Send Email (Autoresponder)');st.form.displayMsg=v(m,'Display Message')||st.form.displayMsg;
    } else if(st.form&&t.indexOf('Terms')===0){m=mapOf(sec);st.form.tc=cbParasToHtml(m['Terms & Conditions']?m['Terms & Conditions'].paras:[]);
    } else if(t==='SalesLoft Cadence'){if(!st.cadence)st.cadence=newCadence();st.cadence.steps=[];st.cadence.open=false;m=mapOf(sec);var fn=v(m,'Internal Flow Name');if(fn)st.cadence.name=fn;
    } else if(st.cadence&&/^Email Step \d+$/.test(t)){m=mapOf(sec);st.cadence.steps.push({subject:v(m,'Subject Line'),body:(m['Body Copy']?m['Body Copy'].paras.join('\n'):'')});
    } else if(t==='Qualified Experience'){if(!st.qualified)st.qualified=newQualified();st.qualified.open=false;m=mapOf(sec);var qn=v(m,'Internal Experience Name');if(qn)st.qualified.name=qn;st.qualified.segment=v(m,'Page or Audience Segment')||st.qualified.segment;
    } else if(st.qualified&&t==='Experience Copy'){m=mapOf(sec);st.qualified.headline=v(m,'Headline');st.qualified.body=(m['Body Copy']?m['Body Copy'].paras.join('\n'):'');st.qualified.imageUrl=v(m,'Image & Image URL');st.qualified.subtext=v(m,'Subtext Below Image');st.qualified.ctas=(m['CTA Buttons']?m['CTA Buttons'].paras.join('\n'):'');}
  }
  st.include.email=st.emails.length>0;st.include.form=!!st.form;st.include.cadence=!!st.cadence;st.include.qualified=!!st.qualified;
  if(st.cadence&&(!st.cadence.steps||!st.cadence.steps.length))st.cadence.steps=[{subject:'',body:''}];
  if(!st.emails.length&&!st.form&&!st.cadence&&!st.qualified)throw new Error('No campaign build content was found in that document.');
  return {state:st,warnings:warn};
}
function applyImportedState(ns){
  state.include.email=!!ns.include.email;state.include.form=!!ns.include.form;
  state.campaign.name=ns.campaign.name||'';state.campaign.crm=ns.campaign.crm||'';
  state.campaign.quarter=ns.campaign.quarter||'';state.campaign.year=ns.campaign.year||'';state.campaign.open=true;
  state.emails.length=0;(ns.emails||[]).forEach(function(e){state.emails.push(e);});
  state.form=ns.form||null;
  state.include.cadence=!!ns.include.cadence;state.include.qualified=!!ns.include.qualified;state.cadence=ns.cadence||null;state.qualified=ns.qualified||null;
  state.emails.forEach(function(e,i){var auto=computeEmail(i).pardotName;if(e.pardotName&&e.pardotName.trim()&&e.pardotName.trim()!==auto.trim())e.pardotEdited=true;else{e.pardotEdited=false;e.pardotName='';}});
  if(state.form){var fa=autoFormName();if(state.form.name&&state.form.name.trim()&&state.form.name.trim()!==fa.trim())state.form.nameEdited=true;else{state.form.nameEdited=false;state.form.name='';}}
  if(state.cadence){var ca=autoCadenceName();if(state.cadence.name&&state.cadence.name.trim()&&state.cadence.name.trim()!==ca.trim())state.cadence.nameEdited=true;else{state.cadence.nameEdited=false;state.cadence.name='';}if(!state.cadence.steps||!state.cadence.steps.length)state.cadence.steps=[{subject:'',body:''}];}
  if(state.qualified){var qa=autoQualifiedName();if(state.qualified.name&&state.qualified.name.trim()&&state.qualified.name.trim()!==qa.trim())state.qualified.nameEdited=true;else{state.qualified.nameEdited=false;state.qualified.name='';}}
  if(state.include.email&&!state.emails.length)state.emails.push(newEmail());
  renderScope();renderCampaign();renderEmails();showModules();updateAllOutputs();updateStatus();
}

//// ============ DRAFT PERSISTENCE (autosave + JSON save/load) ============
var CB_DRAFT_KEY='scb-campaign-builder-draft-v1';
function cbMerge(base,obj){if(obj&&typeof obj==='object'){for(var k in obj)base[k]=obj[k];}return base;}
function cbRestoreState(ns){
  if(!ns||typeof ns!=='object')return false;
  var inc=ns.include||{};
  state.include={email:!!inc.email,form:!!inc.form,cadence:!!inc.cadence,qualified:!!inc.qualified};
  state.campaign=cbMerge({name:'',crm:'',quarter:'',year:'',open:true},ns.campaign);
  state.emails.length=0;(ns.emails||[]).forEach(function(e){state.emails.push(cbMerge(newEmail(),e));});
  state.form=ns.form?cbMerge(newForm(),ns.form):null;
  state.cadence=ns.cadence?cbMerge(newCadence(),ns.cadence):null;
  state.qualified=ns.qualified?cbMerge(newQualified(),ns.qualified):null;
  if(state.cadence&&(!state.cadence.steps||!state.cadence.steps.length))state.cadence.steps=[{subject:'',body:''}];
  if(state.include.email&&!state.emails.length)state.emails.push(newEmail());
  return true;
}
function cbRepaint(){renderScope();renderCampaign();renderEmails();showModules();updateAllOutputs();updateStatus();}
function cbDraftObj(){return {format:'sc-campaign-builder-draft',version:1,savedAt:new Date().toISOString(),state:state};}
var cbSaveT=null;
function cbScheduleSave(){if(cbSaveT)clearTimeout(cbSaveT);cbSaveT=setTimeout(cbSaveNow,700);}
function cbSaveNow(){try{localStorage.setItem(CB_DRAFT_KEY,JSON.stringify(cbDraftObj()));cbFlashDraft('Draft saved');}catch(e){}}
function cbFlashDraft(msg){var el=document.getElementById('cbDraftState');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(cbFlashDraft._t);cbFlashDraft._t=setTimeout(function(){el.classList.remove('show');},1800);}
function cbLoadAutosave(){try{var raw=localStorage.getItem(CB_DRAFT_KEY);if(!raw)return false;var obj=JSON.parse(raw);return cbRestoreState(obj&&obj.state?obj.state:obj);}catch(e){return false;}}
function cbClearDraft(){try{localStorage.removeItem(CB_DRAFT_KEY);}catch(e){}}
function cbDownloadDraft(){
  var nm=(state.campaign.name||'Campaign').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'Campaign';
  try{var blob=new Blob([JSON.stringify(cbDraftObj(),null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=nm+'_builder-draft.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);
    toast('Draft saved \u00b7 '+nm+'_builder-draft.json');
  }catch(e){toast('Could not save the draft file');}
}
function cbLoadDraftFile(file){var r=new FileReader();r.onload=function(){try{var obj=JSON.parse(r.result);var ns=obj&&obj.state?obj.state:obj;if(cbRestoreState(ns)){cbRepaint();cbSaveNow();toast('Draft loaded');}else toast('That file isn\u2019t a builder draft');}catch(e){toast('Could not read that draft file');}};r.readAsText(file);}
function cbStartFresh(){if(!confirm('Clear the current build and the saved draft, and start fresh?'))return;cbClearDraft();state.include={email:true,form:false,cadence:false,qualified:false};state.campaign={name:'',crm:'',quarter:'',year:'',open:true};state.emails.length=0;state.emails.push(newEmail());state.form=null;state.cadence=null;state.qualified=null;cbRepaint();cbClearDraft();toast('Started fresh');}

//// ============ EVENTS ============
document.addEventListener('input',ev=>{if(!(ev.target.closest&&ev.target.closest('#p-builder')))return;
  cbScheduleSave();
  const rte=ev.target.getAttribute&&ev.target.getAttribute('data-rte');
  if(rte){setRte(rte,ev.target.innerHTML);return;}
  const ff=ev.target.getAttribute&&ev.target.getAttribute('data-ff');
  if(ff!==null&&ff!==undefined&&ev.target.classList.contains('ff-label')){state.form.fields[+ff].label=ev.target.value;return;}
  const k=ev.target.getAttribute('data-k');if(!k)return;
  if(ev.target.type==='checkbox')return;
  if(k.startsWith('c.')){state.campaign[k.slice(2)]=ev.target.value;updateAllOutputs();updateStatus();}
  else if(k.startsWith('e.')){const p=k.split('.');const i=+p[1];const key=p[2];
    if(key==='pardotName'){const v=ev.target.value;state.emails[i].pardotName=v;state.emails[i].pardotEdited=v.trim()!=='';
      if(!state.emails[i].pardotEdited)updateCardOutput(i);
      const sub=document.querySelector(`[data-emailsub="${i}"]`);if(sub)sub.textContent='· '+effPardot(i);return;}
    state.emails[i][key]=ev.target.value;updateCardOutput(i);updateStatus();}
  else if(k.startsWith('f.')){const key=k.slice(2);
    if(key==='name'){const v=ev.target.value;state.form.name=v;state.form.nameEdited=v.trim()!=='';if(!state.form.nameEdited)updateFormName();const sub=document.getElementById('formSub');if(sub)sub.textContent='· '+effFormName();return;}
    state.form[key]=ev.target.value;}
  else if(k.startsWith('cad.')){const rest=k.slice(4);
    if(rest==='name'){const v=ev.target.value;state.cadence.name=v;state.cadence.nameEdited=v.trim()!=='';if(!state.cadence.nameEdited)updateCadenceName();const sub=document.getElementById('cadenceSub');if(sub)sub.textContent='· '+effCadenceName();return;}
    const p=rest.split('.');state.cadence.steps[+p[0]][p[1]]=ev.target.value;}
  else if(k.startsWith('q.')){const key=k.slice(2);
    if(key==='name'){const v=ev.target.value;state.qualified.name=v;state.qualified.nameEdited=v.trim()!=='';if(!state.qualified.nameEdited)updateQualifiedName();const sub=document.getElementById('qualifiedSub');if(sub)sub.textContent='· '+effQualifiedName();return;}
    state.qualified[key]=ev.target.value;}
});
document.addEventListener('change',ev=>{if(!(ev.target.closest&&ev.target.closest('#p-builder')))return;
  cbScheduleSave();
  const ffr=ev.target.getAttribute&&ev.target.getAttribute('data-ffreq');if(ffr!==null&&ffr!==undefined){state.form.fields[+ffr].req=ev.target.checked;return;}
  const ffc=ev.target.getAttribute&&ev.target.getAttribute('data-ffcustom');if(ffc!==null&&ffc!==undefined){state.form.fields[+ffc].custom=ev.target.checked;return;}
  const k=ev.target.getAttribute('data-k');if(!k)return;
  if(ev.target.type==='checkbox'&&k.startsWith('e.')){const p=k.split('.');const i=+p[1];state.emails[i][p[2]]=ev.target.checked;renderEmails();updateStatus();return;}
  if(k.startsWith('c.')){state.campaign[k.slice(2)]=ev.target.value;updateAllOutputs();updateStatus();}
  else if(k.startsWith('e.')){const p=k.split('.');const i=+p[1];if(p[2]==='pardotName')return;state.emails[i][p[2]]=ev.target.value;updateCardOutput(i);updateStatus();}
  else if(k.startsWith('f.')){const key=k.slice(2);state.form[key]=ev.target.value;}
});
document.addEventListener('keydown',ev=>{if(!(ev.target.closest&&ev.target.closest('#p-builder')))return;const k=ev.target.getAttribute&&ev.target.getAttribute('data-addtoken');if(k&&ev.key==='Enter'){ev.preventDefault();addToken(k);}});
function addToken(key){const inp=document.querySelector(`[data-addtoken="${key}"]`);if(!inp)return;const v=inp.value.trim();if(!v)return;const p=key.split('.');const i=+p[1];state.emails[i][p[2]].push(v);renderEmails();}
function setRte(key,html){const p=key.split('.');if(p[0]==='e')state.emails[+p[1]].body=html;else if(p[0]==='f')state.form[p[1]]=html;}
document.addEventListener('mousedown',ev=>{if(!(ev.target.closest&&ev.target.closest('#p-builder')))return;if(ev.target.closest('.rte-btn'))ev.preventDefault();});
document.addEventListener('click',ev=>{if(!(ev.target.closest&&ev.target.closest('#p-builder')))return;
  cbScheduleSave();
  const rbtn=ev.target.closest('.rte-btn');
  if(rbtn){const cmd=rbtn.getAttribute('data-cmd');const tools=rbtn.closest('[data-rte-tools]');const key=tools.getAttribute('data-rte-tools');const ed=document.querySelector(`[data-rte="${key}"]`);
    if(ed){ed.focus();if(cmd==='createLink'){const url=prompt('Link URL:','https://');if(url)document.execCommand('createLink',false,url);}else{document.execCommand(cmd,false,null);}setRte(key,ed.innerHTML);}return;}
  const opt=ev.target.closest('.cb-opt');
  if(opt){const wrap=opt.closest('[data-k]');const k=wrap.getAttribute('data-k');const p=k.split('.');const i=+p[1];const tag=opt.getAttribute('data-tag');
    const arr=state.emails[i].cta;const idx=arr.indexOf(tag);if(idx>=0)arr.splice(idx,1);else arr.push(tag);opt.classList.toggle('on');updateCardOutput(i);return;}
  const rmt=ev.target.closest('[data-rmtoken]');if(rmt){const parts=rmt.getAttribute('data-rmtoken').split('|');const p=parts[0].split('.');const i=+p[1];state.emails[i][p[2]].splice(+parts[1],1);renderEmails();return;}
  const addb=ev.target.closest('[data-addbtn]');if(addb){addToken(addb.getAttribute('data-addbtn'));return;}
  const dup=ev.target.closest('[data-dup]');if(dup){const i=+dup.getAttribute('data-dup');const copy=JSON.parse(JSON.stringify(state.emails[i]));copy.open=true;copy.number='';state.emails.splice(i+1,0,copy);renderEmails();updateStatus();return;}
  const del=ev.target.closest('[data-del]');if(del){const i=+del.getAttribute('data-del');state.emails.splice(i,1);renderEmails();updateStatus();return;}
  const sc=ev.target.closest('[data-scope]');if(sc){const key=sc.getAttribute('data-scope');state.include[key]=!state.include[key];renderScope();showModules();updateStatus();return;}
  const ffadd=ev.target.closest('[data-ffadd]');if(ffadd){state.form.fields.push({label:'',req:false,custom:true});renderForm();return;}
  const ffdel=ev.target.closest('[data-ffdel]');if(ffdel){state.form.fields.splice(+ffdel.getAttribute('data-ffdel'),1);renderForm();return;}
  const ct=ev.target.closest('[data-copytags]');if(ct){const i=ct.getAttribute('data-copytags');copyText((window['_tags'+i]||[]).join(', '),ct);return;}
  const csa=ev.target.closest('[data-cadstepadd]');if(csa){state.cadence.steps.push({subject:'',body:''});renderCadence();return;}
  const csd=ev.target.closest('[data-cadstepdel]');if(csd){state.cadence.steps.splice(+csd.getAttribute('data-cadstepdel'),1);renderCadence();return;}
  const tog=ev.target.closest('[data-toggle]');
  if(tog){const id=tog.getAttribute('data-toggle');const card=tog.closest('.cb-card');card.classList.toggle('collapsed');const collapsed=card.classList.contains('collapsed');
    if(id==='campaign')state.campaign.open=!collapsed;else if(id==='form')state.form.open=!collapsed;else if(id==='cadence')state.cadence.open=!collapsed;else if(id==='qualified')state.qualified.open=!collapsed;else state.emails[+id].open=!collapsed;return;}
});
function copyText(t,btn){function done(){if(btn){btn.classList.add('copied');const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>{btn.classList.remove('copied');btn.textContent=o;},1100);}}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done).catch(()=>{});else done();}

document.getElementById('addEmail').addEventListener('click',()=>{const e=newEmail();e.open=true;state.emails.push(e);renderEmails();updateStatus();window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});});

document.getElementById('generate').addEventListener('click',async()=>{
  if(!state.include.email&&!state.include.form&&!state.include.cadence&&!state.include.qualified){alert('Select at least one thing to include (Email, Pardot Form, SalesLoft Cadence, or Qualified Experience) at the top.');return;}
  const miss=missingRequired();
  if(miss.length&&!confirm(miss.length+' required field(s) still blank:\n\n'+miss.slice(0,12).join('\n')+(miss.length>12?'\n…':'')+'\n\nGenerate anyway?'))return;
  try{
    const c=state.campaign;const inc=state.include;
    const data={include:{email:inc.email,form:inc.form,cadence:inc.cadence,qualified:inc.qualified},campaign:{name:c.name,crm:c.crm,quarterLabel:revLabel(QUARTERS,c.quarter),yearLabel:revLabel(YEARS,c.year)},
      emails:state.emails.map((e,i)=>{const r=computeEmail(i);return{
        number:e.hasOrder?(e.number||String(i+1)):'',hasOrder:e.hasOrder,pardotName:effPardot(i),tags:r.tags.map(x=>x.t).join(', '),
        emailType:revLabel(SENDTYPE,e.emailType),contentType:revLabel(CONTENT,e.contentType),audience:revLabel(AUDIENCE,e.audience),
        theme:revLabel(THEME,e.theme),abTest:e.ab||'No',
        cta:(e.cta||[]).map(t=>revLabel(CTAOPTS,t)).join(', '),
        lists:e.lists,suppression:(e.suppressionList||[]).join('\n'),senderName:e.senderName,fromEmail:e.fromEmail,replyTo:e.replyTo,
        subjectA:e.subjectA,subjectB:e.subjectB,preview:e.preview,sendDate:fmtDate(e.sendDate),sendTime:e.sendTime,
        hero:e.hero,body:e.body,mainCta:e.mainCta,secCtaCopy:e.secCtaCopy,secCta:e.secCta};})};
    if(inc.form&&state.form){const f=state.form;
      data.form={name:effFormName(),fields:f.fields.map(x=>({label:x.label,req:x.req,custom:x.custom})),
        previewLink:f.previewLink,iframe:f.iframe,source:f.source,leadSource:f.leadSource,slack:f.slack,
        autoresponder:f.autoresponder,displayMsg:f.displayMsg,tc:f.tc};}
    if(inc.cadence&&state.cadence){const cd=state.cadence;data.cadence={name:effCadenceName(),steps:(cd.steps||[]).map(stp=>({subject:stp.subject,body:stp.body}))};}
    if(inc.qualified&&state.qualified){const qd=state.qualified;data.qualified={name:effQualifiedName(),segment:qd.segment,headline:qd.headline,body:qd.body,imageUrl:qd.imageUrl,subtext:qd.subtext,ctas:qd.ctas};}
    let logo=null;
    try{const resp=await fetch(LOGO_URL,{mode:'cors'});if(resp&&resp.ok){const buf=new Uint8Array(await resp.arrayBuffer());const dim=pngSize(buf);if(dim)logo={bytes:buf,w:dim.w,h:dim.h};}}catch(e){/* logo blocked — fall back to text wordmark */}
    const bytes=buildDocx(data,logo);
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url=URL.createObjectURL(blob);
    const safe=(c.name||'Campaign').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'Campaign';
    const a=document.createElement('a');a.href=url;a.download=safe+'_Campaign_Build.docx';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    toast('Word doc generated · check your downloads');
  }catch(err){console.error(err);toast('Something went wrong generating the doc');}
});
let toastT;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);}

var _impBtn=document.getElementById('importBtn'),_impFile=document.getElementById('importFile');
if(_impBtn&&_impFile){
  _impBtn.addEventListener('click',function(){_impFile.value='';_impFile.click();});
  _impFile.addEventListener('change',async function(ev){
    var f=ev.target.files&&ev.target.files[0];if(!f)return;
    try{
      var buf=new Uint8Array(await f.arrayBuffer());
      var xml=await cbGetDocumentXml(buf);
      var res=cbParseBuildDoc(xml);
      applyImportedState(res.state);
      var n=state.emails.length;
      var bits=[];if(state.include.email)bits.push(n+' email'+(n!==1?'s':''));if(state.include.form)bits.push('form');
      toast('Imported \u00b7 '+(bits.join(' + ')||'build doc'));
      if(res.warnings&&res.warnings.length){console.warn('Import \u2014 review:',res.warnings);setTimeout(function(){alert(res.warnings.length+' field(s) need a quick look (value not in the current option list):\n\n'+res.warnings.slice(0,12).join('\n')+(res.warnings.length>12?'\n\u2026':''));},80);}
      try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}
    }catch(err){console.error(err);toast(err&&err.message?err.message:'Could not read that .docx');}
  });
}

// draft controls (direct element listeners — independent of the guarded document handlers)
(function(){
  var sb=document.getElementById('cbSaveDraftBtn'),lb=document.getElementById('cbLoadDraftBtn'),sf=document.getElementById('cbStartFresh'),df=document.getElementById('cbDraftFile');
  if(sb)sb.addEventListener('click',cbDownloadDraft);
  if(lb&&df)lb.addEventListener('click',function(){df.value='';df.click();});
  if(df)df.addEventListener('change',function(ev){var f=ev.target.files&&ev.target.files[0];if(f)cbLoadDraftFile(f);});
  if(sf)sf.addEventListener('click',cbStartFresh);
  window.addEventListener('beforeunload',cbSaveNow);
})();

// init — restore a saved draft if present, else start with one empty email
document.getElementById('timeopts').innerHTML=TIME_OPTS.map(t=>`<option value="${t}"></option>`).join('');
var _cbRestored=cbLoadAutosave();
if(!_cbRestored)state.emails.push(newEmail());
renderScope();renderCampaign();renderEmails();showModules();updateAllOutputs();updateStatus();
if(_cbRestored)setTimeout(function(){cbFlashDraft('Draft restored');},300);

})();
