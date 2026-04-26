# Intelligent Code Optimizer

An advanced, production-grade static code analysis and optimization engine built entirely in TypeScript and React. This project provides a real-time, browser-based "Dark IDE" experience that visualizes compiler-level mechanics—from lexical analysis to control flow graph generation—and offers actionable optimization suggestions.

## 🌟 Key Features

### 1. Real-Time Compiler Pipeline
- **Debounced Analysis Engine:** Analyzes user code locally on every keystroke with a 600ms debounce to ensure high performance without locking the UI.
- **Enterprise-Grade Performance:** Processes ~65,000 lines per second, scales linearly O(N), zero memory leaks under extreme load.
- **Custom Lexer:** Robust tokenizer supporting full C-constructs with strict error boundary reporting.
- **Recursive Descent Parser:** Constructs a fully-typed Abstract Syntax Tree (AST) complete with safeguards for maximum recursion depth and timeouts.
- **Scope-Aware Symbol Table:** Tracks variable declarations, shadowing, and liveness to detect genuinely unused or undeclared variables.
- **Control Flow Graph (CFG) Generator:** Transforms the AST into a directed graph to accurately calculate execution paths, block reachability, and cyclomatic complexity.

### 2. Intelligent Diagnostics & Optimizations
- **Unreachable Code Elimination:** Uses the CFG to find dead blocks (e.g., code following a `return` or `break` statement).
- **Constant Folding:** Detects binary expressions with literal operands and evaluates them at compile-time (e.g., `5 + 3` becomes `8`).
- **Unused Variables:** Identifies declared symbols that are never referenced within their lexical scope, specifically filtering out function declarations and `main`.
- **Common Subexpression Elimination (CSE):** Utilizes recursive hashing to identify redundant calculations and suggests temporary variables.
- **Loop-Invariant Code Motion (LICM):** Analyzes loop bodies to detect expressions whose operands do not mutate during the loop, suggesting they be hoisted out.

### 3. Dynamic "Dark IDE" Visualizations
- **Three-Panel Layout:** A sleek, developer-focused Navy/Cyan theme with an integrated React-Simple-Code-Editor.
- **Token Stream View:** Real-time visual layout of the Lexer's output.
- **AST Hierarchical Viewer:** A custom SVG-based tree renderer with **Virtualized DOM** to handle massive codebases with zero lag, featuring minimap and strict scroll isolation.
- **CFG Layered Viewer:** An advanced SVG flow graph that maps branching logic, clearly distinguishing between reachable (cyan) and unreachable (red) code blocks.
- **AST Compare Engine:** A robust, independent dual-pane virtualized visualizer implementing an O(N*K) Greedy Lookahead diff algorithm. Shows identical, added, and removed nodes between original and optimized syntax trees.
- **Side-by-Side Diffs:** Suggestion cards that provide interactive "Before" and "After" code comparisons.
- **Auto-Optimization Engine:** Click to automatically rewrite code, stripping unused variables, folding constants, and hoisting invariant code.
- **Live Metrics Dashboard:** Tracks Tokens Parsed, AST/CFG Nodes, Analysis Time, Lines of Code, Cyclomatic Complexity, and Block Reachability dynamically.

### 4. Telemetry & Debugging
- **Supabase Integration:** Fire-and-forget telemetry pushes detailed compiler metrics, AST size, and session timings to a PostgreSQL database using `JSONB` for analytical dashboards.
- **Automated Test Runner:** Access `/?debug=true` to run a headless suite of core compiler tests verifying Constant Folding, Liveness, Dead Code, and CFG construction directly in the browser.

---

## 🏗️ Architecture & Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS (Custom Dark Theme), Lucide React (Icons)
- **Editor:** `react-simple-code-editor` with `prismjs` highlighting
- **Backend/Telemetry:** Supabase (PostgreSQL)
- **Compiler Core (No heavy dependencies):**
  - `src/lib/compiler/lexer.ts`: Tokenization
  - `src/lib/compiler/parser.ts`: AST Generation
  - `src/lib/compiler/symbolTable.ts`: Scope and Symbol tracking
  - `src/lib/compiler/cfg.ts`: Control Flow Graph building
  - `src/lib/compiler/analyzers/*`: Discrete optimization passes
  - `src/lib/compiler/optimizer.ts`: Master pipeline orchestrator

---

## 📁 Project Structure

```text
project/
├── supabase/
│   └── migrations/
│       └── 20260131135431_create_analysis_schema.sql  # Supabase schema for telemetry
├── src/
│   ├── components/
│   │   ├── ASTViewer.tsx          # SVG Tree renderer for AST
│   │   ├── CFGViewer.tsx          # SVG Flow graph for CFG
│   │   ├── CodeEditor.tsx         # Main syntax-highlighted editor
│   │   ├── Dashboard.tsx          # 3-panel layout orchestrator
│   │   ├── DiffViewer.tsx         # Before/After optimization differences
│   │   ├── MetricsPanel.tsx       # Live statistics dashboard
│   │   ├── OptimizationCard.tsx   # Individual suggestion UI
│   │   ├── ResultsPanel.tsx       # Aggregates metrics, errors, and suggestions
│   │   ├── TestRunner.tsx         # Headless test verification suite
│   │   └── TokenStreamView.tsx    # Lexical token visualizer
│   ├── lib/
│   │   ├── compiler/
│   │   │   ├── analyzers/         # CSE, LICM, DeadCode, ConstantFolding, UnusedVars
│   │   │   ├── cfg.ts             # Control Flow logic
│   │   │   ├── lexer.ts           # Tokenizer logic
│   │   │   ├── optimizer.ts       # Pipeline runner
│   │   │   ├── parser.ts          # AST constructor
│   │   │   ├── symbolTable.ts     # Scope management
│   │   │   └── types.ts           # Shared interfaces
│   │   └── supabase.ts            # Supabase client wrapper
│   ├── App.tsx                    # React Entry point & Telemetry Hook
│   ├── index.css                  # Global Tailwind & Custom Theme variables
│   └── main.tsx
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Telemetry (Optional):**
   Create a `.env` file in the root for Supabase logging:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   *To setup the database, run `supabase db push` to apply the migrations.*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

5. **Access the App:**
   - **Main IDE:** Open `http://localhost:5173/`
   - **Debug Runner:** Open `http://localhost:5173/?debug=true` to verify engine stability.
