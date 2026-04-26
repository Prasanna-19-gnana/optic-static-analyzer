import { ASTNode, OptimizationSuggestion } from '../types';

export function analyzeCommonSubexpressions(ast: ASTNode | null): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const expressionMap = new Map<string, ASTNode[]>();

  function hashExpression(node: ASTNode): string | null {
    if (node.type === 'BinaryExpression') {
      const leftHash = hashExpression(node.left);
      const rightHash = hashExpression(node.right);
      if (leftHash && rightHash) {
        return `(${leftHash} ${node.operator} ${rightHash})`;
      }
    } else if (node.type === 'Identifier') {
      return node.name;
    } else if (node.type === 'Literal') {
      return node.raw;
    }
    return null;
  }

  function traverse(node: ASTNode | null) {
    if (!node) return;
    
    if (node.type === 'BinaryExpression') {
      const hash = hashExpression(node);
      if (hash && hash.length > 5) { // Only track non-trivial expressions
        const nodes = expressionMap.get(hash) || [];
        nodes.push(node);
        expressionMap.set(hash, nodes);
      }
    }

    Object.values(node).forEach(child => {
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach(c => traverse(c as ASTNode));
        } else if ('type' in child) {
          traverse(child as ASTNode);
        }
      }
    });
  }

  traverse(ast);

  for (const [hash, nodes] of expressionMap.entries()) {
    if (nodes.length > 1) {
      const line1 = 'line' in nodes[0] && nodes[0].line ? nodes[0].line : 0;
      const line2 = 'line' in nodes[1] && nodes[1].line ? nodes[1].line : line1;
      // Strip outer parens from hash for display
      const exprDisplay = hash.startsWith('(') && hash.endsWith(')')
        ? hash.slice(1, -1)
        : hash;
      suggestions.push({
        id: `cse-${line1}`,
        type: 'Common Subexpression Elimination',
        title: 'Redundant Calculation',
        description: `The expression \`${exprDisplay}\` is calculated ${nodes.length} times. Compute it once, store it in a temporary variable, and reuse it.`,
        line: line2,
        severity: 'medium',
        beforeCode: `// Line ${line1}: first computation\n... = ${exprDisplay} ...;\n// Line ${line2}: redundant recomputation\n... = ${exprDisplay} ...;`,
        afterCode: `// Hoisted — computed only once:\nauto __cse = ${exprDisplay};\n// Line ${line1}: reuse temp\n... = __cse ...;\n// Line ${line2}: reuse temp\n... = __cse ...;`,
        hash: hash,
        nodes: nodes
      });
    }
  }

  return suggestions;
}
