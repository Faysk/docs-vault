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


## Carregamento progressivo (issues #1, #2 e #3)

A interface carrega **somente os metadados** na entrada. O índice de conteúdo é carregado sob demanda quando a pesquisa tiver pelo menos 2 caracteres. O pacote de prévias também é carregado somente quando um documento precisar dele. Isso evita baixar e normalizar todo o texto na navegação inicial; não altera nenhum arquivo original.

Para **configurar uma instalação privada existente**, use seus próprios caminhos no HTML *local*, sem publicar os dados. Substitua o bloco antigo `<script src="assets/js/search-index.js"></script>` / `<script src="assets/js/previews.js"></script>` pelo script da aplicação com atributos:

```html
<script src="assets/js/data.js"></script>
<script src="assets/js/app.js"
        data-search-index="assets/js/search-index.js"
        data-previews="assets/js/previews.js"></script>
```

Esta edição pública usa exclusivamente `examples/data.example.js` e caminhos `examples/*.example.js`. Também aceita o contrato anterior com `window.VAULT_SEARCH_INDEX` e `window.VAULT_PREVIEWS` **já carregados** (sem normalização full-text no boot), para migração gradual. Para abrir via `file://`, mantenha os scripts e os caminhos relativos acessíveis; o navegador pode impedir `fetch()` de arquivos locais, por isso as prévias JavaScript continuam sendo importantes.

### Prévias fragmentadas opcionais

Para evitar carregar um grande `previews.js`, é possível declarar um mapa de scripts por caminho em `VAULT_DATA.previewChunks`, por exemplo:

```js
window.VAULT_DATA.previewChunks = {
  'examples/demoa.md': 'examples/previews/demoa.preview.js'
};
```

Cada chunk escreve somente a entrada necessária em `window.VAULT_PREVIEWS.text[path]` ou `.docx[path]`; veja os três exemplos públicos. Os chunks são carregados sob demanda; as prévias textuais fragmentadas mantêm **até seis entradas** no cache em memória. A opção com bundle único anterior continua disponível como fallback, mas não tem limite por arquivo e não deve ser usada para pacotes privados enormes sem medição.

### Interface e falhas

A biblioteca e a pesquisa renderizam **até 40 cards por grupo inicialmente**, com botão de carregar mais. A pesquisa em lotes de 60 documentos verifica se a consulta ainda é atual antes de atualizar o DOM. Estados preparando, pesquisando, vazio e erro são distintos; a contagem é anunciada em região acessível ao fim da pesquisa, não a cada tecla.

O leitor mantém indicação de ocupado enquanto uma imagem, iframe ou texto está sendo carregado; em HTTP(S), testa previamente a resposta para PDFs e HTML (HEAD; fallback GET parcial quando o servidor não admite HEAD). Os arquivos de texto respeitam `AbortController`. Após **18 segundos** de espera, há mensagem e opção de tentar novamente, mantendo os links de acesso ao original. Um evento `load` do iframe de PDF significa apenas que o recurso/container foi carregado: **não comprova que o plugin de PDF já desenhou a primeira página**. Em `file://`, não há verificação confiável de HTTP 404.

### Validação e limites

```sh
node tests/test_dates.cjs
node tests/test_progressive.cjs
node --check assets/js/app.js
node tests/browser_smoke.cjs  # requer Chromium/Chrome instalado
```

A normalização full-text também utiliza um cache LRU de até **256 entradas** em memória. Os testes usam somente texto e caminhos sintéticos (127/1.000/5.000 arquivos), verificando a limitação de cards, atualização mais recente, cancelamento, espera por `load`, erros de mídia, simulação de HTTP 404 e abort. Imprimem tempo JS e variação aproximada do heap **no Node**, não medições de browser/telefone. Para aprovar em produção ainda é necessário comparar o JS crítico e LCP/INP/long tasks no Chrome DevTools, conferir foco/scroll/leitor de tela e realizar testes reais no S7/Android 8 com rede lenta e erros simulados. Não alegar que as metas de INP ou redução percentual foram medidas sem trace.

As observações são sobre o checkout público sanitizado. O backend, gzip, cabeçalhos de cache e arquivos persistentes no microSD são responsabilidade da implantação local / `network-observatory`. Nunca exponha índices privados via cache público e nunca copie dados reais para fixtures deste repositório.

## Validação

```sh
node tests/test_dates.cjs
node --check assets/js/app.js
```

Workspace e acabamento compartilhado estão incluídos. Links para `/router/` e `/s7/` pressupõem os projetos irmãos na mesma origem. O app pode ser integrado em `/valt/` com o backend de https://github.com/Faysk/network-observatory .

A publicação pública não acrescenta uma licença de uso além das permissões aplicáveis ao código; nenhuma licença adicional foi escolhida para este aplicativo.
