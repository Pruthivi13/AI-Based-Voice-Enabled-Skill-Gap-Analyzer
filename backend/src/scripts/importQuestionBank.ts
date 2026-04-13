/**
 * importQuestionBank.ts
 * Run once: npx ts-node src/scripts/importQuestionBank.ts
 *
 * Reads question_bank_v1.csv and upserts all questions
 * with reference answers into the DB.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

// ── Simple CSV parser (no extra deps needed) ──────────────────────────────
function parseCsv(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map((line) => {
    // Handle commas inside quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

// ── Column name normaliser ─────────────────────────────────────────────────
// Adjust these mappings to match YOUR actual CSV column names
function mapCategory(raw: string): any {
  const val = (raw || '').toUpperCase().trim();
  if (val.includes('HR') || val.includes('BEHAV')) return 'HR';
  if (val.includes('COMM')) return 'COMMUNICATION';
  if (val.includes('BEHAV')) return 'HR';
  return 'TECHNICAL';
}

function mapDifficulty(raw: string): any {
  const val = (raw || '').toUpperCase().trim();
  if (val === 'HARD' || val === 'DIFFICULT') return 'HARD';
  if (val === 'EASY' || val === 'BEGINNER') return 'EASY';
  return 'MEDIUM';
}

async function main() {
  const csvPath = path.join(__dirname, '../../../data/question_bank_v1.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(csvPath);
  console.log(`📋 Found ${rows.length} rows in CSV`);
  
  // Log first row so you can verify column mapping
  console.log('First row sample:', rows[0]);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // ── MAP THESE to your actual CSV column names ──
    // Common variations: 'question', 'Question', 'question_text'
    const content =
      row['question'] ||
      row['Question'] ||
      row['question_text'] ||
      row['content'] || '';

    // Common variations: 'reference_answer', 'answer', 'Reference Answer'
    const referenceAnswer =
      row['reference_answer'] ||
      row['Reference Answer'] ||
      row['answer'] ||
      row['expected_answer'] || '';

    const categoryRaw =
      row['category'] || row['Category'] || row['type'] || 'TECHNICAL';
    const difficultyRaw =
      row['difficulty'] || row['Difficulty'] || row['level'] || 'MEDIUM';
    const role =
      row['role'] || row['Role'] || row['target_role'] || null;
    const timeLimitRaw =
      row['time_limit'] || row['timeLimitSeconds'] || '120';

    if (!content.trim()) { skipped++; continue; }

    const hintsRaw = row['hints'] || row['Hints'] || '';
    const hints = hintsRaw ? hintsRaw.split('|').map(h => h.trim()) : [];

    try {
      await prisma.question.create({
        data: {
          content: content.trim(),
          referenceAnswer: referenceAnswer.trim() || null,
          category: mapCategory(categoryRaw),
          difficulty: mapDifficulty(difficultyRaw),
          role: role?.trim() || null,
          hints: hints.length > 0 ? hints : null,
          timeLimitSeconds: parseInt(timeLimitRaw) || 120,
          isActive: true,
        },
      });
      created++;
    } catch (err: any) {
      // Skip duplicates silently
      if (!err.message?.includes('unique')) {
        console.warn(`⚠ Skipped row: ${err.message}`);
      }
      skipped++;
    }
  }

  console.log(`✅ Imported ${created} questions`);
  console.log(`⏭  Skipped ${skipped} rows`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
