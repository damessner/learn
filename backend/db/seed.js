const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');

const rawDbPath = process.env.DB_PATH || './db/learnflow.db';
const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, '..', rawDbPath);
const db = new Database(DB_PATH);

const PBKDF2_ITERATIONS = 310000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create or verify Users
  const teacherId = 'teacher_demo_id';
  const teacherPassHash = hashPassword('teacher123');
  db.prepare(`
    INSERT OR IGNORE INTO users (id, ms_id, username, password_hash, name, email, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(teacherId, null, 'teacher', teacherPassHash, 'Jane Teacher', 'teacher@school.local', 'teacher');

  const studentId = 'student_demo_id';
  const studentPassHash = hashPassword('student123');
  db.prepare(`
    INSERT OR IGNORE INTO users (id, ms_id, username, password_hash, name, email, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(studentId, null, 'student', studentPassHash, 'Marie Meier', 'student@school.local', 'student');

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

  // 4. Create the class and enroll the demo student so the regular student login shows the worksheet
  db.prepare(`
    INSERT OR IGNORE INTO classes (id, name, created_by)
    VALUES (?, ?, ?)
  `).run('class_3a_id', '3a English', teacherId);

  db.prepare(`
    INSERT OR IGNORE INTO class_students (class_id, student_id)
    VALUES (?, ?)
  `).run('class_3a_id', studentId);

  // ─── 5. Seed Present Progressive Course (Option B) ─────────────────────────
  const courseId = 'course_present_progressive_id';
  db.prepare(`
    INSERT OR REPLACE INTO courses (id, title, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run(
    courseId,
    'Mastering Present Progressive Tense',
    'A step-by-step course covering the Present Progressive tense from basic formation to tricky spelling rules and comparisons with Present Simple.',
    teacherId
  );

  // Worksheet 1: Present Progressive Intro & Basics
  const ws1Id = 'ws_pres_prog_1_intro';
  const ws1Content = {
    blocks: [
      {
        id: 'ws1_text_1',
        type: 'text',
        content: '# Present Progressive: The Basics 📝\n\nUse the Present Progressive for actions happening **right now** or **at the moment**.\n\n### How to form it:\n**Subject + am/is/are + verb-ing**\n\n*Examples:*\n- I **am reading** a book.\n- He **is playing** football.\n- They **are watching** TV.\n\n*Key Signal Words:* now, at the moment, look!, listen!'
      },
      {
        id: 'ws1_gap_1',
        type: 'gap_fill',
        instruction: 'Fill in the blanks with the correct form of to be (am/is/are) and the verb in brackets:',
        template: '1. Look! The sun {is shining}. (shine)\n2. I {am doing} my English homework right now. (do)\n3. We {are waiting} for the school bus at the moment. (wait)\n4. Listen! The birds {are singing} outside. (sing)',
        points: 4
      },
      {
        id: 'ws1_sc_1',
        type: 'single_choice',
        instruction: 'Which sentence describes an action happening right now?',
        options: [
          'She drinks tea every morning.',
          'She is drinking tea now.',
          'She drank tea yesterday.'
        ],
        correct: 1,
        points: 1
      }
    ]
  };

  db.prepare(`
    INSERT OR REPLACE INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ws1Id,
    '1. Present Progressive: Basics & Intro',
    'Learn how to form the Present Progressive with am/is/are + verb-ing.',
    'English',
    '2a',
    teacherId,
    JSON.stringify(ws1Content),
    5,
    1
  );

  // Worksheet 2: Spelling Rules (Swim -> Swimming)
  const ws2Id = 'ws_pres_prog_2_spelling';
  const ws2Content = {
    blocks: [
      {
        id: 'ws2_text_1',
        type: 'text',
        content: '# Spelling Rules for -ing Verbs ⚠️\n\nMost verbs just add **-ing** (e.g., play -> playing). But watch out for these rules:\n\n1. **Drop the final -e**: If a verb ends in a silent `-e`, drop the `e` (e.g., writ**e** -> writ**ing**, mak**e** -> mak**ing**).\n2. **Double the consonant**: If a short verb has a short vowel and ends in a single consonant, double the final consonant (e.g., sw**im** -> sw**imming**, r**un** -> r**unning**).\n3. **Verbs ending in -ie**: Change `-ie` to `-y` (e.g., l**ie** -> l**ying**).'
      },
      {
        id: 'ws2_gap_1',
        type: 'gap_fill',
        instruction: 'Fill in the correct spelling of the verbs in brackets:',
        template: '1. My brother is {running} in the garden. (run)\n2. Sarah is {writing} an email to her friend. (write)\n3. Look at those dogs! They are {swimming} in the lake. (swim)\n4. He is not telling the truth, he is {lying}. (lie)',
        points: 4
      },
      {
        id: 'ws2_match_1',
        type: 'matching',
        instruction: 'Connect the infinitive verb with its correct -ing form:',
        left: ['make', 'sit', 'study', 'die'],
        right: ['sitting', 'dying', 'studying', 'making'],
        pairs: [
          ['make', 'making'],
          ['sit', 'sitting'],
          ['study', 'studying'],
          ['die', 'dying']
        ],
        points: 4
      }
    ]
  };

  db.prepare(`
    INSERT OR REPLACE INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ws2Id,
    '2. Present Progressive: Spelling Rules',
    'Practice special spelling rules: dropping -e, doubling consonants, and changing -ie to -y.',
    'English',
    '2a',
    teacherId,
    JSON.stringify(ws2Content),
    8,
    1
  );

  // Worksheet 3: Advanced Present Progressive vs. Present Simple
  const ws3Id = 'ws_pres_prog_3_simple';
  const ws3Content = {
    blocks: [
      {
        id: 'ws3_text_1',
        type: 'text',
        content: '# Present Progressive vs. Present Simple 🔍\n\nCompare these two tenses:\n- **Present Simple**: Everyday habits, routines, or general facts. (e.g., *every day, often, usually, always*)\n- **Present Progressive**: Actions happening right now. (e.g., *now, look, at the moment*)\n\n*Examples:*\n- I usually **play** tennis on Sundays, but today I **am swimming**.'
      },
      {
        id: 'ws3_gap_1',
        type: 'gap_fill',
        instruction: 'Choose Present Simple or Present Progressive for the verbs in brackets:',
        template: '1. I usually {go} to school by bike, but today I {am walking}. (go / walk)\n2. My mom {cooks} dinner every evening, but right now she {is reading} a book. (cook / read)\n3. Listen! The children {are playing} the piano. (play)\n4. He {likes} chocolate ice cream. (like - note: state verbs are not used in progressive!)',
        points: 5
      },
      {
        id: 'ws3_mc_1',
        type: 'multiple_choice',
        instruction: 'Identify the sentences that are grammatically CORRECT:',
        options: [
          'I am going to school every day.',
          'I go to school every day.',
          'Look! It is raining outside.',
          'Listen! She sings a song.'
        ],
        correct: [1, 2],
        points: 2
      }
    ]
  };

  db.prepare(`
    INSERT OR REPLACE INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ws3Id,
    '3. Present Progressive vs. Present Simple',
    'Challenge yourself by choosing between actions happening now and daily habits/routines.',
    'English',
    '2a',
    teacherId,
    JSON.stringify(ws3Content),
    7,
    1
  );

  // Bind the worksheets to the course in sequence
  db.prepare('DELETE FROM course_worksheets WHERE course_id = ?').run(courseId);
  db.prepare(`
    INSERT INTO course_worksheets (course_id, worksheet_id, order_index)
    VALUES (?, ?, 1), (?, ?, 2), (?, ?, 3)
  `).run(courseId, ws1Id, courseId, ws2Id, courseId, ws3Id);

  // Assign the course to the demo class (3a English)
  const courseAssignId = 'course_assign_demo_id';
  db.prepare(`
    INSERT OR REPLACE INTO course_assignments (id, course_id, class_id, created_by)
    VALUES (?, ?, ?, ?)
  `).run(courseAssignId, courseId, 'class_3a_id', teacherId);

  // Create corresponding worksheet assignments for this class so students can see and solve them in sequence
  db.prepare(`
    INSERT OR REPLACE INTO assignments (id, worksheet_id, class_name, class_id, created_by)
    VALUES 
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?)
  `).run(
    'assign_prog_ws1_id', ws1Id, '3a English', 'class_3a_id', teacherId,
    'assign_prog_ws2_id', ws2Id, '3a English', 'class_3a_id', teacherId,
    'assign_prog_ws3_id', ws3Id, '3a English', 'class_3a_id', teacherId
  );

  console.log('✅ Seeding completed! Present Progressive course and assignments loaded.');
}

seed();
process.exit(0);
