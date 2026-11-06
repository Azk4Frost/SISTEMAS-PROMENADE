import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { backup } from 'node:sqlite';
import { openDatabase } from './database.js';
import { createUniformesStore } from './uniformes.js';
import { assertPrivatePath } from './private-path.js';

const [command,file]=process.argv.slice(2);
const outsidePublic=(destination)=>assertPrivatePath(destination,fileURLToPath(new URL('../PROMENADEHUB',import.meta.url)));
if(!['template','import','stock-add','backup'].includes(command)||!file) {
  console.error('Uso: npm run manage -- template ARQUIVO.json | import ARQUIVO.json | stock-add ARQUIVO.json | backup DESTINO.sqlite');
  process.exitCode=1;
} else {
  let db;
  try {
    const destination=resolve(file);outsidePublic(destination);
    if(command==='template') {
      mkdirSync(dirname(destination),{recursive:true,mode:0o700});
      writeFileSync(destination,JSON.stringify({operationId:randomUUID(),sectors:[],employees:[],responsibles:[],uniforms:[]},null,2)+'\n',{flag:'wx',mode:0o600});
      console.log('Modelo vazio criado. Preencha somente com cadastros e quantidades reais.');
    } else {
      const databasePath=resolve(process.env.PROMENADE_DB_PATH??fileURLToPath(new URL('../.data/promenade.sqlite',import.meta.url)));
      outsidePublic(databasePath);db=openDatabase(databasePath);
      if(command==='backup') {
        if(destination===databasePath||existsSync(destination)) throw Error('O destino já existe ou é o banco original. Escolha um novo nome.');
        mkdirSync(dirname(destination),{recursive:true});
        await backup(db,destination);
        console.log('Backup SQLite concluído.');
      } else {
        const payload=JSON.parse(readFileSync(destination,'utf8'));
        const store=createUniformesStore(db);
        console.log(JSON.stringify(command==='import'?store.importCatalog(payload,payload.operationId):store.addStock(payload,payload.operationId)));
      }
    }
  } catch(error) { console.error(`Não foi possível concluir: ${error.message}`);process.exitCode=1; }
  finally { db?.close(); }
}
