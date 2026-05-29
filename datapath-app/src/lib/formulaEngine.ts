import type { DataRow } from '../types';

/**
 * Safe spreadsheet-style formula engine (no eval).
 * Supports: + - * / % ^, parentheses, numbers, string literals "..",
 * column references via [Column Name] or bareword identifiers,
 * comparisons (= == != <> < <= > >=), and functions:
 *   ABS, ROUND, FLOOR, CEIL, SQRT, LOG, LN, MIN, MAX, POW, MOD,
 *   IF(cond, a, b), CONCAT(...), UPPER, LOWER, TRIM, LEN, AND, OR, NOT.
 */

type TokenType = 'num' | 'str' | 'col' | 'op' | 'lparen' | 'rparen' | 'comma' | 'func' | 'ident';
interface Token {
  type: TokenType;
  value: string;
}

const FUNCTIONS = new Set([
  'ABS', 'ROUND', 'FLOOR', 'CEIL', 'SQRT', 'LOG', 'LN', 'MIN', 'MAX', 'POW', 'MOD',
  'IF', 'CONCAT', 'UPPER', 'LOWER', 'TRIM', 'LEN', 'AND', 'OR', 'NOT',
]);

const OPERATORS: Record<string, { prec: number; assoc: 'L' | 'R'; argc: 2 }> = {
  '||': { prec: 1, assoc: 'L', argc: 2 },
  '&&': { prec: 2, assoc: 'L', argc: 2 },
  '=': { prec: 3, assoc: 'L', argc: 2 },
  '==': { prec: 3, assoc: 'L', argc: 2 },
  '!=': { prec: 3, assoc: 'L', argc: 2 },
  '<>': { prec: 3, assoc: 'L', argc: 2 },
  '<': { prec: 3, assoc: 'L', argc: 2 },
  '<=': { prec: 3, assoc: 'L', argc: 2 },
  '>': { prec: 3, assoc: 'L', argc: 2 },
  '>=': { prec: 3, assoc: 'L', argc: 2 },
  '+': { prec: 4, assoc: 'L', argc: 2 },
  '-': { prec: 4, assoc: 'L', argc: 2 },
  '*': { prec: 5, assoc: 'L', argc: 2 },
  '/': { prec: 5, assoc: 'L', argc: 2 },
  '%': { prec: 5, assoc: 'L', argc: 2 },
  '^': { prec: 6, assoc: 'R', argc: 2 },
};

export class FormulaError extends Error {}

function tokenize(input: string, columns: string[]): Token[] {
  const tokens: Token[] = [];
  const colSet = new Set(columns.map(c => c.toLowerCase()));
  let i = 0;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isIdentStart = (c: string) => /[A-Za-z_\u0600-\u06FF]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_\u0600-\u06FF.]/.test(c);

  while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    // Bracketed column reference [Col Name]
    if (c === '[') {
      const end = input.indexOf(']', i + 1);
      if (end === -1) throw new FormulaError('قوس عمود غير مغلق [');
      tokens.push({ type: 'col', value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    // String literal
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let s = '';
      while (j < input.length && input[j] !== quote) { s += input[j]; j++; }
      if (j >= input.length) throw new FormulaError('نص غير مغلق');
      tokens.push({ type: 'str', value: s });
      i = j + 1;
      continue;
    }

    // Number
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1] ?? ''))) {
      let j = i;
      while (j < input.length && (isDigit(input[j]) || input[j] === '.')) j++;
      tokens.push({ type: 'num', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Two-char operators
    const two = input.slice(i, i + 2);
    if (['==', '!=', '<>', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    // Single-char operators / parens / comma
    if ('+-*/%^=<>'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen', value: c }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen', value: c }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma', value: c }); i++; continue; }

    // Identifier: function, bareword column, or boolean
    if (isIdentStart(c)) {
      let j = i;
      while (j < input.length && isIdent(input[j])) j++;
      const word = input.slice(i, j);
      const upper = word.toUpperCase();
      // function only if followed by '('
      let k = j;
      while (k < input.length && input[k] === ' ') k++;
      if (FUNCTIONS.has(upper) && input[k] === '(') {
        tokens.push({ type: 'func', value: upper });
      } else if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'num', value: upper === 'TRUE' ? '1' : '0' });
      } else if (colSet.has(word.toLowerCase())) {
        tokens.push({ type: 'col', value: word });
      } else {
        tokens.push({ type: 'ident', value: word });
      }
      i = j;
      continue;
    }

    throw new FormulaError(`رمز غير معروف: "${c}"`);
  }
  return tokens;
}

