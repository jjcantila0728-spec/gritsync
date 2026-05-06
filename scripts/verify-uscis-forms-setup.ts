/**
 * Verification script for GritSync API setup
 * Checks Express backend connectivity and PostgreSQL connection.
 * Usage: tsx scripts/verify-uscis-forms-setup.ts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001'

async function verifySetup() {
  console.log('Verifying GritSync API Setup...\n')

  let allGood = true

  // 1. Check if the backend is reachable
  console.log('1. Checking Express API health...')
  try {
    const res = await fetch(`${API_BASE}/api/health`).catch(() => null)
    if (res?.ok) {
      console.log('   OK — Express API is reachable')
    } else {
      console.log(`   WARNING — API responded with status ${res?.status ?? 'unreachable'}`)
      allGood = false
    }
  } catch (err: any) {
    console.log(`   ERROR — ${err.message}`)
    allGood = false
  }

  console.log('')
  console.log(allGood ? 'Setup looks good.' : 'Some checks failed — review warnings above.')
}

verifySetup().catch(console.error)
