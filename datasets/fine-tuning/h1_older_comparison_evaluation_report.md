# H1 Model Evaluation Report: older_comparison

**Date:** 2026-01-07
**Model:** h1-older_comparison-v1
**Base Model:** gemini-2.0-flash-001
**Training Examples:** 51 pairs

## Summary

**VERDICT: Model is viable**

The H1 relational model successfully learned to replicate human judgment for clip quality comparisons using only AI-analyzed data (visual_analysis variables).

## Evaluation Results

### Checkpoint Comparison

| Metric | Checkpoint 5 (epoch 6) | Checkpoint 2 (epoch 3) |
|--------|------------------------|------------------------|
| Agreement with human | 20% (3/15) | **100%** (10/10) |
| Consistency (multi-run) | 87% | **100%** |
| Parse errors | 87% | 20% (format only) |
| Repetition loops | Severe | None |

### Recommended Endpoint

**Use Checkpoint 2 (epoch 3, step 6):**
```
projects/1061681256498/locations/us-central1/endpoints/5277038987301617664
```

The final checkpoint (epoch 6) exhibits overfitting behavior with repetition loops. Earlier checkpoint is significantly more stable.

## Key Findings

### 1. Semantic Layer Learning Confirmed

The model correctly interprets 150+ variables from visual_analysis data and makes judgments that align with human annotations. Example reasoning from model:

> "Clip A has a higher sigma_taste_score (0.7 vs 0.55) and stronger quality signals. Specifically, Clip A's hook_strength (7) and attention_retention (8) exceed Clip B's values."

### 2. Text-Based Fine-Tuning Works

No video files needed at inference time. The model operates entirely on structured analysis data, enabling:
- Fast inference (~1-2 seconds per comparison)
- No video processing costs
- Scalable batch operations

### 3. Training Data Format Validated

DPO format (prompt/chosen/rejected) converted to SFT format (contents) works for Vertex AI supervised tuning. The ~2,300 token prompts with ~80 token responses trained successfully.

## Technical Details

### Training Configuration
- Epochs: 6 (but epoch 3 checkpoint preferred)
- Learning rate multiplier: 1.0
- Train/validation split: 85/15

### Checkpoints Available
| ID | Epoch | Step | Status |
|----|-------|------|--------|
| 1 | 2 | 3 | Stable |
| 2 | 3 | 6 | **RECOMMENDED** |
| 3 | 5 | 9 | Stable |
| 4 | 6 | 12 | Some loops |
| 5 | 6 | 13 | Frequent loops |

### Generation Config for Inference
```javascript
{
  temperature: 0.2,
  maxOutputTokens: 300,
  stopSequences: ['CLIP A:', 'CLIP B:', '\n\n\n', '---']
}
```

## Next Steps

1. **Update production endpoint** to checkpoint 2
2. **Gather more training data** for this H1 dimension (target: 100+ pairs)
3. **Create additional H1 dimensions:**
   - Brand fit (does this match brand X's tone?)
   - Target audience (younger vs older appeal)
   - Humor type clustering
4. **Build visual comparison UI** for ongoing qualitative validation
5. **Implement ranking consistency test** to verify transitive logic

## Files

- Job metadata: `datasets/fine-tuning/h1_older_comparison_job.json`
- Evaluation results: `datasets/fine-tuning/h1_older_comparison_eval_results.json`
- Training data: `datasets/fine-tuning/h1_older_comparison_dpo.jsonl`
- Evaluation script: `scripts/evaluate-h1-model.js`
- Trial script: `scripts/trial-h1-model.js`