/** Shunting-yard → RPN output (array of tokens with function arg counts). */
interface RPNToken extends Token {
  argc?: number;
}

function toRPN(tokens: Token[], columns: string[]): RPNToken[] {
  const output: RPNToken[] = [];
  const stack: Token[] = [];
  const argCount: number[] = [];
  const wasValue: boolean[] = [];

  const resolveColumn = (name: string): string => {
    const exact = columns.find(c => c === name);
    if (exact) return exact;
    const ci = columns.find(c => c.toLowerCase() === name.toLowerCase());
    if (!ci) throw new FormulaError(`عمود غير موجود: ${name}`);
    return ci;
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.type === 'num' || t.type === 'str') {
      output.push(t);
    } else if (t.type === 'col') {
      output.push({ type: 'col', value: resolveColumn(t.value) });
    } else if (t.type === 'ident') {
      throw new FormulaError(`غير معروف: ${t.value} (استخدم [اسم العمود] إن كان عموداً)`);
    } else if (t.type === 'func') {
      stack.push(t);
    } else if (t.type === 'comma') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        output.push(stack.pop()!);
      }
      if (argCount.length) {
        if (wasValue[wasValue.length - 1]) argCount[argCount.length - 1]++;
        wasValue[wasValue.length - 1] = false;
      }
    } else if (t.type === 'op') {
      const o1 = OPERATORS[t.value];
      if (!o1) throw new FormulaError(`عامل غير مدعوم: ${t.value}`);
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'op') {
          const o2 = OPERATORS[top.value];
          if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec)) {
            output.push(stack.pop()!);
            continue;
          }
        }
        break;
      }
      stack.push(t);
    } else if (t.type === 'lparen') {
      stack.push(t);
      const prev = tokens[idx - 1];
      if (prev && prev.type === 'func') {
        argCount.push(0);
        wasValue.push(false);
      }
    } else if (t.type === 'rparen') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        output.push(stack.pop()!);
      }
      if (!stack.length) throw new FormulaError('أقواس غير متوازنة');
      stack.pop(); // remove lparen
      if (stack.length && stack[stack.length - 1].type === 'func') {
        const fn = stack.pop()!;
        let argc = argCount.pop() ?? 0;
        if (wasValue.pop()) argc++;
        output.push({ type: 'func', value: fn.value, argc });
      }
    }

    // track value presence for arg counting
    if (argCount.length) {
      if (t.type === 'num' || t.type === 'str' || t.type === 'col' || t.type === 'rparen') {
        wasValue[wasValue.length - 1] = true;
      }
    }
  }

  while (stack.length) {
    const t = stack.pop()!;
    if (t.type === 'lparen' || t.type === 'rparen') throw new FormulaError('أقواس غير متوازنة');
    output.push(t);
  }
  return output;
}

type Cell = string | number | null;

