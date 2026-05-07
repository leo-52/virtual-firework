// Décodeur protobuf wire-format **sans schéma**.
//
// Sans .proto descriptor, on ne peut pas connaître les noms ni les
// types exacts. On lit la structure brute (champs avec leur tag, leur
// wire type, leur valeur) et on tente d'interpréter récursivement les
// LEN-DELIM comme sous-messages quand c'est probable.
//
// Wire types :
//   0 = VARINT     (int32, int64, uint32, uint64, bool, enum)
//   1 = I64        (fixed64, sfixed64, double)
//   2 = LEN        (string, bytes, embedded message, packed repeated)
//   5 = I32        (fixed32, sfixed32, float)

export const WT = { VARINT: 0, I64: 1, LEN: 2, I32: 5 };

class Reader {
  constructor(buf, start = 0, end = -1) {
    this.buf = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    this.pos = start;
    this.end = end < 0 ? this.buf.length : end;
  }
  hasMore() { return this.pos < this.end; }
  byte() { return this.buf[this.pos++]; }
  varint() {
    let r = 0n; let shift = 0n;
    while (true) {
      const b = this.buf[this.pos++];
      r |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
      if (shift > 64n) throw new Error("varint > 64 bits");
    }
    // Retourne un Number si tient, sinon BigInt
    if (r <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(r);
    return r;
  }
  i32() {
    const dv = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4);
    this.pos += 4;
    return dv.getFloat32(0, true);
  }
  i64() {
    const dv = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
    this.pos += 8;
    return dv.getFloat64(0, true);
  }
  lenBytes() {
    const len = this.varint();
    const start = this.pos;
    this.pos += len;
    return this.buf.subarray(start, start + len);
  }
}

// Décode un message complet. Retourne un array de fields.
//
//   { tag: number, wire: WT, value: any, raw?: Uint8Array, asMessage?: array, asString?: string }
//
// Pour chaque LEN-DELIM, on essaie de redécoder comme sous-message.
// Si l'essai échoue (n'est pas un message valide), on garde le bytes.
export function decodeMessage(buf, start = 0, end = -1, depth = 0) {
  const r = new Reader(buf, start, end);
  const fields = [];
  while (r.hasMore()) {
    const head = r.varint();
    const tag = Number(head) >>> 3;
    const wire = Number(head) & 7;
    const f = { tag, wire };
    if (wire === WT.VARINT) f.value = r.varint();
    else if (wire === WT.I32) f.value = r.i32();
    else if (wire === WT.I64) f.value = r.i64();
    else if (wire === WT.LEN) {
      const sub = r.lenBytes();
      f.raw = sub;
      // Essais d'interprétation
      const asString = tryUtf8(sub);
      if (asString != null) f.asString = asString;
      if (depth < 8 && sub.length > 0) {
        try {
          const child = decodeMessage(sub, 0, -1, depth + 1);
          if (child && child.length > 0 && validate(child, sub.length)) {
            f.asMessage = child;
          }
        } catch { /* not a message */ }
      }
    } else {
      throw new Error(`Wire type ${wire} non supporté`);
    }
    fields.push(f);
  }
  return fields;
}

function validate(fields, totalBytes) {
  // Sanité : tags croissants ou raisonnables, pas de valeurs absurdes
  if (!fields.length) return false;
  for (const f of fields) {
    if (f.tag > 1 << 24 || f.tag < 1) return false;
  }
  return true;
}

function tryUtf8(bytes) {
  // Considère "utf-8" si tous les caractères sont imprimables ASCII ou
  // ressemblent à du texte UTF-8 propre.
  if (bytes.length < 1 || bytes.length > 4096) return null;
  let printable = 0, total = bytes.length;
  for (const b of bytes) {
    if (b === 0) return null;
    if ((b >= 0x20 && b < 0x7f) || b === 0x09 || b === 0x0a || b === 0x0d || b >= 0xc2) printable++;
  }
  if (printable / total < 0.9) return null;
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return s;
  } catch { return null; }
}

// Sérialise un arbre de fields en pseudo-JSON lisible, avec des
// indentations. Utile pour exploration.
export function pretty(fields, indent = 0) {
  const pad = "  ".repeat(indent);
  const lines = [];
  for (const f of fields) {
    let body;
    if (f.asMessage) {
      body = "{\n" + pretty(f.asMessage, indent + 1) + "\n" + pad + "}";
    } else if (f.asString != null) {
      body = JSON.stringify(f.asString);
    } else if (f.raw) {
      body = `<bytes ${f.raw.length}>`;
    } else {
      body = String(f.value);
    }
    lines.push(`${pad}#${f.tag} (${wireName(f.wire)}) = ${body}`);
  }
  return lines.join("\n");
}

function wireName(w) {
  return ({ 0: "varint", 1: "i64", 2: "len", 5: "i32" })[w] || `wt${w}`;
}

// Stats : nb de fields, nb de messages, profondeur max.
export function stats(fields, depth = 0) {
  let n = 0, msgs = 0, strings = 0, maxDepth = depth, totalBytes = 0;
  for (const f of fields) {
    n++;
    if (f.raw) totalBytes += f.raw.length;
    if (f.asMessage) {
      msgs++;
      const s = stats(f.asMessage, depth + 1);
      n += s.fields;
      msgs += s.messages;
      strings += s.strings;
      maxDepth = Math.max(maxDepth, s.maxDepth);
    } else if (f.asString != null) {
      strings++;
    }
  }
  return { fields: n, messages: msgs, strings, maxDepth, bytes: totalBytes };
}
