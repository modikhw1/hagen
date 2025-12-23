import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATASET_PATH = path.join(process.cwd(), 'datasets/replicability_dataset_2025-12-23.json');
const ORIGINAL_DATASET_PATH = path.join(process.cwd(), 'datasets/dataset_2025-12-18.json');

export async function GET() {
  try {
    if (!fs.existsSync(DATASET_PATH)) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const replicabilityData = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
    let originalData: any[] = [];
    
    if (fs.existsSync(ORIGINAL_DATASET_PATH)) {
      const raw = JSON.parse(fs.readFileSync(ORIGINAL_DATASET_PATH, 'utf8'));
      originalData = raw.videos || [];
    }

    const randomIndex = Math.floor(Math.random() * replicabilityData.length);
    const entry = replicabilityData[randomIndex];
    const original = originalData.find((v: any) => v.id === entry.video_id);

    return NextResponse.json({
      ...entry,
      url: original ? original.video_url : null,
      index: randomIndex
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
