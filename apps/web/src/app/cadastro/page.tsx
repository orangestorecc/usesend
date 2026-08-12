import { redirect } from "next/navigation";

/**
 * O site institucional aponta todos os "Criar sua conta" para /cadastro, mas a
 * página vive em /signup — todo call-to-action do site caía em 404.
 *
 * Redirect em vez de mover a página: o /signup já é referenciado pela tela de
 * login e por links antigos, e trocar o caminho no meio de um dia de incidente
 * é risco desnecessário. Se um dia quisermos o endereço em português como
 * canônico, invertemos os dois.
 */
export default function CadastroRedirect() {
  redirect("/signup");
}
