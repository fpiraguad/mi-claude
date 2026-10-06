// «De quién me hablan»: convierte lo que dice la persona (un nombre, un teléfono o un jid)
// en el chat exacto. Lógica pura, sin base ni red, para poderla probar.

export const sinTildes = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// ¿Todas las palabras buscadas aparecen en el nombre o el jid del chat?
export function coincide(q, chat) {
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  const heno = sinTildes(`${chat.nombre ?? ''} ${chat.jid ?? ''}`);
  return palabras.every((p) => heno.includes(p));
}

// Un teléfono escrito como lo escribe la gente: «+57 300 123 4567», «(300) 123-4567», «0034 612…».
export function pareceNumero(ref) {
  return /^[\d\s+().\-]+$/.test(ref) && ref.replace(/\D/g, '').length >= 7;
}

// El indicativo de país sale de la configuración (WSP_INDICATIVO) o, si no hay, del número
// propio: si mi número tiene 12 dígitos y el local 10, los 2 de adelante son el indicativo.
export function indicativoInferido(numeroPropio, local) {
  const propio = String(numeroPropio ?? '').replace(/\D/g, '');
  if (!propio || !local || propio.length <= local.length) return null;
  const cc = propio.slice(0, propio.length - local.length);
  return cc.length >= 1 && cc.length <= 3 ? cc : null;
}

export const MENSAJE_SIN_INDICATIVO =
  'Escribe el número con el indicativo del país (por ejemplo +57 300 123 4567), ' +
  'o guarda el indicativo de tu país con: wsp configurar indicativo 57';

// Devuelve los dígitos internacionales del número, o { error }.
export function normalizarNumero(ref, { indicativo, numeroPropio } = {}) {
  const limpio = String(ref).trim();
  let digitos = limpio.replace(/\D/g, '');
  if (limpio.startsWith('+')) return { numero: digitos };
  if (digitos.startsWith('00')) return { numero: digitos.slice(2) };
  // Un 0 adelante es el prefijo nacional (Reino Unido, Argentina, España fija…): se quita.
  const conPrefijoNacional = digitos.startsWith('0');
  if (conPrefijoNacional) digitos = digitos.replace(/^0+/, '');
  else if (digitos.length >= 11) return { numero: digitos };
  const cc = String(indicativo ?? '').replace(/\D/g, '') || indicativoInferido(numeroPropio, digitos);
  if (!cc) return { error: MENSAJE_SIN_INDICATIVO };
  return { numero: cc + digitos };
}

// Clasifica la referencia: jid directo, número de teléfono o nombre a buscar.
export function interpretarReferencia(ref, opciones = {}) {
  const texto = String(ref ?? '').trim();
  if (!texto) return { error: 'Falta decir de qué chat.' };
  if (texto.includes('@')) return { jid: texto };
  if (pareceNumero(texto)) {
    const n = normalizarNumero(texto, opciones);
    if (n.error) return { error: n.error };
    return { jid: `${n.numero}@s.whatsapp.net`, porNumero: true };
  }
  return { nombre: texto };
}

// Entre los chats candidatos (ya filtrados por `coincide`), elige uno o pide aclarar.
export function elegirChat(ref, candidatos) {
  if (!candidatos.length) return { error: `No encontré ningún chat que se llame «${ref}».` };
  const exactos = candidatos.filter((c) => sinTildes(c.nombre) === sinTildes(ref));
  if (exactos.length === 1) return { jid: exactos[0].jid, nombre: exactos[0].nombre };
  if (candidatos.length === 1) return { jid: candidatos[0].jid, nombre: candidatos[0].nombre };
  return { ambiguo: candidatos.map((c) => ({ jid: c.jid, nombre: c.nombre, grupo: !!c.es_grupo })) };
}
