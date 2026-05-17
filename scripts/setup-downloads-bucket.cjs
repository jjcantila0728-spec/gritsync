// Create / verify the public Supabase Storage bucket used to host the
// signed APK. Idempotent — safe to re-run.
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'downloads'

;(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env')
    process.exit(2)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: existing, error: listErr } = await sb.storage.listBuckets()
  if (listErr) { console.error('listBuckets:', listErr.message); process.exit(1) }

  if (existing.find((b) => b.name === BUCKET)) {
    console.log(`✔ bucket "${BUCKET}" already exists`)
  } else {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
    })
    if (error) { console.error('createBucket:', error.message); process.exit(1) }
    console.log(`✔ created public bucket "${BUCKET}"`)
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl('gritsync.apk')
  console.log('')
  console.log('Public URL the website will reference once you upload the APK:')
  console.log('  ' + pub.publicUrl)
})()
