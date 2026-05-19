const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './db/learnflow.db';
const db = new Database(DB_PATH);

function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create or verify Users
  const teacherId = 'teacher_demo_id';
  db.prepare(`
    INSERT OR REPLACE INTO users (id, ms_id, name, email, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(teacherId, null, 'Jane Teacher', 'teacher@school.local', 'teacher');

  const studentId = 'student_demo_id';
  db.prepare(`
    INSERT OR REPLACE INTO users (id, ms_id, name, email, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(studentId, null, 'Marie Meier', 'student@school.local', 'student');

  // 2. Create a pre-built Worksheet with all 5 exercise types
  const worksheetId = 'worksheet_demo_id';
  const worksheetContent = {
    blocks: [
      {
        id: 'blk_text_1',
        type: 'text',
        content: '# English Grammar Practice\nWelcome to your English grammar worksheet. Please complete all exercises carefully.'
      },
      {
        id: 'blk_gap_fill_1',
        type: 'gap_fill',
        instruction: 'Fill in the blanks with the correct form of "have" (has/have):',
        template: 'She {has} a cute dog. We {have} a big house in Telfs.',
        points: 2
      },
      {
        id: 'blk_drag_drop_1',
        type: 'drag_drop',
        instruction: 'Drag and drop the correct helping verbs into the gaps:',
        items: ['have', 'has', 'had'],
        targets: ['They ___ already finished the homework.', 'He ___ gone to school before it started raining.'],
        answers: { '0': 'have', '1': 'had' },
        points: 2
      },
      {
        id: 'blk_mc_1',
        type: 'multiple_choice',
        instruction: 'Which sentences are grammatically correct? (Select all that apply)',
        options: [
          'She has went to the store.',
          'She has gone to the store.',
          'They have been playing football for two hours.',
          'We was watching TV last night.'
        ],
        correct: [1, 2],
        points: 2
      },
      {
        id: 'blk_sc_1',
        type: 'single_choice',
        instruction: 'Select the correct present continuous sentence:',
        options: [
          'He is play computer games now.',
          'He is playing computer games now.',
          'He playing computer games now.'
        ],
        correct: 1,
        points: 1
      },
      {
        id: 'blk_matching_1',
        type: 'matching',
        instruction: 'Connect the opposites (antonyms):',
        left: ['large', 'hot', 'fast'],
        right: ['slow', 'cold', 'small'],
        pairs: [
          ['large', 'small'],
          ['hot', 'cold'],
          ['fast', 'slow']
        ],
        points: 3
      }
    ]
  };

  db.prepare(`
    INSERT OR REPLACE INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    worksheetId,
    'Present Perfect & Past Tenses',
    'Interactive worksheet testing past and perfect verb tenses.',
    'English',
    '3a',
    teacherId,
    JSON.stringify(worksheetContent),
    10,
    1
  );

  // 3. Create a Test Assignment
  const assignmentId = '5a1b-c3d4'; // This serves as our guest code too!
  db.prepare(`
    INSERT OR REPLACE INTO assignments (id, worksheet_id, class_name, class_id, teams_assignment_id, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    assignmentId,
    worksheetId,
    '3a English',
    'class_3a_id',
    null,
    '2026-06-30T12:00:00.000Z',
    teacherId
  );

  console.log('✅ Seeding completed!');
  console.log('   Use Assignment Code: 5a1b-c3d4 to join as Marie Meier');
}

seed();
process.exit(0);