function toNum(v: Cell): number {
  if (v === null || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function applyFunc(name: string, args: Cell[]): Cell {
  const n = (x: Cell) => toNum(x);
  switch (name) {
    case 'ABS': return Math.abs(n(args[0]));
    case 'ROUND': return Number(n(args[0]).toFixed(args[1] != null ? n(args[1]) : 0));
    case 'FLOOR': return Math.floor(n(args[0]));
    case 'CEIL': return Math.ceil(n(args[0]));
    case 'SQRT': return Math.sqrt(n(args[0]));
    case 'LOG': return Math.log10(n(args[0]));
    case 'LN': return Math.log(n(args[0]));
    case 'POW': return Math.pow(n(args[0]), n(args[1]));
    case 'MOD': return n(args[0]) % n(args[1]);
    case 'MIN': return Math.min(...args.map(n));
    case 'MAX': return Math.max(...args.map(n));
    case 'IF': return (toNum(args[0]) !== 0 && args[0] !== null && args[0] !== '') ? args[1] : args[2] ?? null;
    case 'CONCAT': return args.map(a => (a == null ? '' : String(a))).join('');
    case 'UPPER': return String(args[0] ?? '').toUpperCase();
    case 'LOWER': return String(args[0] ?? '').toLowerCase();
    case 'TRIM': return String(args[0] ?? '').trim();
    case 'LEN': return String(args[0] ?? '').length;
    case 'AND': return args.every(a => toNum(a) !== 0 && a !== null && a !== '') ? 1 : 0;
    case 'OR': return args.some(a => toNum(a) !== 0 && a !== null && a !== '') ? 1 : 0;
    case 'NOT': return (toNum(args[0]) !== 0 && args[0] !== null && args[0] !== '') ? 0 : 1;
    default: throw new FormulaError(`دالة غير مدعومة: ${name}`);
  }
}

function applyOp(op: string, a: Cell, b: Cell): Cell {
  const x = toNum(a);
  const y = toNum(b);
  switch (op) {
    case '+':
      if (Number.isNaN(x) || Number.isNaN(y)) return String(a ?? '') + String(b ?? '');
      return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? null : x / y;
    case '%': return y === 0 ? null : x % y;
    case '^': return Math.pow(x, y);
    case '=': case '==': return looseEq(a, b) ? 1 : 0;
    case '!=': case '<>': return looseEq(a, b) ? 0 : 1;
    case '<': return x < y ? 1 : 0;
    case '<=': return x <= y ? 1 : 0;
    case '>': return x > y ? 1 : 0;
    case '>=': return x >= y ? 1 : 0;
    case '&&': return (truthy(a) && truthy(b)) ? 1 : 0;
    case '||': return (truthy(a) || truthy(b)) ? 1 : 0;
    default: throw new FormulaError(`عامل غير مدعوم: ${op}`);
  }
}

function truthy(v: Cell): boolean {
  if (v === null || v === '') return false;
  const n = Number(v);
  if (Number.isFinite(n)) return n !== 0;
  return true;
}

function looseEq(a: Cell, b: Cell): boolean {
  const na = toNum(a);
  const nb = toNum(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return String(a ?? '') === String(b ?? '');
}

export interface CompiledFormula {
  rpn: RPNToken[];
  evaluate: (row: DataRow) => Cell;
}

/** Compile a formula once against a set of columns; reuse evaluate per row. */
export function compileFormula(formula: string, columns: string[]): CompiledFormula {
  if (!formula.trim()) throw new FormulaError('المعادلة فارغة');
  const tokens = tokenize(formula, columns);
  const rpn = toRPN(tokens, columns);

  const evaluate = (row: DataRow): Cell => {
    const stack: Cell[] = [];
    for (const t of rpn) {
      if (t.type === 'num') stack.push(Number(t.value));
      else if (t.type === 'str') stack.push(t.value);
      else if (t.type === 'col') stack.push(row[t.value] ?? null);
      else if (t.type === 'op') {
        const b = stack.pop() ?? null;
        const a = stack.pop() ?? null;
        stack.push(applyOp(t.value, a, b));
      } else if (t.type === 'func') {
        const argc = t.argc ?? 0;
        const args: Cell[] = [];
        for (let k = 0; k < argc; k++) args.unshift(stack.pop() ?? null);
        stack.push(applyFunc(t.value, args));
      }
    }
    if (stack.length !== 1) throw new FormulaError('معادلة غير صحيحة');
    const result = stack[0];
    if (typeof result === 'number' && !Number.isFinite(result)) return null;
    return result;
  };

  return { rpn, evaluate };
}

/** Apply a compiled formula to all rows, returning new rows with the new column. */
export function addCalculatedColumn(
  data: DataRow[],
  columnName: string,
  formula: string,
  existingColumns: string[],
): DataRow[] {
  const compiled = compileFormula(formula, existingColumns);
  return data.map(row => ({ ...row, [columnName]: compiled.evaluate(row) }));
}
