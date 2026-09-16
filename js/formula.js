/**
 * Dynamic Formula Lexer, AST Parser, and Evaluator
 * Supports:
 * - Natural syntax: IF condition THEN expr1 ELSE expr2
 * - Function syntax: IF(condition, expr1, expr2)
 * - Ternary syntax: condition ? expr1 : expr2
 * - Arithmetic: +, -, *, /, ^, %
 * - Comparisons: <, >, <=, >=, ==, =, !=, <>
 * - Logical: AND, &&, OR, ||, NOT, !
 * - Math Functions: MIN, MAX, ROUND, ABS, SQRT, FLOOR, CEIL, POW
 * - Lag/Time functions: PREV(measure, lag)
 * - Variables/Measures: msr1, msr2, [ActualSales], [Forecast], [Price], n, etc.
 */

class FormulaEngine {
  constructor() {
    this.customFunctions = {
      MIN: (...args) => Math.min(...args),
      MAX: (...args) => Math.max(...args),
      ROUND: (val, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
      },
      ABS: (val) => Math.abs(val),
      SQRT: (val) => Math.sqrt(val),
      FLOOR: (val) => Math.floor(val),
      CEIL: (val) => Math.ceil(val),
      POW: (base, exp) => Math.pow(base, exp),
      IF: (cond, tVal, fVal) => (cond ? tVal : fVal)
    };
  }

