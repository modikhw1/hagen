/**
 * Criteria Extraction API
 * 
 * POST /api/extract-criteria
 * Extracts structured criteria from natural language notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractCriteria, batchExtractCriteria } from '@/lib/services/extraction/criteria';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/extract-criteria
 * 
 * Body: 
 *   Single: { notes: string, overall_score?: number }
 *   Batch: { ratings: [{ id, notes, overall_score }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Batch extraction
    if (body.ratings && Array.isArray(body.ratings)) {
      const results = await batchExtractCriteria(body.ratings);
      
      return NextResponse.json({
        success: true,
        results: Object.fromEntries(results),
        count: results.size,
      });
    }
    
    // Single extraction
    const { notes, overall_score, save_to_db, rating_id } = body;
    
    if (!notes || typeof notes !== 'string') {
      return NextResponse.json(
        { error: 'notes is required and must be a string' },
        { status: 400 }
      );
    }
    
    const result = await extractCriteria(notes, overall_score);
    
    // Optionally save to database
    if (save_to_db && rating_id) {
      const { error: updateError } = await supabase
        .from('ratings_v2')
        .update({
          extracted_criteria: result.criteria,
          extraction_model: result.model_used,
          extraction_confidence: result.confidence,
        })
        .eq('id', rating_id);
      
      if (updateError) {
        console.error('Failed to save extraction:', updateError);
      }
      
      // Log extraction
      await supabase
        .from('extraction_log')
        .insert({
          rating_id,
          notes_text: notes,
          extracted_criteria: result.criteria,
          model_used: result.model_used,
          confidence: result.confidence,
          extraction_time_ms: result.extraction_time_ms,
        });
      
      // Update criteria statistics
      await updateCriteriaStats(result.criteria);
    }
    
    return NextResponse.json({
      success: true,
      ...result,
    });
    
  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    );
  }
}

/**
 * Update discovered_criteria table with new criteria
 */
async function updateCriteriaStats(criteria: Record<string, unknown>) {
  for (const [key, value] of Object.entries(criteria)) {
    if (value === null || value === undefined) continue;
    
    const { error } = await supabase
      .from('discovered_criteria')
      .upsert({
        criterion_name: key,
        frequency: 1,
        last_seen_at: new Date().toISOString(),
        value_type: typeof value === 'number' ? 'numeric' : 
                   typeof value === 'boolean' ? 'boolean' : 'categorical',
      }, {
        onConflict: 'criterion_name',
      });
    
    if (error) {
      // If upsert failed, try increment
      await supabase.rpc('increment_criteria_frequency', { 
        criteria_name: key 
      }).catch(() => {
        // Ignore if function doesn't exist
      });
    }
  }
}

/**
 * GET /api/extract-criteria
 * 
 * Get discovered criteria and their stats
 */
export async function GET() {
  try {
    const { data: criteria, error } = await supabase
      .from('discovered_criteria')
      .select('*')
      .order('frequency', { ascending: false });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      criteria: criteria || [],
      count: criteria?.length || 0,
    });
    
  } catch (error) {
    console.error('Failed to fetch criteria:', error);
    return NextResponse.json(
      { error: 'Failed to fetch criteria' },
      { status: 500 }
    );
  }
}
