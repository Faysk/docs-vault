# Validação das issues #1–#3 — Docs Vault

Data: 2026-10-24. Escopo **somente checkout público sanitizado**, sem acesso ao Galaxy S7 privado.

## Resultado verificável por automação

| Critério | Método | Estado |
|---|---|---|
| Navegação não depende do full-text | Chromium, inspecionando requests antes de pesquisar | Automatizado |
| Busca sob demanda, última consulta prevalece | Chromium + Node VM, trocas de consulta | Automatizado |
| 127/1.000/5.000 documentos sintéticos | Node VM, tempo JS, delta de heap, número de cards | Automatizado |
| Renderização de biblioteca com 40 cards e carregar mais | Chromium com 125 documentos adicionais | Automatizado |
| Cache normalizado em memória | Node VM valida limite de 256 entradas | Automatizado |
| Prévias por documento, cache de até seis chunks | Fixture sintética, limite verificado no código | Parcial |
| Imagem inexistente + botão de retry | Chromium HTTP 404 | Automatizado |
| Markdown offline + Word/HTML sintético | Chromium com chunks sintéticos | Automatizado |
| PDF com URL local | Chromium verifica frame ou erro recuperável, nunca a primeira página | Parcial |
| Resposta HTTP 404 de preflight PDF | Teste isolado de checkEmbeddable | Automatizado |
| Abort antes do evento de mídia + resposta atrasada | Node VM + Chromium com HTML atrasado | Automatizado |
| Retorno de foco, leitor de tela, teclado em aparelho móvel | Exige sessão manual | Pendente |
| Metas reais INP ≤200 ms, LCP e long tasks | Exige Chrome Performance trace real | Pendente |
| Comparação ≥60% dos bytes críticos no S7 privado | Exige medir antes/depois com cache comparável | Pendente |

Os números de Node VM não são p95, não representam FPS, LCP, INP ou tempo total de rede. O smoke em Chromium também não substitui teste físico no Android 8.

## Checklist final no equipamento autorizado

- [ ] Manter **cópia/backup** da implantação e dados privados no microSD; não escrever índices privados no Git.
- [ ] Ajustar o HTML privado para configurar `data-search-index` e `data-previews` e testar navegação direta por `file://` e por HTTP LAN.
- [ ] Medir requests, bytes transferidos e tempo de bootstrap com cache frio e quente, pelo menos 5 repetições por cenário; comparar antes/depois e registrar versões.
- [ ] Coletar trace com LCP, INP, long tasks, memória e DOM para acervos sintéticos ou operações autorizadas; nenhum conteúdo privado em logs/exportações.
- [ ] Digitar, apagar, alternar rotas e abrir/fechar documentos repetidamente, com 3G lento e 404/500 simulados em ambiente de teste.
- [ ] Validar PDF (incluindo comportamento do plugin), DOCX, HTML, imagens, Markdown e texto; timeout não pode deixar spinner eterno.
- [ ] Verificar Tab/Shift-Tab, Esc, setas, foco devolvido ao card, zoom móvel e leitor de tela; reduzir movimento na configuração do sistema.
- [ ] Confirmar espaço interno livre ≥2 GiB no S7 e ausência de novos caches/documentos persistentes na memória interna.
- [ ] Revisar cache e compressão do backend em `network-observatory`, sem cache público para conteúdo privado.

## Limites

O repo público usa metadados e documentos sintéticos. A implantação LAN auditada pode ter módulos, índices, arquivos ou scripts que **não** constam do checkout público. Não executar deploy, coletar arquivos privados nem declarar metas de performance atingidas sem testes no ambiente real autorizados pelo responsável.