  /**
   * Tokenizes formula string into token stream
   */
  tokenize(formulaStr) {
    if (!formulaStr || typeof formulaStr !== 'string') {
      throw new Error('Formula must be a non-empty string');
    }

    const rawTokens = [];
    let i = 0;
    const src = formulaStr;
    const srcLen = src.length;

    while (i < srcLen) {
      const ch = src[i];

      // Whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Numbers
      if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] || ''))) {
        let numStr = '';
        while (i < srcLen && (/[\d.]/.test(src[i]))) {
          numStr += src[i];
          i++;
        }
        rawTokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
        continue;
      }

      // Bracketed identifier like [Actual Sales] or [Price]
      if (ch === '[') {
        let idStr = '';
        i++; // skip '['
        while (i < srcLen && src[i] !== ']') {
          idStr += src[i];
          i++;
        }
        if (i < srcLen && src[i] === ']') {
          i++; // skip ']'
        }
        rawTokens.push({ type: 'IDENTIFIER', value: idStr.trim() });
        continue;
      }

      // Two-character operators
      const twoChar = src.substr(i, 2);
      if (['<=', '>=', '==', '!=', '<>', '&&', '||'].includes(twoChar)) {
        let op = twoChar;
        if (op === '<>') op = '!=';
        if (op === '&&') op = 'AND';
        if (op === '||') op = 'OR';
        rawTokens.push({ type: 'OPERATOR', value: op });
        i += 2;
        continue;
      }

      // Single-character operators & punctuation
      if (['+', '-', '*', '/', '^', '%', '(', ')', ',', '?', ':', '<', '>', '=', '!'].includes(ch)) {
        let op = ch;
        if (op === '=') op = '==';
        if (op === '!') op = 'NOT';
        rawTokens.push({ type: op === '(' || op === ')' || op === ',' || op === '?' || op === ':' ? 'PUNCT' : 'OPERATOR', value: op });
        i++;
        continue;
      }

      // Words (Keywords, Function names, Identifiers)
      if (/[a-zA-Z_]/.test(ch)) {
        let word = '';
        while (i < srcLen && /[a-zA-Z0-9_]/.test(src[i])) {
          word += src[i];
          i++;
        }
        const upper = word.toUpperCase();
        if (['IF', 'THEN', 'ELSE', 'AND', 'OR', 'NOT'].includes(upper)) {
          rawTokens.push({ type: 'KEYWORD', value: upper });
        } else {
          rawTokens.push({ type: 'IDENTIFIER', value: word });
        }
        continue;
      }

      // Unrecognized character
      throw new Error(`Unexpected character '${ch}' at position ${i}`);
    }

    // Insert implicit multiplication e.g., (n-2)msr2 -> (n-2) * msr2 or (a)(b) -> (a) * (b) or 2(x) -> 2 * (x)
    const tokens = [];
    for (let t = 0; t < rawTokens.length; t++) {
      const curr = rawTokens[t];
      tokens.push(curr);

      if (t < rawTokens.length - 1) {
        const next = rawTokens[t + 1];
        const isCurrOperand = curr.value === ')' || curr.type === 'NUMBER';
        const isNextOperand = next.value === '(' || next.type === 'IDENTIFIER';

        if (isCurrOperand && isNextOperand && next.type !== 'KEYWORD') {
          tokens.push({ type: 'OPERATOR', value: '*' });
        }
      }
    }

    return tokens;
  }

  /**
   * Recursive descent parser generating an Abstract Syntax Tree (AST)
   */
  parse(formulaStr) {
    const tokens = this.tokenize(formulaStr);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = (expectedVal = null) => {
      const tok = tokens[pos];
      if (!tok) throw new Error('Unexpected end of formula');
      if (expectedVal && tok.value !== expectedVal) {
        throw new Error(`Expected '${expectedVal}', found '${tok.value}'`);
      }
      pos++;
      return tok;
    };

    const parseExpression = () => {
      return parseIfThenElse();
    };

    const parseIfThenElse = () => {
      const tok = peek();
      if (tok && tok.type === 'KEYWORD' && tok.value === 'IF') {
        consume('IF');
        const condition = parseTernary();
        consume('THEN');
        const trueExpr = parseTernary();
        consume('ELSE');
        const falseExpr = parseExpression();
        return {
          type: 'IF_THEN_ELSE',
          condition,
          trueExpr,
          falseExpr
        };
      }
      return parseTernary();
    };

    const parseTernary = () => {
      let node = parseLogicalOr();
      const tok = peek();
      if (tok && tok.value === '?') {
        consume('?');
        const trueExpr = parseExpression();
        consume(':');
        const falseExpr = parseExpression();
        return {
          type: 'IF_THEN_ELSE',
          condition: node,
          trueExpr,
          falseExpr
        };
      }
      return node;
    };

    const parseLogicalOr = () => {
      let left = parseLogicalAnd();
      while (peek() && (peek().value === 'OR' || peek().value === '||')) {
        const op = consume().value;
        const right = parseLogicalAnd();
        left = { type: 'BINARY_OP', op: 'OR', left, right };
      }
      return left;
    };

    const parseLogicalAnd = () => {
      let left = parseComparison();
      while (peek() && (peek().value === 'AND' || peek().value === '&&')) {
        const op = consume().value;
        const right = parseComparison();
        left = { type: 'BINARY_OP', op: 'AND', left, right };
      }
      return left;
    };

    const parseComparison = () => {
      let left = parseAddSub();
      while (peek() && ['<', '>', '<=', '>=', '==', '!='].includes(peek().value)) {
        const op = consume().value;
        const right = parseAddSub();
        left = { type: 'BINARY_OP', op, left, right };
      }
      return left;
    };

    const parseAddSub = () => {
      let left = parseMulDiv();
      while (peek() && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseMulDiv();
        left = { type: 'BINARY_OP', op, left, right };
      }
      return left;
    };

    const parseMulDiv = () => {
      let left = parsePower();
      while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
        const op = consume().value;
        const right = parsePower();
        left = { type: 'BINARY_OP', op, left, right };
      }
      return left;
    };

    const parsePower = () => {
      let left = parseUnary();
      while (peek() && peek().value === '^') {
        const op = consume().value;
        const right = parseUnary();
        left = { type: 'BINARY_OP', op: '^', left, right };
      }
      return left;
    };

    const parseUnary = () => {
      const tok = peek();
      if (tok && (tok.value === '-' || tok.value === '+' || tok.value === 'NOT')) {
        const op = consume().value;
        const arg = parseUnary();
        return { type: 'UNARY_OP', op, arg };
      }
      return parsePrimary();
    };

    const parsePrimary = () => {
      const tok = peek();
      if (!tok) throw new Error('Unexpected end of input in expression');

      // Parentheses (expr)
      if (tok.value === '(') {
        consume('(');
        const expr = parseExpression();
        consume(')');
        return expr;
      }

      // Number constant
      if (tok.type === 'NUMBER') {
        consume();
        return { type: 'LITERAL', value: tok.value };
      }

      // Function or Identifier
      if (tok.type === 'IDENTIFIER') {
        const idName = consume().value;
        // Check if function call e.g. MIN(a, b) or IF(a, b, c) or PREV(msr, 1)
        if (peek() && peek().value === '(') {
          consume('(');
          const args = [];
          if (peek() && peek().value !== ')') {
            args.push(parseExpression());
            while (peek() && peek().value === ',') {
              consume(',');
              args.push(parseExpression());
            }
          }
          consume(')');
          return {
            type: 'FUNCTION_CALL',
            name: idName.toUpperCase(),
            args
          };
        }
        return { type: 'VARIABLE', name: idName };
      }

      throw new Error(`Unexpected token '${tok.value}'`);
    };

    const ast = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected extra token '${tokens[pos].value}' at end of formula`);
    }
    return ast;
  }

  /**
   * Evaluates AST in a given context (scope with variable dictionary and time series lookup)
   */
  evaluateAST(ast, context = {}) {
    if (!ast) return 0;

    switch (ast.type) {
      case 'LITERAL':
        return ast.value;

      case 'VARIABLE': {
        const varName = ast.name;
        const val = this.resolveVariable(varName, context);
        return typeof val === 'number' && !isNaN(val) ? val : 0;
      }

      case 'UNARY_OP': {
        const val = this.evaluateAST(ast.arg, context);
        if (ast.op === '-') return -val;
        if (ast.op === '+') return +val;
        if (ast.op === 'NOT') return val ? 0 : 1;
        return val;
      }

      case 'BINARY_OP': {
        const l = this.evaluateAST(ast.left, context);
        const r = this.evaluateAST(ast.right, context);

        switch (ast.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return r !== 0 ? l / r : 0;
          case '%': return r !== 0 ? l % r : 0;
          case '^': return Math.pow(l, r);
          case '<': return l < r ? 1 : 0;
          case '>': return l > r ? 1 : 0;
          case '<=': return l <= r ? 1 : 0;
          case '>=': return l >= r ? 1 : 0;
          case '==': return l === r ? 1 : 0;
          case '!=': return l !== r ? 1 : 0;
          case 'AND': return (l && r) ? 1 : 0;
          case 'OR': return (l || r) ? 1 : 0;
          default: return 0;
        }
      }

      case 'IF_THEN_ELSE': {
        const cond = this.evaluateAST(ast.condition, context);
        if (cond) {
          return this.evaluateAST(ast.trueExpr, context);
        } else {
          return this.evaluateAST(ast.falseExpr, context);
        }
      }

      case 'FUNCTION_CALL': {
        const fnName = ast.name;

        // Special handling for PREV(measure, lag)
        if (fnName === 'PREV' || fnName === 'LAG') {
          const measureArg = ast.args[0];
          const measureName = measureArg.type === 'VARIABLE' ? measureArg.name : String(this.evaluateAST(measureArg, context));
          const lag = ast.args[1] ? Math.round(this.evaluateAST(ast.args[1], context)) : 1;
          if (context.getLagValue && typeof context.getLagValue === 'function') {
            return context.getLagValue(measureName, lag);
          }
          return 0;
        }

        const evaluatedArgs = ast.args.map(arg => this.evaluateAST(arg, context));
        const fn = this.customFunctions[fnName];
        if (fn) {
          return fn(...evaluatedArgs);
        }
        throw new Error(`Unknown function '${fnName}'`);
      }

      default:
        return 0;
    }
  }

  /**
   * Resolves variable name from context dictionary with flexible key matching
   */
  resolveVariable(varName, context) {
    if (!context || !context.vars) return 0;
    const vars = context.vars;

    // Direct match
    if (varName in vars) return vars[varName];

    // Normalized match (strip spaces, lowercase)
    const normSearch = varName.replace(/[\s_\[\]]/g, '').toLowerCase();
    for (const key of Object.keys(vars)) {
      const normKey = key.replace(/[\s_\[\]]/g, '').toLowerCase();
      if (normKey === normSearch) {
        return vars[key];
      }
    }

    // Measure alias mapping (e.g. msr1, msr2, msr3)
    if (context.aliases && context.aliases[varName.toLowerCase()]) {
      const actualKey = context.aliases[varName.toLowerCase()];
      return this.resolveVariable(actualKey, context);
    }

    // Global parameters (like n)
    if (context.params && varName in context.params) {
      return context.params[varName];
    }

    return 0;
  }

  /**
   * Validates a formula string and extracts variable references
   */
  validate(formulaStr) {
    try {
      const ast = this.parse(formulaStr);
      const variables = new Set();
      const functions = new Set();

      const walk = (node) => {
        if (!node) return;
        if (node.type === 'VARIABLE') {
          variables.add(node.name);
        } else if (node.type === 'FUNCTION_CALL') {
          functions.add(node.name);
          node.args.forEach(walk);
        } else if (node.type === 'BINARY_OP') {
          walk(node.left);
          walk(node.right);
        } else if (node.type === 'UNARY_OP') {
          walk(node.arg);
        } else if (node.type === 'IF_THEN_ELSE') {
          walk(node.condition);
          walk(node.trueExpr);
          walk(node.falseExpr);
        }
      };

      walk(ast);
      return {
        valid: true,
        ast,
        variables: Array.from(variables),
        functions: Array.from(functions)
      };
    } catch (err) {
      return {
        valid: false,
        error: err.message
      };
    }
  }
}

// Global export for vanilla browser usage
window.FormulaEngine = FormulaEngine;
