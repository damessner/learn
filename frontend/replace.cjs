const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.vue') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('c:/Users/dames/OneDrive - Mittelschule Telfs/github/learn/frontend/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('const API_BASE =')) {
        let newContent = content.replace(
            "const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api'",
            "const API_BASE = '/api'"
        );
        newContent = newContent.replace(
            "const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001' : ''",
            "const API_BASE = ''"
        );
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log('Updated ' + file);
        }
    }
});
