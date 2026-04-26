// CFG dead-block regression test
import { tokenize } from './src/engine/lexer';
import { parse } from './src/engine/parser';
import { buildCFG } from './src/engine/cfg';

interface TestCase { name: string; code: string; expectedDead: number; expectedNodes: number; }

const tests: TestCase[] = [
  {
    name: 'Simple linear function — 0 dead blocks',
    code: `int compute(int x, int y) {
    int a = x * y + 10;
    int b = x * y + 20;
    return a + b;
}`,
    expectedDead: 0,
    expectedNodes: 2,  // entry + exit
  },
  {
    name: 'if(0) dead branch — exactly 1 dead block',
    code: `int f() {
    if (0) {
        int x = 1;
    }
    return 0;
}`,
    expectedDead: 1,
    expectedNodes: -1, // don't check total
  },
  {
    name: 'for loop — 0 dead blocks',
    code: `int sum() {
    int r = 0;
    for (int i = 0; i < 10; i = i + 1) {
        r = r + i;
    }
    return r;
}`,
    expectedDead: 0,
    expectedNodes: -1,
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const errors: any[] = [];
  const tokens = tokenize(t.code, errors);
  const ast = parse(tokens, errors);
  const cfg = buildCFG(ast);

  const reachable = cfg.filter(n => n.isReachable).length;
  const dead      = cfg.filter(n => !n.isReachable).length;

  const deadOk  = dead  === t.expectedDead;
  const nodesOk = t.expectedNodes === -1 || cfg.length === t.expectedNodes;

  if (deadOk && nodesOk) {
    console.log(`  ✅ ${t.name}`);
    console.log(`     nodes=${cfg.length}  reachable=${reachable}  dead=${dead}`);
    passed++;
  } else {
    console.log(`  ❌ ${t.name}`);
    console.log(`     nodes=${cfg.length}  reachable=${reachable}  dead=${dead}`);
    if (!deadOk)  console.log(`     expected dead=${t.expectedDead}, got dead=${dead}`);
    if (!nodesOk) console.log(`     expected nodes=${t.expectedNodes}, got nodes=${cfg.length}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
