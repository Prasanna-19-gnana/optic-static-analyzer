import { tokenize } from './src/engine/lexer';
import { parse } from './src/engine/parser';
import { buildCFG } from './src/engine/cfg';
import { analyzeCode } from './src/engine/optimizer';

interface TestCase {
  name: string;
  code: string;
}

const tests: TestCase[] = [
  {
    name: 'Empty program',
    code: ``,
  },
  {
    name: 'Missing semicolons and braces',
    code: `int main()
    int x = 5
    if (x)
        return x
    return 0`,
  },
  {
    name: 'Extreme deeply nested math',
    code: `int calc() {
      return (((1 + 2) * (3 + 4)) / ((5 - 6) * 7)) + (8 * (9 + (10 / 2)));
    }`,
  },
  {
    name: 'Dead code nested in while and if',
    code: `int f() {
      int a = 1;
      while (0) {
        if (1) {
          int b = 2;
        } else {
          int c = 3;
        }
      }
      return a;
    }`,
  },
  {
    name: 'Multiple identical subexpressions (CSE extreme)',
    code: `int f(int a, int b) {
      int x = (a + b) * (a + b);
      int y = (a + b) / (a + b);
      int z = (a + b) + (a + b);
      return x + y + z;
    }`,
  },
  {
    name: 'LICM with multiple invariants',
    code: `int f(int x, int y) {
      int result = 0;
      for (int i = 0; i < 100; i = i + 1) {
        int inv1 = x * y;
        int inv2 = x + y;
        result = result + inv1 + inv2 + i;
      }
      return result;
    }`,
  },
  {
    name: 'Unused variables with identical names in different scopes',
    code: `int f() {
      int x = 1;
      if (1) {
        int x = 2; // unused
      }
      int y = x; // uses outer x
      return y;
    }`,
  },
  {
    name: 'Auto keyword parsing',
    code: `int f() {
      auto x = 5;
      auto y = x + 1;
      return y;
    }`
  }
];

console.log('Running extreme edge cases...');
let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    const errors: any[] = [];
    const tokens = tokenize(t.code, errors);
    const ast = parse(tokens, errors);
    const cfg = buildCFG(ast);
    const result = analyzeCode(t.code);
    
    // We expect the optimizer to run without crashing, even if there are syntax errors (which it should report)
    console.log(`✅ ${t.name} (Errors: ${result.errors.length}, Opts: ${result.suggestions.length})`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${t.name}`);
    console.error(e.message);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
