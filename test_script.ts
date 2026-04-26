import { analyzeCode } from './src/engine/optimizer';
import fs from 'fs';

const code = fs.readFileSync('sample.c', 'utf8');
const report = analyzeCode(code);

console.log("Suggestions:", report.suggestions.map(s => s.type));
console.log("Optimized Code:\n", report.optimizedCode);
