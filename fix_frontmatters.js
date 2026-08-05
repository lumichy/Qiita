const fs = require('fs');
const path = require('path');
const dir = './public';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

let issues = [];

files.forEach(f => {
  const filePath = path.join(dir, f);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 15);
  const idLine = lines.find(l => l.startsWith('id:'));
  const updateLine = lines.find(l => l.startsWith('updated_at:'));

  if (idLine && idLine.includes('null')) {
    issues.push({ file: f, issue: 'id is null' });
  }
  if (updateLine && updateLine.trim() !== "updated_at: ''") {
    issues.push({ file: f, issue: 'updated_at is not empty: ' + updateLine.trim() });
  }
});

console.log('--- ISSUES COUNT:', issues.length, '---');
if (issues.length > 0) {
  console.log(issues);
} else {
  console.log('ALL FRONTMATTERS ARE PERFECT!');
}
