/**
 * Evaluador de expresiones seguro (sin eval): `case.amount > 10000 && !case.vip`.
 * Soporta números, cadenas, true/false, rutas con puntos, ! && || == != < <= > >= y paréntesis.
 */
export type Scope = Record<string, unknown>;
export type CompiledExpr = (scope: Scope) => unknown;

interface Token {
  k: 'num' | 'str' | 'id' | 'op';
  v: string;
}

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|"([^"]*)"|'([^']*)'|([A-Za-z_][\w.]*)|(&&|\|\||==|!=|<=|>=|[<>!()]))/y;

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`token inesperado en "${src.slice(pos).trim()}"`);
    if (m[1] !== undefined) out.push({ k: 'num', v: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'str', v: m[2] });
    else if (m[3] !== undefined) out.push({ k: 'str', v: m[3] });
    else if (m[4] !== undefined) out.push({ k: 'id', v: m[4] });
    else out.push({ k: 'op', v: m[5] });
    pos = TOKEN.lastIndex;
  }
  return out;
}

function lookup(scope: Scope, path: string): unknown {
  let cur: unknown = scope;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function compileExpr(src: string): CompiledExpr {
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (...ops: string[]) => peek()?.k === 'op' && ops.includes(peek().v);

  function parseOr(): CompiledExpr {
    let left = parseAnd();
    while (isOp('||')) {
      p++;
      const a = left;
      const b = parseAnd();
      left = (s) => Boolean(a(s)) || Boolean(b(s));
    }
    return left;
  }
  function parseAnd(): CompiledExpr {
    let left = parseCmp();
    while (isOp('&&')) {
      p++;
      const a = left;
      const b = parseCmp();
      left = (s) => Boolean(a(s)) && Boolean(b(s));
    }
    return left;
  }
  function parseCmp(): CompiledExpr {
    const a = parseUnary();
    if (!isOp('==', '!=', '<', '<=', '>', '>=')) return a;
    const op = tokens[p++].v;
    const b = parseUnary();
    return (s) => {
      const x = a(s) as never;
      const y = b(s) as never;
      switch (op) {
        case '==': return x === y;
        case '!=': return x !== y;
        case '<': return x < y;
        case '<=': return x <= y;
        case '>': return x > y;
        default: return x >= y;
      }
    };
  }
  function parseUnary(): CompiledExpr {
    if (isOp('!')) {
      p++;
      const a = parseUnary();
      return (s) => !a(s);
    }
    return parsePrimary();
  }
  function parsePrimary(): CompiledExpr {
    const t = tokens[p++];
    if (!t) throw new Error('expresión incompleta');
    if (t.k === 'num') return () => Number(t.v);
    if (t.k === 'str') return () => t.v;
    if (t.k === 'id') {
      if (t.v === 'true') return () => true;
      if (t.v === 'false') return () => false;
      return (s) => lookup(s, t.v);
    }
    if (t.v === '(') {
      const e = parseOr();
      if (!isOp(')')) throw new Error('falta ")"');
      p++;
      return e;
    }
    throw new Error(`token inesperado "${t.v}"`);
  }

  const expr = parseOr();
  if (p < tokens.length) throw new Error(`token inesperado "${tokens[p].v}"`);
  return expr;
}
