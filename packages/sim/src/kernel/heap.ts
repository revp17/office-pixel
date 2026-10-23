export interface Scheduled {
  t: number;
  seq: number;
  run: () => void;
}

/** Cola de prioridad mínima por (tiempo, orden de inserción) → orden estable y determinista. */
export class Heap {
  private a: Scheduled[] = [];
  get size() {
    return this.a.length;
  }
  private less(i: number, j: number) {
    const x = this.a[i];
    const y = this.a[j];
    return x.t < y.t || (x.t === y.t && x.seq < y.seq);
  }
  push(e: Scheduled) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Scheduled {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
