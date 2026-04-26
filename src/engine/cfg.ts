import { ASTNode, CFGNode } from './types';

export function buildCFG(ast: ASTNode | null): CFGNode[] {
  if (!ast || ast.type !== 'Program') return [];

  const allNodes: CFGNode[] = [];
  let nextId = 1;

  function createNode(nodeList: CFGNode[], statements: ASTNode[] = []): CFGNode {
    const node: CFGNode = {
      id: nextId++,
      statements,
      successors: [],
      predecessors: [],
      isReachable: false
    };
    nodeList.push(node);
    return node;
  }

  function link(from: CFGNode, to: CFGNode) {
    if (!from.successors.includes(to.id)) from.successors.push(to.id);
    if (!to.predecessors.includes(from.id)) to.predecessors.push(from.id);
  }

  // Build CFG for a single function body
  function buildFunctionCFG(funcNode: ASTNode): CFGNode[] {
    const nodes: CFGNode[] = [];
    const entry = createNode(nodes);
    entry.isEntry = true;
    let currentBlock = entry;

    // If this is a FunctionDeclaration, register params
    if (funcNode.type === 'FunctionDeclaration' && funcNode.params && funcNode.params.length > 0) {
      for (const p of funcNode.params) {
        currentBlock.statements.push({
          type: 'VariableDeclaration',
          name: p.name,
          varType: p.type,
          init: null,
          line: p.line,
        });
      }
    }

    function traverse(node: ASTNode) {
      if (node.type === 'BlockStatement') {
        for (const stmt of node.body) {
          traverse(stmt);
        }
      } else if (node.type === 'IfStatement') {
        currentBlock.statements.push(node.test);
        const ifNode = currentBlock;

        let isAlwaysTrue = false;
        let isAlwaysFalse = false;
        if (node.test && node.test.type === 'Literal') {
          if (node.test.value === 0 || node.test.value === '0' || node.test.value === false) {
            isAlwaysFalse = true;
          } else {
            isAlwaysTrue = true;
          }
        }

        const thenBlock = createNode(nodes);
        if (!isAlwaysFalse) {
          link(ifNode, thenBlock);
        }
        currentBlock = thenBlock;
        traverse(node.consequent);
        const thenEnd = currentBlock;

        let elseEnd: CFGNode | null = null;
        if (node.alternate) {
          const elseBlock = createNode(nodes);
          if (!isAlwaysTrue) {
            link(ifNode, elseBlock);
          }
          currentBlock = elseBlock;
          traverse(node.alternate);
          elseEnd = currentBlock;
        }

        const mergeBlock = createNode(nodes);
        if (!isAlwaysFalse) {
          link(thenEnd, mergeBlock);
        }
        if (elseEnd) {
          if (!isAlwaysTrue) {
            link(elseEnd, mergeBlock);
          }
        } else {
          if (!isAlwaysTrue && !isAlwaysFalse) {
            link(ifNode, mergeBlock);
          } else if (isAlwaysFalse) {
            link(ifNode, mergeBlock);
          }
        }
        currentBlock = mergeBlock;
      } else if (node.type === 'WhileStatement') {
        const headerBlock = createNode(nodes);
        link(currentBlock, headerBlock);
        headerBlock.statements.push(node.test);

        const bodyBlock = createNode(nodes);
        link(headerBlock, bodyBlock);
        currentBlock = bodyBlock;
        traverse(node.body);
        link(currentBlock, headerBlock); // Back edge

        const exitBlock = createNode(nodes);
        link(headerBlock, exitBlock);
        currentBlock = exitBlock;
      } else if (node.type === 'ForStatement') {
        // Process init in current block
        if (node.init) {
          currentBlock.statements.push(node.init);
        }

        // Header block (condition)
        const headerBlock = createNode(nodes);
        link(currentBlock, headerBlock);
        if (node.condition) {
          headerBlock.statements.push(node.condition);
        }

        // Body block
        const bodyBlock = createNode(nodes);
        link(headerBlock, bodyBlock);
        currentBlock = bodyBlock;
        traverse(node.body);

        // Update expression at end of body
        if (node.update) {
          currentBlock.statements.push(node.update);
        }

        // Back edge: body end → header
        link(currentBlock, headerBlock);

        // Exit block
        const exitBlock = createNode(nodes);
        link(headerBlock, exitBlock);
        currentBlock = exitBlock;
      } else if (node.type === 'ReturnStatement') {
        currentBlock.statements.push(node);
        const exitBlock = createNode(nodes);
        exitBlock.isExit = true;
        link(currentBlock, exitBlock);
        // Mark current as terminated — do NOT create a ghost unreachable block
        (currentBlock as any)._terminated = true;
      } else {
        // ExpressionStatement, VariableDeclaration, etc.
        currentBlock.statements.push(node);
      }
    }

    // Traverse the function body
    const body = funcNode.type === 'FunctionDeclaration' ? funcNode.body : funcNode;
    try {
      traverse(body);
    } catch (e) {
      if (nodes.length === 0) return [];
      return nodes;
    }

    // Only add final exit if the last block wasn't already terminated by a return
    if (!(currentBlock as any)._terminated) {
      const finalExit = createNode(nodes);
      finalExit.isExit = true;
      link(currentBlock, finalExit);
    }

    // Reachability analysis (BFS from entry)
    const queue = [entry.id];
    entry.isReachable = true;
    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = nodes.find(n => n.id === currId);
      if (currNode) {
        for (const succId of currNode.successors) {
          const succNode = nodes.find(n => n.id === succId);
          if (succNode && !succNode.isReachable) {
            succNode.isReachable = true;
            queue.push(succId);
          }
        }
      }
    }

    return nodes;
  }

  // Process each top-level declaration separately
  const topLevelStmts: ASTNode[] = [];
  for (const topLevel of ast.body) {
    if (topLevel.type === 'FunctionDeclaration') {
      const funcCFG = buildFunctionCFG(topLevel);
      allNodes.push(...funcCFG);
    } else {
      topLevelStmts.push(topLevel);
    }
  }

  // If there are top-level statements, build a single CFG for all of them
  if (topLevelStmts.length > 0) {
    const pseudoFunc: ASTNode = {
      type: 'BlockStatement',
      body: topLevelStmts,
      line: 'line' in topLevelStmts[0] && topLevelStmts[0].line ? topLevelStmts[0].line : 1
    };
    allNodes.push(...buildFunctionCFG(pseudoFunc));
  }

  return allNodes;
}
