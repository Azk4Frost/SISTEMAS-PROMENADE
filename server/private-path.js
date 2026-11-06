import { lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, basename, sep } from 'node:path';
const within=(root,target)=>{const value=relative(root,target);return value===''||(!isAbsolute(value)&&value!=='..'&&!value.startsWith('..'+sep));};

/** Impede banco, cópias e cadastros na pasta servida por HTTP, inclusive por symlinks. */
function entryExists(path) {
  try { lstatSync(path); return true; }
  catch(error) { if(error.code==='ENOENT') return false; throw error; }
}

export function assertPrivatePath(target, publicRoot) {
  const path=resolve(target),root=resolve(publicRoot);
  if(within(root,path)) throw Error('Arquivos de dados devem ficar fora da pasta pública.');
  let ancestor=path;const suffix=[];
  while(!entryExists(ancestor)) {
    suffix.unshift(basename(ancestor));const parent=dirname(ancestor);
    if(parent===ancestor) throw Error('Não foi possível localizar a pasta de destino.');
    ancestor=parent;
  }
  const actual=resolve(realpathSync(ancestor),...suffix);
  if(within(realpathSync(root),actual)) throw Error('Arquivos de dados devem ficar fora da pasta pública.');
}
