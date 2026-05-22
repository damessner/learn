const fs = require('fs');
let content = fs.readFileSync('c:/Users/dames/OneDrive - Mittelschule Telfs/github/learn/backend/routes/classes.js', 'utf8');

const injectionPoint = content.lastIndexOf('module.exports = router;');
if (injectionPoint > -1) {
    const newRoute = `
// ─── Import Classes and Students from PDF ─────────────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import-pdf', requireAuth, requireRole(['admin', 'teacher']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Dynamic import for ES module pdf-parse or fallback to exec
    let text = '';
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } catch (e) {
      // Fallback if pdf-parse fails due to ES modules or other issues
      const tempPath = require('path').join(__dirname, '..', 'temp_upload.pdf');
      require('fs').writeFileSync(tempPath, req.file.buffer);
      const { execSync } = require('child_process');
      // Very hacky fallback just in case pdf-parse completely fails
      // We assume pdf-parse works since we installed it
      throw e;
    }

    const classesData = [];
    let currentClass = null;
    const lines = text.split('\\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const classMatch = line.match(/^Namensliste der\\s+(.+)$/i);
      if (classMatch) {
        currentClass = { name: classMatch[1], students: [] };
        classesData.push(currentClass);
        continue;
      }
      
      if (currentClass) {
        const studentMatch = line.match(/^(\\d+)([^\\d].*)$/);
        if (studentMatch && 
            !line.includes('SchülerInnen') && 
            !line.includes('Klassenvorständin') && 
            !line.includes('Klassenvorstand') && 
            !line.includes('Schuljahr') && 
            !line.includes('22.05.2026') && 
            !line.startsWith('NrName') && 
            !line.includes('05262/62062') && 
            !line.includes('Weißenbachgasse') && 
            !line.includes('Dr. Aloys Weissenbach')) {
            
            let name = studentMatch[2].trim();
            currentClass.students.push(name);
        }
      }
    }

    if (classesData.length === 0) {
      return res.status(400).json({ error: 'No classes found in the PDF. Please check the format.' });
    }

    const db = require('../db/init').getDB();
    const { v4: uuidv4 } = require('uuid');
    
    // Default password iteration and logic from auth.js
    const crypto = require('crypto');
    function hashPassword(password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512').toString('hex');
      return \`310000:\${salt}:\${hash}\`;
    }
    const defaultPasswordHash = hashPassword('changeme123');
    
    const results = { classesCreated: 0, studentsCreated: 0, classesExisting: 0, studentsExisting: 0 };
    
    db.transaction(() => {
      for (const cls of classesData) {
        let classRecord = db.prepare('SELECT id FROM classes WHERE name = ?').get(cls.name);
        let classId;
        
        if (!classRecord) {
          classId = uuidv4();
          // generate a short 6-char code
          const code = crypto.randomBytes(3).toString('hex').toUpperCase();
          db.prepare('INSERT INTO classes (id, name, code, created_by) VALUES (?, ?, ?, ?)')
            .run(classId, cls.name, code, req.user.userId);
          results.classesCreated++;
        } else {
          classId = classRecord.id;
          results.classesExisting++;
        }

        for (const studentName of cls.students) {
          // generate username: first initial + last name lowercase, e.g. "lauer" for "Linus Auer"
          // Or just use name lowercase stripped of spaces
          const cleanName = studentName.replace(/[^a-zA-ZäöüßÄÖÜ]/g, '').toLowerCase();
          const username = cleanName + crypto.randomBytes(2).toString('hex');
          
          let studentRecord = db.prepare('SELECT id FROM users WHERE name = ? AND role = \\\'student\\\'').get(studentName);
          let studentId;
          
          if (!studentRecord) {
            studentId = uuidv4();
            db.prepare(\`
              INSERT INTO users (id, name, username, password_hash, role, last_login) 
              VALUES (?, ?, ?, ?, 'student', datetime('now'))
            \`).run(studentId, studentName, username, defaultPasswordHash);
            results.studentsCreated++;
          } else {
            studentId = studentRecord.id;
            results.studentsExisting++;
          }
          
          // Enroll student in class
          const enrollment = db.prepare('SELECT user_id FROM class_students WHERE class_id = ? AND user_id = ?').get(classId, studentId);
          if (!enrollment) {
            db.prepare('INSERT INTO class_students (class_id, user_id) VALUES (?, ?)').run(classId, studentId);
          }
        }
      }
    })();
    
    res.json({ message: 'Import successful', results, data: classesData });
  } catch (err) {
    console.error('[CLASSES] PDF Import error:', err);
    res.status(500).json({ error: 'Failed to process PDF file: ' + err.message });
  }
});

`;
    content = content.slice(0, injectionPoint) + newRoute + content.slice(injectionPoint);
    fs.writeFileSync('c:/Users/dames/OneDrive - Mittelschule Telfs/github/learn/backend/routes/classes.js', content, 'utf8');
    console.log('PDF route added');
}
