/**
 * PATCH — useAutoFetchIntimacoes.ts
 *
 * Encontre esta linha (perto do final do hook, após o toast.dismiss):
 *
 *   window.dispatchEvent(new CustomEvent("intimacoes-novas-count", {
 *     detail: { count: paraExibirNoToast.length },
 *   }));
 *
 * SUBSTITUA por:
 *
 *   window.dispatchEvent(new CustomEvent("intimacoes-novas-count", {
 *     detail: { count: paraExibirNoToast.length },
 *   }));
 *
 *   // Dispara o modal de novas intimações (só se houver novidades)
 *   if (paraExibirNoToast.length > 0) {
 *     window.dispatchEvent(new CustomEvent("intimacoes-novas-encontradas", {
 *       detail: {
 *         count: paraExibirNoToast.length,
 *         hoje: dias[0],
 *       },
 *     }));
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * São apenas 7 linhas novas logo após o evento já existente.
 * O resto do arquivo não muda.
 */
