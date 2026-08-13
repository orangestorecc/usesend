import { getRedis, redisKey } from "~/server/redis";

/**
 * INCR e EXPIRE numa chamada só. Feitos separados, um crash entre os dois
 * deixa a chave sem TTL — o contador nunca zera e o usuário fica travado
 * para sempre.
 */
const SCRIPT = `
local atual = redis.call('INCR', KEYS[1])
if atual == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return atual
`;

export type ResultadoRateLimit = {
  permitido: boolean;
  contagem: number;
  limite: number;
};

/**
 * @param chave identificador do balde (ex.: `mfa:login:42`)
 * @param limite tentativas permitidas na janela
 * @param janelaSegundos duração da janela
 */
export async function consumirCota(
  chave: string,
  limite: number,
  janelaSegundos: number,
): Promise<ResultadoRateLimit> {
  const redis = getRedis();
  const contagem = (await redis.eval(
    SCRIPT,
    1,
    redisKey(`ratelimit:${chave}`),
    String(janelaSegundos),
  )) as number;

  return { permitido: contagem <= limite, contagem, limite };
}

/** Lockout de códigos: 10 falhas por hora derrubam por 15 minutos. */
export const LOCKOUT_FALHAS = 10;
export const LOCKOUT_JANELA_SEGUNDOS = 60 * 60;
export const LOCKOUT_DURACAO_SEGUNDOS = 15 * 60;

export async function registrarFalhaDeCodigo(
  chave: string,
): Promise<{ travado: boolean }> {
  const { permitido } = await consumirCota(
    `falhas:${chave}`,
    LOCKOUT_FALHAS,
    LOCKOUT_JANELA_SEGUNDOS,
  );
  if (!permitido) {
    const redis = getRedis();
    await redis.set(
      redisKey(`lockout:${chave}`),
      "1",
      "EX",
      LOCKOUT_DURACAO_SEGUNDOS,
    );
  }
  return { travado: !permitido };
}

export async function estaTravado(chave: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.exists(redisKey(`lockout:${chave}`))) === 1;
}
