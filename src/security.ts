import { timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

const MAX_IMAGE = 5 * 1024 * 1024
const MAX_PIXELS = 16_000_000

export function validateImageDataUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_IMAGE * 1.4) throw new Error('Invalid image')
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('Only uploaded PNG/JPEG images are accepted')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > MAX_IMAGE || bytes.toString('base64') !== match[2]) throw new Error('Invalid image')
  let width = 0, height = 0
  if (match[1] === 'png' && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16) === 'IHDR') {
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20)
  } else if (match[1] === 'jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 0xda || marker === 0xd9) break
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) break
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) {
        height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5); break
      }
      offset += length
    }
  }
  if (!width || !height || width > 8192 || height > 8192 || width * height > MAX_PIXELS) throw new Error('Unsupported image dimensions')
  return value
}

export async function uploadedImageDataUrl(file: unknown): Promise<string> {
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || !('size' in file) || !('type' in file)) throw new Error('Invalid upload')
  const image = file as File
  if (image.size > MAX_IMAGE || !['image/png','image/jpeg'].includes(image.type)) throw new Error('Only PNG/JPEG uploads up to 5 MiB are accepted')
  return validateImageDataUrl(`data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString('base64')}`)
}

function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x,y)
}

export function securityBoundary(env = process.env): MiddlewareHandler {
  const username = env.IMAGE_ADMIN_USERNAME || ''
  const password = env.IMAGE_ADMIN_PASSWORD || ''
  const origin = env.IMAGE_PUBLIC_ORIGIN || ''
  let requests = 0, windowStart = Date.now(), active = 0
  return async (c, next) => {
    if (!username || username.includes(':') || password.length < 32 || !/^https:\/\/[^/]+$/.test(origin)) return c.text('Security configuration required',503)
    const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    if (!equal(c.req.header('Authorization') || '',expected)) {
      c.header('WWW-Authenticate','Basic realm="Image administration", charset="UTF-8"')
      return c.text('Authentication required',401)
    }
    c.header('Cache-Control','no-store')
    c.header('X-Content-Type-Options','nosniff')
    c.header('X-Frame-Options','DENY')
    if (!['GET','HEAD','OPTIONS'].includes(c.req.method)) {
      if (c.req.header('Origin') !== origin) return c.text('Forbidden origin',403)
      if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); requests = 0 }
      if (++requests > 60 || active >= 2) return c.text('Request limit exceeded',429)
      active++
      try { await next() } finally { active-- }
      return
    }
    await next()
  }
}

export const imageInputBoundary: MiddlewareHandler = async (c, next) => {
  if (c.req.path === '/api/generate-batch-url') return c.json({ error: 'URL input is disabled. Upload PNG/JPEG files instead.' }, 410)
  try {
    if (['/api/execute-generation', '/api/execute-generation-ai'].includes(c.req.path)) {
      const body = await c.req.json()
      validateImageDataUrl(body.imageUrl)
    }
    if (['/api/generate-image','/api/generate-batch'].includes(c.req.path)) {
      const form = await c.req.formData()
      const images = Array.from(form.entries()).filter(([key]) => key === 'image' || /^image_\d+$/.test(key))
      if (!images.length || images.length > 5) throw new Error('Invalid upload count')
      for (const [, image] of images) await uploadedImageDataUrl(image)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'BodyLimitError') throw error
    if (error && typeof error === 'object' && 'status' in error && error.status === 413) return c.text('Request body too large', 413)
    return c.json({ error: 'Upload valid PNG/JPEG images (5 MiB, 16 megapixels maximum; up to 5 files).' }, 400)
  }
  await next()
}
