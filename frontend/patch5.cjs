const fs = require('fs')

const filePath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\backend\\routes\\submissions.js'
let content = fs.readFileSync(filePath, 'utf-8')

const injectCode = `
      case 'flashcards':
      case 'memory_match': {
        const isCompleted = !!(studentAnswer && studentAnswer.completed);
        const earned = isCompleted ? blockPoints : 0;
        score += earned;
        feedback[block.id] = { correct: isCompleted, score: earned, maxScore: blockPoints };
        break;
      }

      case 'flow_challenge': {
        // flow challenge score is purely performance based
        let flowScore = 0;
        if (studentAnswer && typeof studentAnswer.score === 'number') {
           flowScore = studentAnswer.score;
        }
        const earned = Math.min(blockPoints, flowScore);
        score += earned;
        feedback[block.id] = { correct: earned > 0, score: earned, maxScore: blockPoints, details: studentAnswer };
        break;
      }

      case 'word_scramble': {
        const words = block.words || [];
        let scrambleScore = 0;
        words.forEach((item, idx) => {
          const correct = item.word.toLowerCase().trim();
          const student = (studentAnswer && studentAnswer[idx] || '').toLowerCase().trim();
          if (student === correct) scrambleScore++;
        });
        const earned = Math.round((scrambleScore / Math.max(words.length, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: scrambleScore === words.length, score: earned, maxScore: blockPoints };
        break;
      }

      case 'semantic_sorter': {
        const categories = block.categories || [];
        let sortScore = 0;
        let totalWords = 0;
        
        categories.forEach(cat => {
          totalWords += cat.words.length;
          const studentCatList = (studentAnswer && studentAnswer[cat.name]) || [];
          cat.words.forEach(word => {
            if (studentCatList.some(sw => sw.toLowerCase().trim() === word.toLowerCase().trim())) {
              sortScore++;
            }
          });
        });
        
        const earned = Math.round((sortScore / Math.max(totalWords, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: sortScore === totalWords, score: earned, maxScore: blockPoints };
        break;
      }

      case 'contextual_dialogue': {
        const messages = block.messages || [];
        let dialogueScore = 0;
        let gapCount = 0;
        
        messages.forEach((msg, idx) => {
          if (msg.isGap) {
            gapCount++;
            const correct = (msg.answer || '').toLowerCase().trim();
            const student = (studentAnswer && studentAnswer[idx] || '').toLowerCase().trim();
            if (student === correct || isAcceptableVariant(student, correct)) dialogueScore++;
          }
        });
        
        const earned = Math.round((dialogueScore / Math.max(gapCount, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: dialogueScore === gapCount, score: earned, maxScore: blockPoints };
        break;
      }
`

const targetCase = "case 'vocabulary': {"
if (content.includes(targetCase)) {
  content = content.replace(targetCase, injectCode + '\n      ' + targetCase)
  fs.writeFileSync(filePath, content)
  console.log('Success submissions.js patched')
} else {
  console.error('Target case not found in submissions.js')
}
