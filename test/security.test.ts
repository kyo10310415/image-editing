import test from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { securityBoundary, imageInputBoundary, validateImageDataUrl, uploadedImageDataUrl } from '../src/security.js'
import { bodyLimit } from 'hono/body-limit'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII='
test('valid uploaded PNG accepted; local paths, remote URLs and SVG rejected',async()=>{
  assert.equal(validateImageDataUrl(png),png)
  for(const input of ['http://127.0.0.1/a','https://example.com/a','/etc/image.png','file:///a','data:image/svg+xml;base64,PHN2Zy8+',null]) assert.throws(()=>validateImageDataUrl(input))
  assert.equal(await uploadedImageDataUrl(new File([Buffer.from(png.split(',')[1],'base64')],'image.png',{type:'image/png'})),png)
})
test('rejects oversized dimensions, fake MIME and malformed base64',()=>{
  const bytes = Buffer.from(png.split(',')[1],'base64'); bytes.writeUInt32BE(9000,16)
  assert.throws(()=>validateImageDataUrl(`data:image/png;base64,${bytes.toString('base64')}`))
  assert.throws(()=>validateImageDataUrl(png.replace('image/png','image/jpeg')))
  assert.throws(()=>validateImageDataUrl(png+'a'))
})
const env={IMAGE_ADMIN_USERNAME:'test-admin',IMAGE_ADMIN_PASSWORD:'test-only-placeholder-password-123456789',IMAGE_PUBLIC_ORIGIN:'https://images.example.test'}
const authorization=`Basic ${Buffer.from(`${env.IMAGE_ADMIN_USERNAME}:${env.IMAGE_ADMIN_PASSWORD}`).toString('base64')}`
test('missing configuration fails closed; anonymous UI and APIs denied',async()=>{
  for(const config of [{}, {...env,IMAGE_ADMIN_PASSWORD:'short'}]){
    const app=new Hono();app.use('*',securityBoundary(config));app.get('/',c=>c.text('unsafe'))
    assert.equal((await app.request('/')).status,503)
  }
  const app=new Hono();app.use('*',securityBoundary(env));app.all('*',c=>c.text('ok'))
  for(const path of ['/','/api/execute-generation','/static/app.js']) assert.equal((await app.request(path)).status,401)
  assert.equal((await app.request('/',{headers:{authorization}})).status,200)
})
test('CSRF origin and global request budget gate authenticated writes',async()=>{
  let calls=0;const app=new Hono();app.use('*',securityBoundary(env));app.post('/api/run',c=>{calls++;return c.text('ok')})
  assert.equal((await app.request('/api/run',{method:'POST',headers:{authorization,origin:'https://evil.test'}})).status,403)
  assert.equal(calls,0)
  for(let i=0;i<60;i++) assert.equal((await app.request('/api/run',{method:'POST',headers:{authorization,origin:env.IMAGE_PUBLIC_ORIGIN}})).status,200)
  assert.equal((await app.request('/api/run',{method:'POST',headers:{authorization,origin:env.IMAGE_PUBLIC_ORIGIN}})).status,429)
  assert.equal(calls,60)
})
test('actual input middleware blocks URL and bad uploads before processing',async()=>{
  let calls=0;const app=new Hono()
  app.use('*',securityBoundary(env));app.use('/api/*',bodyLimit({maxSize:12*1024*1024}));app.use('/api/*',imageInputBoundary)
  app.post('/api/*',c=>{calls++;return c.text('processed')})
  const headers={authorization,origin:env.IMAGE_PUBLIC_ORIGIN,'content-type':'application/json'}
  for(const path of ['/api/execute-generation','/api/execute-generation-ai']){
    for(const imageUrl of ['http://169.254.169.254/a','/tmp/private.png','https://example.com/a']) assert.equal((await app.request(path,{method:'POST',headers,body:JSON.stringify({imageUrl})})).status,400)
    assert.equal((await app.request(path,{method:'POST',headers,body:JSON.stringify({imageUrl:png})})).status,200)
  }
  assert.equal(calls,2)
  assert.equal((await app.request('/api/generate-batch-url',{method:'POST',headers,body:'{}'})).status,410)
  const form=new FormData();form.set('image',new File(['not an image'],'test.png',{type:'image/png'}))
  assert.equal((await app.request('/api/generate-image',{method:'POST',headers:{authorization,origin:env.IMAGE_PUBLIC_ORIGIN},body:form})).status,400)
  assert.equal((await app.request('/api/execute-generation',{method:'POST',headers,body:'x'.repeat(12*1024*1024+1)})).status,413)
  assert.equal(calls,2)
})
test('concurrency limit rejects a third operation and releases slots after completion',async()=>{
  let release:()=>void=()=>{};const hold=new Promise<void>(resolve=>{release=resolve})
  const app=new Hono();app.use('*',securityBoundary(env));app.post('/run',async c=>{await hold;return c.text('ok')})
  const options={method:'POST',headers:{authorization,origin:env.IMAGE_PUBLIC_ORIGIN}}
  const first=app.request('/run',options),second=app.request('/run',options)
  assert.equal((await app.request('/run',options)).status,429)
  release();assert.equal((await first).status,200);assert.equal((await second).status,200)
  assert.equal((await app.request('/run',options)).status,200)
})
