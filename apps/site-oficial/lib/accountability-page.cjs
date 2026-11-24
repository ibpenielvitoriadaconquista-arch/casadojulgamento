'use strict';
const {createHash}=require('node:crypto');

const REPORT_SLUG='casa-do-julgamento-2026';
const MAX_BYTES=512*1024;

function validEncryptedPage(row){
 if(typeof row?.encrypted_html!=='string'||typeof row.sha256!=='string')return false;
 const html=row.encrypted_html;
 return Buffer.byteLength(html,'utf8')<=MAX_BYTES&&
  createHash('sha256').update(html,'utf8').digest('hex')===row.sha256&&
  /cipher=bytes\("[A-Za-z0-9+/=]+"\)/.test(html)&&
  html.includes('PBKDF2')&&html.includes('AES-GCM');
}

function createHandler({query}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){
   res.setHeader('Allow','GET, HEAD');
   return res.status(405).end();
  }
  try{
   const result=await query('SELECT encrypted_html,sha256 FROM peniel_ops.encrypted_report_pages WHERE slug=$1',[REPORT_SLUG]);
   const row=result.rows[0];
   if(!validEncryptedPage(row))throw Error('Report unavailable');
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return req.method==='HEAD'?res.status(200).end():res.status(200).send(row.encrypted_html);
  }catch{
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   return req.method==='HEAD'?res.status(503).end():res.status(503).send('Prestação de contas indisponível no momento. Tente novamente.');
  }
 };
}

module.exports={REPORT_SLUG,createHandler,validEncryptedPage};
