import { serve } from '@hono/node-server'

const port = process.env.PORT || 3000

console.log('='.repeat(50))
console.log('Starting Image Editing System Server')
console.log('='.repeat(50))
console.log(`Port: ${port}`)
console.log(`Node version: ${process.version}`)
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT || 'NOT SET'}`)
console.log(`GOOGLE_CLOUD_LOCATION: ${process.env.GOOGLE_CLOUD_LOCATION || 'NOT SET'}`)
console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET'}`)
console.log('='.repeat(50))

// Import app after logging environment
let app: any;
try {
  const appModule = await import('./index.js')
  app = appModule.default
  console.log('✅ App loaded successfully')
} catch (error) {
  console.error('❌ Failed to load app:', error)
  process.exit(1)
}

console.log(`🚀 Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port: Number(port),
})
