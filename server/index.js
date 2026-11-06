import { resolve } from 'node:path';
import { createApplication } from './application.js';

const port = Number(process.env.PORT ?? 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT deve ser um número inteiro entre 1 e 65535.');
  process.exitCode = 1;
} else {
  try {
    const { server } = createApplication(process.env.PROMENADE_DB_PATH?{databasePath:resolve(process.env.PROMENADE_DB_PATH)}:{});
    server.on('error', (error) => {
      console.error(error.code === 'EADDRINUSE' ? 'A porta já está em uso. Encerre o servidor anterior ou configure outra PORT.' : 'Não foi possível iniciar o servidor local.');
      server.close();
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`Servidor local iniciado na porta ${port}. Uniformes disponível no modo local, sem login. Abra http://127.0.0.1:${port}/sistemas/gestao_de_uniforme/`));
    const stop = () => { server.close(); server.closeIdleConnections(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    console.error('Não foi possível abrir o banco local e iniciar o servidor. Verifique a instalação e as permissões da pasta .data.');
    process.exitCode = 1;
  }
}
