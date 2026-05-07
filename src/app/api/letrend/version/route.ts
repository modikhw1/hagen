/**
 * GET /api/letrend/version
 *
 * Lightweight version handshake so api-server / letrend can confirm which
 * hagen build Railway is actually running. Use this to detect route drift —
 * if a proxy route in api-server points at a path that has been renamed or
 * removed in this hagen build, the version endpoint still answers and the
 * mismatch can be diagnosed without SSHing into Railway.
 *
 * Must be dynamic so that `now` reflects the actual request time, not a
 * cached value from build-time or the first render. Without force-dynamic,
 * Next.js static optimisation freezes the response and `now` never changes,
 * making it impossible to tell whether the endpoint is live or cached.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SCHEMA_VERSION = 1

// Captured at module load — reflects the process start time.
// Useful for spotting unexpectedly fresh restarts on Railway when debugging.
const PROCESS_STARTED_AT = new Date().toISOString()

function readGitSha(): string {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    'unknown'
  )
}

function readGitBranch(): string {
  return (
    process.env.RAILWAY_GIT_BRANCH ||
    process.env.GIT_BRANCH ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    'unknown'
  )
}

export async function GET() {
  return NextResponse.json(
    {
      service: 'hagen',
      git_sha: readGitSha(),
      git_branch: readGitBranch(),
      schema_version: SCHEMA_VERSION,
      node_env: process.env.NODE_ENV ?? 'unknown',
      started_at: PROCESS_STARTED_AT,
      now: new Date().toISOString(),
      routes: {
        letrend_concept_prepare:       '/api/letrend/concept/prepare',
        letrend_library:               '/api/letrend/library',
        letrend_version:               '/api/letrend/version',
        videos_analyze_deep:           '/api/videos/analyze/deep',
        videos_library:                '/api/videos/library',
        videos_create:                 '/api/videos/create',
        studio_concepts_analyze:       '/api/studio/concepts/analyze',
        studio_concepts_enrich:        '/api/studio/concepts/enrich',
        studio_concepts_humor_enrich:  '/api/studio/concepts/humor-enrich',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
