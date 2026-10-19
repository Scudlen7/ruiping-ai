import fs from 'fs';

fs.readdirSync('.')
  .filter(f => f.startsWith('app.config.timestamp_'))
  .forEach(f => fs.rmSync(f, { force: true }));

console.log('已清理 timestamp 临时文件');