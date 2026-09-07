import { execFileSync } from 'node:child_process';

// Somente no runner, na branch pública autorizada. Não faz force-push nem toca código.
if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.GITHUB_REF !== 'refs/heads/main'
) {
  console.log('Persistência automática restrita ao GitHub Actions em main.');
  process.exit(0);
}
const git = (args) => execFileSync('git', args, { encoding: 'utf8' });
git(['add', '--', 'public/market-prices']);
const changed = git(['diff', '--cached', '--name-only'])
  .trim()
  .split('\n')
  .filter(Boolean);
if (!changed.length) process.exit(0);
if (
  changed.some(
    (path) =>
      !/^public\/market-prices\/(?:[A-Z]{2}|update-status|fundamentals)\.json$/.test(path),
  )
) {
  throw new Error(
    'Persistência abortada: há arquivo fora do conjunto de preços.',
  );
}
git([
  '-c',
  'user.name=github-actions[bot]',
  '-c',
  'user.email=41898282+github-actions[bot]@users.noreply.github.com',
  'commit',
  '-m',
  'data: atualizar série móvel CONAB e registro da coleta',
]);
try {
  git(['push', 'origin', 'HEAD:main']);
  console.log(
    'Histórico preservado em main; a publicação usa este mesmo conjunto testado.',
  );
} catch {
  // Nova mudança remota ou proteção da branch: nunca sobrescrever trabalho.
  console.warn(
    '::warning::Histórico não persistido no Git. Verifique permissões/conflito; a publicação conserva os dados testados desta execução.',
  );
}
