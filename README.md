# Docs Vault

Aplicativo documental estático com busca offline, favoritos, recentes, notas locais e leitores de Markdown, PDF, imagens e prévias textuais de Word.

**Esta edição pública contém somente exemplos fictícios. Nenhum documento pessoal ou índice extraído de documentos reais foi incluído.**

## Executar

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abra http://127.0.0.1:8080 . Não requer Node, CDN ou API para uso; Node é necessário apenas nos testes. O HTML carrega explicitamente `examples/*.example.js` e documentos fictícios em `examples/`.

## Seu acervo privado

Faça a configuração exclusivamente na sua instalação local. Os caminhos `vault/`, `media/`, `dossiers/`, `previews/`, `meta/`, `Arquivo_Mestre*/` e os módulos privados `assets/js/data.js`, `assets/js/search-index.js`, `assets/js/previews.js` estão ignorados pelo Git. Dados extraídos, títulos, nomes de arquivos, índices full-text, documentos e capturas também são informações privadas; não basta remover os PDFs.

Os exemplos mostram a estrutura dos módulos `VAULT_DATA`, `VAULT_SEARCH_INDEX` e `VAULT_PREVIEWS`. Para um acervo privado, ajuste os scripts no HTML localmente sem alterar os exemplos públicos. Antes de qualquer push, revise `git diff --cached` e execute uma varredura de segredos.

Notas e preferências ficam no localStorage de cada navegador. O modo privacidade desfoca a interface; ele não é autenticação nem criptografia. Restrinja o acesso ao servidor que hospedar dados privados. Nunca coloque credenciais em JavaScript ou GitHub Secrets para depois embuti-las no bundle.

## Validação

```sh
node tests/test_dates.cjs
node --check assets/js/app.js
```

Workspace e acabamento compartilhado estão incluídos. Links para `/router/` e `/s7/` pressupõem os projetos irmãos na mesma origem. O app pode ser integrado em `/valt/` com o backend de https://github.com/Faysk/network-observatory .

A publicação pública não acrescenta uma licença de uso além das permissões aplicáveis ao código; nenhuma licença adicional foi escolhida para este aplicativo.
