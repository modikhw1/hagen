/**
 * H1 Definitions API
 *
 * GET /api/h1/definitions - List all H1 definitions with annotation counts
 * POST /api/h1/definitions - Create a new H1 definition
 * PATCH /api/h1/definitions - Update an H1 definition
 * DELETE /api/h1/definitions - Archive an H1 definition
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Validation schemas
const createH1Schema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores'),
  question: z.string().min(10).max(200),
  description: z.string().max(500).optional(),
  mode: z.enum(['clip', 'brand']).default('clip'),
  brand_id: z.string().uuid().optional(),
  dimension: z.enum(['humor', 'audience', 'quality', 'style', 'replicability', 'brand_fit', 'custom']).optional()
}).refine(data => {
  // Brand mode requires brand_id
  if (data.mode === 'brand' && !data.brand_id) {
    return false
  }
  return true
}, { message: 'brand_id is required for brand mode' })

const updateH1Schema = z.object({
  id: z.string().uuid(),
  question: z.string().min(10).max(200).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'paused', 'archived']).optional()
})

// GET - List all H1 definitions with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const includeArchived = searchParams.get('include_archived') === 'true'

    // Get H1 definitions
    let query = supabase
      .from('h1_definitions')
      .select(`
        id,
        name,
        question,
        description,
        mode,
        brand_id,
        dimension,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (!includeArchived) {
      query = query.neq('status', 'archived')
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: definitions, error: defError } = await query

    if (defError) {
      console.error('Failed to fetch H1 definitions:', defError)
      return NextResponse.json({ definitions: [], error: defError.message }, { status: 500 })
    }

    // Get annotation counts per definition
    const { data: counts, error: countError } = await supabase
      .from('h1_training_pairs')
      .select('h1_definition_id')

    const countMap: Record<string, number> = {}
    if (!countError && counts) {
      for (const row of counts) {
        if (row.h1_definition_id) {
          countMap[row.h1_definition_id] = (countMap[row.h1_definition_id] || 0) + 1
        }
      }
    }

    // Get brand names for brand mode H1s
    const brandIds = definitions?.filter(d => d.brand_id).map(d => d.brand_id) || []
    let brandMap: Record<string, string> = {}

    if (brandIds.length > 0) {
      const { data: brands } = await supabase
        .from('brand_profiles')
        .select('id, name')
        .in('id', brandIds)

      if (brands) {
        brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]))
      }
    }

    // Combine data
    const result = (definitions || []).map(def => ({
      ...def,
      annotation_count: countMap[def.id] || 0,
      brand_name: def.brand_id ? brandMap[def.brand_id] : null
    }))

    return NextResponse.json({ definitions: result })

  } catch (error) {
    console.error('H1 definitions list failed:', error)
    return NextResponse.json(
      { error: 'list-failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new H1 definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createH1Schema.parse(body)

    const insertData: Record<string, unknown> = {
      name: data.name,
      question: data.question,
      description: data.description || null,
      mode: data.mode,
      dimension: data.dimension || null,
      status: 'active'
    }

    if (data.mode === 'brand' && data.brand_id) {
      insertData.brand_id = data.brand_id
    }

    const { data: result, error } = await supabase
      .from('h1_definitions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'duplicate-name', message: `H1 with name "${data.name}" already exists` },
          { status: 409 }
        )
      }
      console.error('Failed to create H1 definition:', error)
      return NextResponse.json(
        { error: 'create-failed', message: error.message },
        { status: 500 }
      )
    }

    console.log(`Created H1 definition: ${data.name} (${data.mode} mode)`)

    return NextResponse.json({
      success: true,
      definition: result
    })

  } catch (error) {
    console.error('H1 definition create failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation-error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'create-failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH - Update H1 definition
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const data = updateH1Schema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (data.question) updateData.question = data.question
    if (data.description !== undefined) updateData.description = data.description
    if (data.status) updateData.status = data.status

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'no-changes', message: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: result, error } = await supabase
      .from('h1_definitions')
      .update(updateData)
      .eq('id', data.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update H1 definition:', error)
      return NextResponse.json(
        { error: 'update-failed', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      definition: result
    })

  } catch (error) {
    console.error('H1 definition update failed:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation-error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'update-failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Archive H1 definition (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'missing-id', message: 'H1 definition ID required' },
        { status: 400 }
      )
    }

    // Soft delete - set status to archived
    const { error } = await supabase
      .from('h1_definitions')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      console.error('Failed to archive H1 definition:', error)
      return NextResponse.json(
        { error: 'archive-failed', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, archived: id })

  } catch (error) {
    console.error('H1 definition archive failed:', error)
    return NextResponse.json(
      { error: 'archive-failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
