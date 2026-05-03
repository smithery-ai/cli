# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).


## [1.0.0](https://github.com/smithery-ai/cli/compare/v1.0.1...v1.0.0) (2026-05-03)


### ⚠ BREAKING CHANGES

* rename npm package to smithery (1.0.0) ([#749](https://github.com/smithery-ai/cli/issues/749))
* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623))
* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613))

### Features

* add --config-schema flag for external URL publish (SMI-1246) ([#538](https://github.com/smithery-ai/cli/issues/538)) ([68fcf07](https://github.com/smithery-ai/cli/commit/68fcf07d26f72b3e20530fac716a59edcf5c351c))
* add --headers option to connect add/set commands ([#581](https://github.com/smithery-ai/cli/issues/581)) ([da2856d](https://github.com/smithery-ai/cli/commit/da2856d77f766d72655e668d3063381d30c793e2))
* add api key prompt for remote server installation ([#172](https://github.com/smithery-ai/cli/issues/172)) ([6b1cdad](https://github.com/smithery-ai/cli/commit/6b1cdadb3a48e893dd8b3eeb69e0cf3dde68a2e0))
* add comprehensive Smithery CLI skill [SMI-1367] ([#562](https://github.com/smithery-ai/cli/issues/562)) ([04ace79](https://github.com/smithery-ai/cli/commit/04ace79f9ceba978015e1882c302055028f90493))
* add custom ID and metadata support to connect command ([#558](https://github.com/smithery-ai/cli/issues/558)) ([11c1484](https://github.com/smithery-ai/cli/commit/11c1484a6dcec5bc5ae3dbb2d07ade5ac8df748f))
* add dev query param to playground link ([#364](https://github.com/smithery-ai/cli/issues/364)) ([be4180c](https://github.com/smithery-ai/cli/commit/be4180c9737275c9c7ad4add6da941f46193136f))
* add heartbeat to WS connection ([#103](https://github.com/smithery-ai/cli/issues/103)) ([9ceaac8](https://github.com/smithery-ai/cli/commit/9ceaac868e8d5e5406882971263d93fa0a4484be))
* add homepage command to manage local dashboard daemon ([6aebb7a](https://github.com/smithery-ai/cli/commit/6aebb7a2d667c5f45e62068539faeb6ca0143933))
* add jitter to WebSocket reconnection logic and refactor WS runner ([#86](https://github.com/smithery-ai/cli/issues/86)) ([0a67eb6](https://github.com/smithery-ai/cli/commit/0a67eb64b89bfce7020b3fffc1a18394a0919aeb))
* add logout command to remove all local credentials ([#574](https://github.com/smithery-ai/cli/issues/574)) ([1d6db88](https://github.com/smithery-ai/cli/commit/1d6db88c2e315a04db44001b97b165f65aaf64ee))
* add OpenCode client (stdio only) ([#484](https://github.com/smithery-ai/cli/issues/484)) ([83e84bd](https://github.com/smithery-ai/cli/commit/83e84bd00c687b883385feb6674e568712c6e3eb))
* add post-install message and servers search command ([#598](https://github.com/smithery-ai/cli/issues/598)) ([874d8c2](https://github.com/smithery-ai/cli/commit/874d8c2534eb6412e57eb9fee379b4c7cb18e153))
* add retry and timeout options to sdk and api calls ([#401](https://github.com/smithery-ai/cli/issues/401)) ([990d829](https://github.com/smithery-ai/cli/commit/990d8298c573e7287ebbc3040921c23b27519901))
* add roo code installation ([#144](https://github.com/smithery-ai/cli/issues/144)) ([3015dff](https://github.com/smithery-ai/cli/commit/3015dff712607594207934bb507113a4f38e29a9))
* add search param and register mcp logs command ([#663](https://github.com/smithery-ai/cli/issues/663)) ([a5406fa](https://github.com/smithery-ai/cli/commit/a5406faa5eb9f165e25ca9dac1955d1346adbdca))
* add session analytics ([#180](https://github.com/smithery-ai/cli/issues/180)) ([eea2b1c](https://github.com/smithery-ai/cli/commit/eea2b1c6c211c322f364afcfe997736f4222f578))
* add skills review and vote commands ([#568](https://github.com/smithery-ai/cli/issues/568)) ([9251cfd](https://github.com/smithery-ai/cli/commit/9251cfdd4b400667e6193d0ba2b23f12c318ee94))
* add skills search and install commands ([#550](https://github.com/smithery-ai/cli/issues/550)) ([2b1c2db](https://github.com/smithery-ai/cli/commit/2b1c2db55a8e88c0e4720090ba6d3852c89fdea0))
* add skills view command ([#609](https://github.com/smithery-ai/cli/issues/609)) ([e0d3e65](https://github.com/smithery-ai/cli/commit/e0d3e65e65f44cec5dddb307e398f2c2a81d409c))
* add smithery setup command ([#616](https://github.com/smithery-ai/cli/issues/616)) ([d78e8d0](https://github.com/smithery-ai/cli/commit/d78e8d03a45f8b9254a52129eeb781f23a33a18f))
* add support for smithery profiles ([#170](https://github.com/smithery-ai/cli/issues/170)) ([5e3770e](https://github.com/smithery-ai/cli/commit/5e3770e4210133442b3028b46844e46e5dc25f39))
* add tests for public API patterns ([#566](https://github.com/smithery-ai/cli/issues/566)) ([e394217](https://github.com/smithery-ai/cli/commit/e394217c1980b59804991f846b1eb33df67b3bf3))
* **automation:** add zod schema validation and improve DX ([#692](https://github.com/smithery-ai/cli/issues/692)) ([4840995](https://github.com/smithery-ai/cli/commit/484099570bc60d6ea5162cd995a501a8e3a6782c))
* **beta:** support openai apps ([#425](https://github.com/smithery-ai/cli/issues/425)) ([5965ff6](https://github.com/smithery-ai/cli/commit/5965ff6db932fda3e017d7746b31d0e5a48dade2))
* build stateless server ([#362](https://github.com/smithery-ai/cli/issues/362)) ([8792645](https://github.com/smithery-ai/cli/commit/8792645d765b81a2822aee35fed7780b53f6ffb2))
* bundler options, update output format to ESM, remove npm cache from actions workflow ([#388](https://github.com/smithery-ai/cli/issues/388)) ([ccd466a](https://github.com/smithery-ai/cli/commit/ccd466ae3e88479e2d8e68c18128b3f4cd06f5c7))
* cache tool input/output schemas as Zod types after mcp call ([b9098e5](https://github.com/smithery-ai/cli/commit/b9098e5fa44f2336b9c58d04b28a40bc634507d9))
* check for latest server when using bundles ([#407](https://github.com/smithery-ai/cli/issues/407)) ([8a9a35f](https://github.com/smithery-ai/cli/commit/8a9a35f3eae446df0a43cdb066549043a9716f8b))
* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613)) ([56e0e7b](https://github.com/smithery-ai/cli/commit/56e0e7bf52cc0ffd2e01eb7e80c9a1ccf5432187))
* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623)) ([36a6944](https://github.com/smithery-ai/cli/commit/36a694416c3b85cf263d09e49de0f9cebdd7997e))
* detect createAuthAdapter export and write to manifest [SMI-1160] ([#604](https://github.com/smithery-ai/cli/issues/604)) ([f5f6b74](https://github.com/smithery-ai/cli/commit/f5f6b742a2885178b229a11df74ea3b17a292c16))
* enhance connect commands with get, pagination, error handling, and shorthand URLs ([#589](https://github.com/smithery-ai/cli/issues/589)) ([04293a7](https://github.com/smithery-ai/cli/commit/04293a719f663f8f81c47c131c63121b4d0659ea))
* improve auth token --policy UX with JSON schema and repeatable constraints ([#675](https://github.com/smithery-ai/cli/issues/675)) ([b95bd6f](https://github.com/smithery-ai/cli/commit/b95bd6f8c32780c6a13b8cbddc4eacb932243482))
* improve postinstall message for agents ([#601](https://github.com/smithery-ai/cli/issues/601)) ([92726b5](https://github.com/smithery-ai/cli/commit/92726b5231062136e650f271b15709d74273c310))
* improve review add UX with GitHub-style syntax ([#580](https://github.com/smithery-ai/cli/issues/580)) ([52aeb1d](https://github.com/smithery-ai/cli/commit/52aeb1df451167854ae2c0a346b37d9b1dec656f))
* improve run for bundled servers ([#423](https://github.com/smithery-ai/cli/issues/423)) ([9cebf18](https://github.com/smithery-ai/cli/commit/9cebf188a4fcf8223d0f0e77aaea39b794a8c894))
* improve search and connect UX for agents ([#605](https://github.com/smithery-ai/cli/issues/605)) ([11c8ef7](https://github.com/smithery-ai/cli/commit/11c8ef7d25c148d2e845ded0e7a6878a64290785))
* improved connections and idle timeout management ([#270](https://github.com/smithery-ai/cli/issues/270)) [SMI-451] ([fe779c3](https://github.com/smithery-ai/cli/commit/fe779c366159173ebc411b870219a0575ff86ec6))
* migrate to ESM from commonJS ([#385](https://github.com/smithery-ai/cli/issues/385)) ([ce606bd](https://github.com/smithery-ai/cli/commit/ce606bdd90639a95878783f4671ef8f6dd272de8))
* migrate to Release Please for automated releases ([#549](https://github.com/smithery-ai/cli/issues/549)) ([be724ae](https://github.com/smithery-ai/cli/commit/be724aededefc85d1e82fe486861aed9fbaffaac))
* minify by default in dev, allow configuration ([#428](https://github.com/smithery-ai/cli/issues/428)) ([610b9fe](https://github.com/smithery-ai/cli/commit/610b9fe6ce70db31e86bb5dd667b5600691e2b70))
* optimize skill trigger description [SMI-1493] ([#636](https://github.com/smithery-ai/cli/issues/636)) ([3e55dde](https://github.com/smithery-ai/cli/commit/3e55ddea506bf6bb2453598461862f2bc97f0f12))
* pass config to bundle stdio process as args & fix: cleanup process on exit signal ([#402](https://github.com/smithery-ai/cli/issues/402)) ([f80e031](https://github.com/smithery-ai/cli/commit/f80e031bb1ae7d9bbab48477358bfc1834d81203))
* Poll mcp add auth setup flow ([#743](https://github.com/smithery-ai/cli/issues/743)) ([0af019d](https://github.com/smithery-ai/cli/commit/0af019db41573b8a6871097b7b67057850fdd448))
* pr and issue template ([#312](https://github.com/smithery-ai/cli/issues/312)) ([af60cc9](https://github.com/smithery-ai/cli/commit/af60cc9278ca08679cadbeb923b39043e9d73aa9))
* pretty console logs ([#389](https://github.com/smithery-ai/cli/issues/389)) ([58adc6e](https://github.com/smithery-ai/cli/commit/58adc6ece90aba2242c73d41379881a7ec5055a1))
* prompt config for local servers in playground command ([#508](https://github.com/smithery-ai/cli/issues/508)) ([4e20fe0](https://github.com/smithery-ai/cli/commit/4e20fe0a0f3a08cc1c08feeb6d963403bddeb068))
* prompt for api key when key invalid ([#510](https://github.com/smithery-ai/cli/issues/510)) ([d6087ff](https://github.com/smithery-ai/cli/commit/d6087ffb5febb07e5986b68bd116eb904691159e))
* redesign skills review and vote CLI with gh-style commands ([#572](https://github.com/smithery-ai/cli/issues/572)) ([6463e37](https://github.com/smithery-ai/cli/commit/6463e37383b8b8d86d8ee286ca819f1b3b135e8d))
* remove api key requirement for local servers ([#167](https://github.com/smithery-ai/cli/issues/167)) ([7171ae9](https://github.com/smithery-ai/cli/commit/7171ae98cf6233013236abb9f5dcf5dfd876b96c))
* remove mcp dev command ([#727](https://github.com/smithery-ai/cli/issues/727)) ([980f994](https://github.com/smithery-ai/cli/commit/980f9943c512a88f64a3bf04fba0ef5de4f3515e))
* **run:** allow empty strings for required config fields during runtime ([#110](https://github.com/smithery-ai/cli/issues/110)) ([c514b10](https://github.com/smithery-ai/cli/commit/c514b106918c6d61d9918cf367ca9aca013ee992))
* session termination ([#165](https://github.com/smithery-ai/cli/issues/165)) ([3a46f31](https://github.com/smithery-ai/cli/commit/3a46f31447eb8581f32d798bac670153612f5508))
* show welcome message when CLI runs without arguments ([e2a7cc6](https://github.com/smithery-ai/cli/commit/e2a7cc6b7f7d1a2d0fd4c5b000b48eaaf5f5ae63))
* **skill:** add publish command ([#696](https://github.com/smithery-ai/cli/issues/696)) ([2b8c592](https://github.com/smithery-ai/cli/commit/2b8c59251515ae8b98f98eb2668e4d2fdcf719c6))
* **SMI-1512:** Add --unstableWebhookUrl option to smithery mcp add ([#634](https://github.com/smithery-ai/cli/issues/634)) ([944034e](https://github.com/smithery-ai/cli/commit/944034eb7656aae872efd53b6dbb4636eca3c2d6))
* **SMI-1564:** tree-based tool browsing with required connection arg ([#684](https://github.com/smithery-ai/cli/issues/684)) ([7562772](https://github.com/smithery-ai/cli/commit/756277255397b60667257b7d67ad745d8dbfdd52))
* **SMI-1823:** add trigger CLI commands ([#736](https://github.com/smithery-ai/cli/issues/736)) ([1368e3f](https://github.com/smithery-ai/cli/commit/1368e3fa48661ee470ec83e16761eec3638408ae))
* **SMI-1839:** download and run MCPB bundles via uplink on mcp add ([#741](https://github.com/smithery-ai/cli/issues/741)) ([6d70db3](https://github.com/smithery-ai/cli/commit/6d70db39ad20363fe81677d6f822b2b8379acca0))
* support for streamable HTTP transport ([#161](https://github.com/smithery-ai/cli/issues/161)) ([4394a11](https://github.com/smithery-ai/cli/commit/4394a1174a3701dcde1b0a3d60f64128ca1788a1))
* support input_required MCP connection flows ([#716](https://github.com/smithery-ai/cli/issues/716)) ([506bc3c](https://github.com/smithery-ai/cli/commit/506bc3c7819f4484bc2a87cdfad0dc46ed2dc2f4))
* support installing servers to vscode ([#96](https://github.com/smithery-ai/cli/issues/96)) ([89cd1f2](https://github.com/smithery-ai/cli/commit/89cd1f2a084d7a2d46d8d0dbb7b23c4cea1b271e))
* support uplink in mcp add ([#729](https://github.com/smithery-ai/cli/issues/729)) ([e9eab21](https://github.com/smithery-ai/cli/commit/e9eab21858f965d6dfd4b4f1fe557587d42d513c))
* surface tool annotations in tool list output ([#679](https://github.com/smithery-ai/cli/issues/679)) ([b949eb2](https://github.com/smithery-ai/cli/commit/b949eb2c46935b0ecc5c24586c9629ab2636da4e))
* unify error handling across ws and stdio connections ([#131](https://github.com/smithery-ai/cli/issues/131)) ([1e00778](https://github.com/smithery-ai/cli/commit/1e007786bf0ff102a0de246fdde093a28e4c4106))
* Update LibreChat Configuration Handling ([#331](https://github.com/smithery-ai/cli/issues/331)) ([7021a25](https://github.com/smithery-ai/cli/commit/7021a2573071cf64508cc1004e43846acb1924fe))
* use namespace import to prevent build fail ([#514](https://github.com/smithery-ai/cli/issues/514)) ([2059166](https://github.com/smithery-ai/cli/commit/20591668da210e32a911369189abd106adf7acf8))
* use smithery/sdk to access registry endpoints ([#213](https://github.com/smithery-ai/cli/issues/213)) ([489368b](https://github.com/smithery-ai/cli/commit/489368baff3924e1f31bd444990323b275d15ff8))


### Bug Fixes

* **/build.mjs:** fixes build failure on windows ([#375](https://github.com/smithery-ai/cli/issues/375)) ([ae5208a](https://github.com/smithery-ai/cli/commit/ae5208afd2e744e3d08c475b33cd559e9b7216ed))
* add CTA for permission denied errors ([#632](https://github.com/smithery-ai/cli/issues/632)) ([e18c52d](https://github.com/smithery-ai/cli/commit/e18c52d9606f9499ef457636add6f024ed80afe8))
* add explicit permissions for publish workflow OIDC ([a0962ec](https://github.com/smithery-ai/cli/commit/a0962ec5ab017d7017a6da17894ae017480eaa63))
* add id-token permission for npm publish OIDC ([#593](https://github.com/smithery-ai/cli/issues/593)) ([3f61a2d](https://github.com/smithery-ai/cli/commit/3f61a2d2281e5b40654363639a6098842b7dbb0b))
* add registry-url to setup-node for npm OIDC auth ([7855d98](https://github.com/smithery-ai/cli/commit/7855d9894279aef79caade19c2743c50a4cd6747))
* add workflow_dispatch to allow manual publish trigger ([bcc31c1](https://github.com/smithery-ai/cli/commit/bcc31c1d163535566ccbd285d6c44cfd73156d48))
* agent-friendly auth login for non-TTY environments (SMI-1627) ([#701](https://github.com/smithery-ai/cli/issues/701)) ([280917c](https://github.com/smithery-ai/cli/commit/280917c5bea8759ac0d8930654ddc584a5b296f0))
* agent-friendly publish, install, and search commands (SMI-1549, [#680](https://github.com/smithery-ai/cli/issues/680)) ([#704](https://github.com/smithery-ai/cli/issues/704)) ([4872b6c](https://github.com/smithery-ai/cli/commit/4872b6c51661076d0c31402d48d46297aa125876))
* allow '@' in server id during interactive install ([#498](https://github.com/smithery-ai/cli/issues/498)) ([9d97d29](https://github.com/smithery-ai/cli/commit/9d97d29293b129eb36e0c6f543870f21ba1cfb48))
* allow SDK client to work without API key ([#556](https://github.com/smithery-ai/cli/issues/556)) ([d883dbe](https://github.com/smithery-ai/cli/commit/d883dbe7a6f8b6b9326ea7e6d2d55eeb989388ea))
* analytics for stdio runner ([#509](https://github.com/smithery-ai/cli/issues/509)) ([1c0de04](https://github.com/smithery-ai/cli/commit/1c0de0421d673724c1c18657014b0c1461989e45))
* bypass ESM resolution cache in lazy import retry ([#655](https://github.com/smithery-ai/cli/issues/655)) ([27e3ac4](https://github.com/smithery-ai/cli/commit/27e3ac4759572b69eeff49950bac600d97451c17))
* collect configs when smithery api key is prompted ([#173](https://github.com/smithery-ai/cli/issues/173)) ([de6d248](https://github.com/smithery-ai/cli/commit/de6d248a498cb263f8789245d1846ea178aa1bb1))
* config schema and add tests ([#391](https://github.com/smithery-ai/cli/issues/391)) ([58835d2](https://github.com/smithery-ai/cli/commit/58835d2bc78c4d5eaee8eefb259beaac58699925))
* config validation and improve installation flow ([#422](https://github.com/smithery-ai/cli/issues/422)) ([e6cf76c](https://github.com/smithery-ai/cli/commit/e6cf76cdafda1a169602f8c6d9ec3003e3adddd4))
* connections for stdio servers ([#174](https://github.com/smithery-ai/cli/issues/174)) ([f6f76f3](https://github.com/smithery-ai/cli/commit/f6f76f35defd64eec542e5107d9c93acf2d2713b))
* **deps:** rm vulnerable dependencies ([8b49791](https://github.com/smithery-ai/cli/commit/8b497910baa8799b302ea75fcfaba0ef53b655bd))
* detect direct execution through symlinked bin ([#732](https://github.com/smithery-ai/cli/issues/732)) ([2cacbdf](https://github.com/smithery-ai/cli/commit/2cacbdfeb2ebaedf5cfa7ad2a38761cb835d880e))
* disable minification for shttp bundles to improve debuggability ([#685](https://github.com/smithery-ai/cli/issues/685)) ([64de162](https://github.com/smithery-ai/cli/commit/64de162f99549dc7c9087e41621f2bd31fbb42e2))
* don't pass mock values for optional fields ([#517](https://github.com/smithery-ai/cli/issues/517)) ([c11041a](https://github.com/smithery-ai/cli/commit/c11041afab21d1c9418c806c98b2ac16a18672f6))
* don't prompt to install keytar on logout (SMI-1615) ([#699](https://github.com/smithery-ai/cli/issues/699)) ([918ac0c](https://github.com/smithery-ai/cli/commit/918ac0ca6067f48276bf45a8c25f2566e673ea32))
* dynamic module imports when running miniflare ([#515](https://github.com/smithery-ai/cli/issues/515)) ([5d3cc2f](https://github.com/smithery-ai/cli/commit/5d3cc2f5e30f893437c131026e3b2135518c49fd))
* handle deletions for YAML configs using --uninstall ([#371](https://github.com/smithery-ai/cli/issues/371)) ([f22752e](https://github.com/smithery-ai/cli/commit/f22752edbc4743c078c2108c30baf9d8da18695c))
* handle no saved config ([0684f2c](https://github.com/smithery-ai/cli/commit/0684f2c36212b84c0d6269291ff9b89415e8ac3c))
* improve stdio error handling ([#135](https://github.com/smithery-ai/cli/issues/135)) ([64d23ef](https://github.com/smithery-ai/cli/commit/64d23ef822001a6837ad5bf13e80050069c0bf3b))
* Improve stdio-runner cleanup process ([#83](https://github.com/smithery-ai/cli/issues/83)) ([346870b](https://github.com/smithery-ai/cli/commit/346870b6c2554b3e364444010cce17ab47c3d50d))
* Improve ws-runner cleanup process ([#85](https://github.com/smithery-ai/cli/issues/85)) ([2a29ef0](https://github.com/smithery-ai/cli/commit/2a29ef0ece842d84e5a774e54090afc99d372fb5))
* Incorrect JSON escaping in run command example ([#185](https://github.com/smithery-ai/cli/issues/185)) ([904d473](https://github.com/smithery-ai/cli/commit/904d4730a03470507e4a3b4e78f35eaf36e39a39))
* initialize local HTTP MCP session before forwarding uplink frames ([#734](https://github.com/smithery-ai/cli/issues/734)) ([819a49e](https://github.com/smithery-ai/cli/commit/819a49ea2b6c5f01efdaf3e768483cc197f86ac8))
* inline npm publish into release-please workflow ([#599](https://github.com/smithery-ai/cli/issues/599)) ([d4c64ef](https://github.com/smithery-ai/cli/commit/d4c64ef25a1ca57d14c9ca718c471e2fe5f81761))
* keep skill required, only make agent optional ([#611](https://github.com/smithery-ai/cli/issues/611)) ([714b7f8](https://github.com/smithery-ai/cli/commit/714b7f896cfe5f96592f414a02b99645f83400a1))
* lint during build workflow ([04485c5](https://github.com/smithery-ai/cli/commit/04485c50cc5375c28d5a161ce4b5f67413aed4a1))
* list event topics without requiring MCP handshake ([#671](https://github.com/smithery-ai/cli/issues/671)) ([760bd8a](https://github.com/smithery-ai/cli/commit/760bd8adc3e1971864e062fd66977951d18732ca))
* make CLI auth organization aware ([#725](https://github.com/smithery-ai/cli/issues/725)) ([88f706b](https://github.com/smithery-ai/cli/commit/88f706b26687370df405224dd3baceca695968a9))
* make setup command non-interactive by default ([#640](https://github.com/smithery-ai/cli/issues/640)) ([7a92c51](https://github.com/smithery-ai/cli/commit/7a92c519c0b78554211788cef53e75edb8fc96ed))
* **mcp add:** resume setup when re-adding incomplete connection ([#756](https://github.com/smithery-ai/cli/issues/756)) ([ddaa2c0](https://github.com/smithery-ai/cli/commit/ddaa2c07a5b93c1ab6fcf5e5782df4d3c0ee0296))
* mcpb bundle builds ([#516](https://github.com/smithery-ai/cli/issues/516)) ([6ce2cb2](https://github.com/smithery-ai/cli/commit/6ce2cb2b9de1518b2039aeaf144ecf4a53504ce9))
* move OIDC permissions to workflow-level in publish.yml ([b9056f3](https://github.com/smithery-ai/cli/commit/b9056f3b3f58cdca3b3d1cad0daa28aaa1980d08))
* pnpm build failures by marking bootstrap dependencies as external  ([#487](https://github.com/smithery-ai/cli/issues/487)) ([28ee513](https://github.com/smithery-ai/cli/commit/28ee513a85b00fb75e583219b56f063c943d24fb))
* prevent platform mismatch in lazy dependency install ([#643](https://github.com/smithery-ai/cli/issues/643)) ([96ea3bf](https://github.com/smithery-ai/cli/commit/96ea3bf0b00d3258c03344da6d968f8dcce0416e))
* publish to npm in release-please workflow ([#565](https://github.com/smithery-ai/cli/issues/565)) ([94b3cdc](https://github.com/smithery-ai/cli/commit/94b3cdc0a7c401bd03003eff1ede550a4ee6cdf1))
* race conditions in tests (file read/write) ([25c0207](https://github.com/smithery-ai/cli/commit/25c0207df73e452f915cea59d9dc35ba2355adda))
* re-deploy patch version to avoid version conflict with 3.10 ([#576](https://github.com/smithery-ai/cli/issues/576)) ([ec52a05](https://github.com/smithery-ai/cli/commit/ec52a05fb876c4689f760762d4a3fe857e9b89f7))
* read SMITHERY_BASE_URL at runtime instead of bake-in at build ([#587](https://github.com/smithery-ai/cli/issues/587)) ([b618c33](https://github.com/smithery-ai/cli/commit/b618c33ad0fba917dd11a02d761d0318fe4ddf44))
* remove .npmrc that interferes with OIDC auth ([#555](https://github.com/smithery-ai/cli/issues/555)) ([87937a9](https://github.com/smithery-ai/cli/commit/87937a9f026c4ccdc233e01f3f008982aa866d4e))
* remove explicit biome linux binary from CI ([#645](https://github.com/smithery-ai/cli/issues/645)) ([51e872d](https://github.com/smithery-ai/cli/commit/51e872d1b67547d7c29f1dab65b89911c1075a18))
* remove oauth for cursor ([b882f1f](https://github.com/smithery-ai/cli/commit/b882f1f4c2892151cb220683bd51c4e32c7496fb))
* remove registry-url to allow OIDC auth ([#553](https://github.com/smithery-ai/cli/issues/553)) ([381aef2](https://github.com/smithery-ai/cli/commit/381aef2b2d0543503f9b0faebbcfdbafe8000171))
* remove unused --print-link option from login command ([#583](https://github.com/smithery-ai/cli/issues/583)) ([9a5b830](https://github.com/smithery-ai/cli/commit/9a5b830fcfc55e855c97a4c2e881c1beadb19753))
* require port specification when no command is provided in playground ([dd9a229](https://github.com/smithery-ai/cli/commit/dd9a229fcbdb77f9d41e866c3dfe02bfc5a303a5))
* resolve biome lint error and add pre-push hook ([#625](https://github.com/smithery-ai/cli/issues/625)) ([588ccf0](https://github.com/smithery-ai/cli/commit/588ccf09f6944eef37f1aa7a986dec9046d96707))
* restore whoami behavior, metadata filtering, and flat pagination ([#687](https://github.com/smithery-ai/cli/issues/687)) ([c9ed674](https://github.com/smithery-ai/cli/commit/c9ed674714941c8aba2b69efedd5352bd78c722c))
* run npx in windows through cmd /c ([#59](https://github.com/smithery-ai/cli/issues/59)) ([ae8badc](https://github.com/smithery-ai/cli/commit/ae8badcfc07e4673c26be79ff38ddea2b6e1ea81))
* search and inspect commands no longer require API key ([#545](https://github.com/smithery-ai/cli/issues/545)) ([b1ff329](https://github.com/smithery-ai/cli/commit/b1ff329ab9a27d297feb63008006fcb7c79941d3)), closes [#544](https://github.com/smithery-ai/cli/issues/544)
* show error message when tool list gets invalid connection name ([#681](https://github.com/smithery-ai/cli/issues/681)) ([50ecb00](https://github.com/smithery-ai/cli/commit/50ecb009c7f004eccf6e1a49bd6af22ef3d574f2))
* simplify uplink peer abstractions and stdio fix ([#738](https://github.com/smithery-ai/cli/issues/738)) ([0080086](https://github.com/smithery-ai/cli/commit/008008618d42b3dfd86b7c51eb3a076d71ab1746))
* simplify widget bundling ([#426](https://github.com/smithery-ai/cli/issues/426)) ([4288b4f](https://github.com/smithery-ai/cli/commit/4288b4ffb7541bd88e041d44887175d4e061fe13))
* **SMI-1470:** improve auth error messages for expired tokens ([#630](https://github.com/smithery-ai/cli/issues/630)) ([45c6fc8](https://github.com/smithery-ai/cli/commit/45c6fc8b1c3b2976fb9a979c1c566a9200f21dd8))
* start heartbeat only after connection established ([#168](https://github.com/smithery-ai/cli/issues/168)) ([2704fb6](https://github.com/smithery-ai/cli/commit/2704fb69159bb8ad508b5d5ee0ca164c3c63ebcf))
* temporarily remove test in workflow ([0d83ecb](https://github.com/smithery-ai/cli/commit/0d83ecbf09fa4547357bb70510265c1a33650829))
* tests during github workflow ([a47b07f](https://github.com/smithery-ai/cli/commit/a47b07fbe5c17b3a86baf65c4c8d868f4919ae1b))
* update skills commands for @smithery/api 0.38.0 ([#585](https://github.com/smithery-ai/cli/issues/585)) ([a049fa0](https://github.com/smithery-ai/cli/commit/a049fa01b803cf026830017691fd807ef8433f20))
* use --save-prod for lazy install to prevent silent no-op ([#658](https://github.com/smithery-ai/cli/issues/658)) ([f4c6614](https://github.com/smithery-ai/cli/commit/f4c6614b03066334e1ca71d1d5e07525d724e344))
* use async exec for lazy install so spinner animates ([#660](https://github.com/smithery-ai/cli/issues/660)) ([82617d4](https://github.com/smithery-ai/cli/commit/82617d4d1984f5555e9c9fa0cd7783d46d3fa7f1))
* use GitHub App token for release-please to trigger CI ([#592](https://github.com/smithery-ai/cli/issues/592)) ([832fe51](https://github.com/smithery-ai/cli/commit/832fe512a36e8251cd8e17ff0a98b0881839cb99))
* use MCP client for listing tools instead of raw HTTP; ref SMI-1260 ([#563](https://github.com/smithery-ai/cli/issues/563)) ([79cb44d](https://github.com/smithery-ai/cli/commit/79cb44d9d66a3fdd01aef827c54a6072d5ab3145))
* use Node 24 for npm OIDC publishing support ([7d7b4e2](https://github.com/smithery-ai/cli/commit/7d7b4e2b80f68c348cefce2c9dbcdf509aa9b7ab))
* use npm OIDC for tokenless publishing ([#552](https://github.com/smithery-ai/cli/issues/552)) ([714ce60](https://github.com/smithery-ai/cli/commit/714ce6002a629011a492be4a959ca0fdf19fb624))
* use pnpm publish with local npm for OIDC auth ([#554](https://github.com/smithery-ai/cli/issues/554)) ([7b7aafd](https://github.com/smithery-ai/cli/commit/7b7aafd5cb2936866cd63928ead6d7c1a142497f))
* use setupUrl in connect flows ([#721](https://github.com/smithery-ai/cli/issues/721)) ([b42c771](https://github.com/smithery-ai/cli/commit/b42c77155c8866d2890cfabf3fd4605bc5bf1845))
* use stderr for postinstall message to bypass npm suppression ([df5f6c4](https://github.com/smithery-ai/cli/commit/df5f6c450e7bb2938d0726894907adbf386e17e2))
* warn on auth-required connections instead of silently failing ([#673](https://github.com/smithery-ai/cli/issues/673)) ([4fe8a8c](https://github.com/smithery-ai/cli/commit/4fe8a8cd53427527179a2fb869d8a63c1cd86936))
* widget bundling ([#427](https://github.com/smithery-ai/cli/issues/427)) ([067c3aa](https://github.com/smithery-ai/cli/commit/067c3aae2ea8473909fa0290f9876ac1d9cc0897))
* windows cmd json parsing error ([#99](https://github.com/smithery-ai/cli/issues/99)) ([e2f3dcf](https://github.com/smithery-ai/cli/commit/e2f3dcf119a26ba454ec267dea2f0b26104a03e4))


### Performance Improvements

* lazy load command implementations to improve CLI startup ([#560](https://github.com/smithery-ai/cli/issues/560)) ([1f4a0e4](https://github.com/smithery-ai/cli/commit/1f4a0e49a4c665d360cd2e03d4887bf3f359f072))
* lazy-install keytar to eliminate native build ([#638](https://github.com/smithery-ai/cli/issues/638)) ([3e445ef](https://github.com/smithery-ai/cli/commit/3e445efdab5a9b587c88eacbabbc53280d66cef7))
* optimize CLI startup, install size, and deps [SMI-1535] ([#637](https://github.com/smithery-ai/cli/issues/637)) ([4a333dc](https://github.com/smithery-ai/cli/commit/4a333dc6c6b0e0ff4ae65858b94a1db4459e6965))
* zero runtime dependencies ([#646](https://github.com/smithery-ai/cli/issues/646)) ([9d0a636](https://github.com/smithery-ai/cli/commit/9d0a6365052ebe145f112beb949aad50ebaf0477))


### Reverts

* remove bootstrap externals approach, use pnpm hoisting instead ([#488](https://github.com/smithery-ai/cli/issues/488)) ([ac19ece](https://github.com/smithery-ai/cli/commit/ac19ece2a4c639ca271f68aecff76a546d499613))


### Documentation

* add value prop about connecting agents to Smithery registry ([#591](https://github.com/smithery-ai/cli/issues/591)) ([090f299](https://github.com/smithery-ai/cli/commit/090f299916a1045d3f45e678f7432d38d0a4596a))
* improve README clarity and accuracy ([#590](https://github.com/smithery-ai/cli/issues/590)) ([d41e65c](https://github.com/smithery-ai/cli/commit/d41e65cf6fc81d2a65d99de38d97c6f28b1f46da))


### Chores

* add direct uplink pairing ([#745](https://github.com/smithery-ai/cli/issues/745)) ([58a60e3](https://github.com/smithery-ai/cli/commit/58a60e341431923fa7ad1d6e17d9aa1e854dc94d))
* add hidden mcp secrets subcommands ([#650](https://github.com/smithery-ai/cli/issues/650)) ([35c9b0a](https://github.com/smithery-ai/cli/commit/35c9b0aa82549e4d642f983539ddd875a2b215fa))
* add mcp ls alias ([#730](https://github.com/smithery-ai/cli/issues/730)) ([806061b](https://github.com/smithery-ai/cli/commit/806061b8d3ad4cac9b75f403d23e47be66ad6486))
* add repo link to package.json ([#163](https://github.com/smithery-ai/cli/issues/163)) ([b634145](https://github.com/smithery-ai/cli/commit/b634145737464af89e59fc386226c4708f77f156))
* bump @smithery/sdk from 1.4.3 to 1.5.2 ([5e28147](https://github.com/smithery-ai/cli/commit/5e28147208b9bfbc6ebabb58fa3d6b715056ea93))
* bump version to 1.1.37 [skip ci] ([6bfb0f1](https://github.com/smithery-ai/cli/commit/6bfb0f136089d1d3b1ac9ed0014a9a76b25d978b))
* bump version to 1.1.38 [skip ci] ([27dab9f](https://github.com/smithery-ai/cli/commit/27dab9fc03dbe2e855635aefc80cd9afd595c55e))
* bump version to 1.1.39 [skip ci] ([074c9d8](https://github.com/smithery-ai/cli/commit/074c9d81b5c40486d817e48a6a71fd0f2b1db2e8))
* bump version to 1.1.40 [skip ci] ([8e0c2de](https://github.com/smithery-ai/cli/commit/8e0c2de0c992216cc68f081b6f26fb937ddd270f))
* bump version to 1.1.41 [skip ci] ([f92db41](https://github.com/smithery-ai/cli/commit/f92db416979ef09638992a3f83255a7f91805229))
* bump version to 1.1.42 [skip ci] ([351c7e9](https://github.com/smithery-ai/cli/commit/351c7e98c11c98daf6305db2220434149c0b3cd5))
* bump version to 1.1.43 [skip ci] ([5fd6681](https://github.com/smithery-ai/cli/commit/5fd66817aca5062786f3a70ff9223a9c4b127c18))
* bump version to 1.1.44 [skip ci] ([1e18419](https://github.com/smithery-ai/cli/commit/1e18419a87f95321ce22181ec5e96cea2fa33c23))
* bump version to 1.1.45 [skip ci] ([fd6b40c](https://github.com/smithery-ai/cli/commit/fd6b40c8658af4a2248c9e6b8ec4a4c5b02ec163))
* bump version to 1.1.46 [skip ci] ([6edba26](https://github.com/smithery-ai/cli/commit/6edba269828a597acd5b7dff7d4a886dd43b7757))
* bump version to 1.1.47 [skip ci] ([e3e4d69](https://github.com/smithery-ai/cli/commit/e3e4d69bbdbbf75a5217e72d2fb9049cffa371b9))
* bump version to 1.1.48 [skip ci] ([faff898](https://github.com/smithery-ai/cli/commit/faff89873798062c17f30d6d7cf60cc6e92c4c76))
* bump version to 1.1.49 [skip ci] ([607a532](https://github.com/smithery-ai/cli/commit/607a532dfe98c1dbb4ff95c321c93eaa57a01c7f))
* bump version to 1.1.50 [skip ci] ([8f59c61](https://github.com/smithery-ai/cli/commit/8f59c61b183183caa800358a18c966ed579f9e18))
* bump version to 1.1.51 [skip ci] ([c2fb52b](https://github.com/smithery-ai/cli/commit/c2fb52b9956d6a934d8b4dd0c9c38b1b3be776b2))
* bump version to 1.1.52 [skip ci] ([3a33252](https://github.com/smithery-ai/cli/commit/3a332524ba6a3e63c1179597398b6a883feba3b2))
* bump version to 1.1.53 [skip ci] ([8d8b17f](https://github.com/smithery-ai/cli/commit/8d8b17f6bb26102955aa9f1efbb8b373579315ba))
* bump version to 1.1.54 [skip ci] ([8c1687e](https://github.com/smithery-ai/cli/commit/8c1687ee42c422bbf3a7fc045fe07d3dc3bbe7a9))
* bump version to 1.1.55 [skip ci] ([b34baf7](https://github.com/smithery-ai/cli/commit/b34baf7192bdba94fa846a818b35b85329fef037))
* bump version to 1.1.56 [skip ci] ([b15b36f](https://github.com/smithery-ai/cli/commit/b15b36f5f2e669a60bc1425c1876d104ca53ed3a))
* bump version to 1.1.57 [skip ci] ([c91603f](https://github.com/smithery-ai/cli/commit/c91603f0f26c45b3f77f3bbf14f9d37e1141b4cc))
* bump version to 1.1.58 [skip ci] ([c82dd7e](https://github.com/smithery-ai/cli/commit/c82dd7efc2dd911e726714a1ff2e7b2d3d422040))
* bump version to 1.1.59 [skip ci] ([832f3b0](https://github.com/smithery-ai/cli/commit/832f3b063c65cec844cb4021e758a9a356bfb751))
* bump version to 1.1.60 [skip ci] ([1555898](https://github.com/smithery-ai/cli/commit/155589856f755a8448690bcbaa0e2c0897105860))
* bump version to 1.1.61 [skip ci] ([d08dbb3](https://github.com/smithery-ai/cli/commit/d08dbb3051aa02943fb1566b57e1da9749c1e9ce))
* bump version to 1.1.62 [skip ci] ([b331c93](https://github.com/smithery-ai/cli/commit/b331c93b337805ce29de990a48357de7ebbb4eb4))
* bump version to 1.1.63 [skip ci] ([537b9c4](https://github.com/smithery-ai/cli/commit/537b9c44dac70e1c34b25f43f372ccb10fbd2b27))
* bump version to 1.1.64 [skip ci] ([c6ca5d7](https://github.com/smithery-ai/cli/commit/c6ca5d7282a6f7d9175aa17c1cb95002b88daebb))
* bump version to 1.1.65 [skip ci] ([c8b857a](https://github.com/smithery-ai/cli/commit/c8b857a8f4b1dd2d228945aaac076ccfe8d489e7))
* bump version to 1.1.66 [skip ci] ([d543f2c](https://github.com/smithery-ai/cli/commit/d543f2ccf0a2abf2adf0d83fb913ca747092516b))
* bump version to 1.1.67 [skip ci] ([1d09475](https://github.com/smithery-ai/cli/commit/1d09475c474903a72ee35a29cdeb12ffc58b6ae2))
* bump version to 1.1.68 [skip ci] ([b6d9dc5](https://github.com/smithery-ai/cli/commit/b6d9dc5c4af53ac4136c483009223b57140f1d9c))
* bump version to 1.1.69 [skip ci] ([cef10de](https://github.com/smithery-ai/cli/commit/cef10dee50f8545356dd0f1f52d1582ba6ff8145))
* bump version to 1.1.70 [skip ci] ([56ae031](https://github.com/smithery-ai/cli/commit/56ae031956c6366575f829a84cc204b49c66902b))
* bump version to 1.1.71 [skip ci] ([06a560d](https://github.com/smithery-ai/cli/commit/06a560df966256fc6a396d04949b073622878451))
* bump version to 1.1.72 [skip ci] ([57c52e2](https://github.com/smithery-ai/cli/commit/57c52e2ad915ab9e50a33add44b40eacba83bb5c))
* bump version to 1.1.73 [skip ci] ([3e66ec5](https://github.com/smithery-ai/cli/commit/3e66ec5ad9b6c607ecd6210f468aff4cc6992f4e))
* bump version to 1.1.74 [skip ci] ([f2bcfcf](https://github.com/smithery-ai/cli/commit/f2bcfcf7d0c37519a093a749c4f5cebe321649fb))
* bump version to 1.1.75 [skip ci] ([0f11c05](https://github.com/smithery-ai/cli/commit/0f11c05e923674bede69c4c40dac79583238a24f))
* bump version to 1.1.76 [skip ci] ([473a177](https://github.com/smithery-ai/cli/commit/473a1777b45640be59ef2da6deb895b27a73dcf0))
* bump version to 1.1.77 [skip ci] ([08675b1](https://github.com/smithery-ai/cli/commit/08675b1ddffadb1ab028edc454f2eeaa5680079d))
* bump version to 1.1.78 [skip ci] ([5208909](https://github.com/smithery-ai/cli/commit/5208909018fcaee2d45bcbdb2270d7f7868d41bb))
* bump version to 1.1.79 [skip ci] ([c5b34cf](https://github.com/smithery-ai/cli/commit/c5b34cfa0cdc149701e9a687843ad31d5f516818))
* bump version to 1.1.80 [skip ci] ([fc9c1c0](https://github.com/smithery-ai/cli/commit/fc9c1c0fcd25797156f0f7da68db332a217914ad))
* bump version to 1.1.81 [skip ci] ([ae42335](https://github.com/smithery-ai/cli/commit/ae42335224e6777cc7179ce00a9580eedc21242d))
* bump version to 1.1.82 [skip ci] ([c6c2998](https://github.com/smithery-ai/cli/commit/c6c29984b4f199c1abd5ef2c239bde468a62d57a))
* bump version to 1.1.83 [skip ci] ([2ee0157](https://github.com/smithery-ai/cli/commit/2ee01575f229361fa7c41c2d526135af55c63539))
* bump version to 1.1.84 [skip ci] ([151f1c1](https://github.com/smithery-ai/cli/commit/151f1c11971fed5b71660f78ed98c0ff63fe0c98))
* bump version to 1.1.85 [skip ci] ([ff7e19d](https://github.com/smithery-ai/cli/commit/ff7e19dcdab0fac79869197e246b58d44fff0539))
* bump version to 1.1.86 [skip ci] ([4189904](https://github.com/smithery-ai/cli/commit/41899045d1c576dc471f6f4204cbbaa1a812ddbc))
* bump version to 1.1.87 [skip ci] ([10c8e10](https://github.com/smithery-ai/cli/commit/10c8e10a94a6c5984aa8e910d78faea649425824))
* bump version to 1.1.88 [skip ci] ([254e4fd](https://github.com/smithery-ai/cli/commit/254e4fd883b39a0e9d17894396e24a51bdca283b))
* bump version to 1.1.89 [skip ci] ([029ef73](https://github.com/smithery-ai/cli/commit/029ef736d11f026b464efb4b29093063d66f95a7))
* bump version to 1.2.1 [skip ci] ([6a7261b](https://github.com/smithery-ai/cli/commit/6a7261badd6be788e5d9f42f9bc15a512c06cc20))
* bump version to 1.2.10 [skip ci] ([a9cf666](https://github.com/smithery-ai/cli/commit/a9cf66663afdfed26e340449ee64a7a2a2f70e7e))
* bump version to 1.2.11 [skip ci] ([d5f53d9](https://github.com/smithery-ai/cli/commit/d5f53d9f601ddfc90ab0e11a0b0ce10331aa7385))
* bump version to 1.2.12 [skip ci] ([f099421](https://github.com/smithery-ai/cli/commit/f099421e485de1ff2fa175d90b92a86a13caae03))
* bump version to 1.2.13 [skip ci] ([009d3cd](https://github.com/smithery-ai/cli/commit/009d3cd92f19bb91b71cc33af0bff7c3ffa16732))
* bump version to 1.2.14 [skip ci] ([1f292a4](https://github.com/smithery-ai/cli/commit/1f292a4deda4c76a7975d3747f76c1157a4f81a1))
* bump version to 1.2.15 [skip ci] ([01d20bc](https://github.com/smithery-ai/cli/commit/01d20bc32946d46ad844e10488d4c4f114184136))
* bump version to 1.2.16 [skip ci] ([5427b6e](https://github.com/smithery-ai/cli/commit/5427b6ea238d47efbfda77f4fb471fd66534bade))
* bump version to 1.2.17 [skip ci] ([e3e7bc4](https://github.com/smithery-ai/cli/commit/e3e7bc4095e4c6e404683d20241db9d9065f07bf))
* bump version to 1.2.18 [skip ci] ([7646a71](https://github.com/smithery-ai/cli/commit/7646a7165fef4b3a4bd2ca657c675c6a87ee4005))
* bump version to 1.2.19 [skip ci] ([bc653e1](https://github.com/smithery-ai/cli/commit/bc653e1a56a0f7ab88c194191515356fbcc3eef2))
* bump version to 1.2.2 [skip ci] ([fa878de](https://github.com/smithery-ai/cli/commit/fa878de8a1bb7cc44fc0ac05a38a1e1c1e850934))
* bump version to 1.2.20 [skip ci] ([a9a19d9](https://github.com/smithery-ai/cli/commit/a9a19d9300d52c5757d421ecd068824082c505df))
* bump version to 1.2.21 [skip ci] ([53c1f52](https://github.com/smithery-ai/cli/commit/53c1f521a483bde4cb24f629f737922bb98ca286))
* bump version to 1.2.22 [skip ci] ([e5faefd](https://github.com/smithery-ai/cli/commit/e5faefdc0b4cfa9c6dbde262ebd816abfb7a644e))
* bump version to 1.2.23 [skip ci] ([980ffe5](https://github.com/smithery-ai/cli/commit/980ffe51b04974fe476f758317519118a62eccfb))
* bump version to 1.2.24 [skip ci] ([ce10093](https://github.com/smithery-ai/cli/commit/ce100939f5c755b20bcebef369672196725e925b))
* bump version to 1.2.25 [skip ci] ([d483bcc](https://github.com/smithery-ai/cli/commit/d483bcc663637c95826ade2b3033d37ae4266e3b))
* bump version to 1.2.26 [skip ci] ([76c7a58](https://github.com/smithery-ai/cli/commit/76c7a58526291258195e19e4e6b7ab577f1e01dd))
* bump version to 1.2.27 [skip ci] ([b52c7bd](https://github.com/smithery-ai/cli/commit/b52c7bd24946ec1a938dd5ed0da48f536a2cd77a))
* bump version to 1.2.28 [skip ci] ([86dc648](https://github.com/smithery-ai/cli/commit/86dc6481e32b6bf14d61c8be685a3f5037641423))
* bump version to 1.2.29 [skip ci] ([f8d6d8b](https://github.com/smithery-ai/cli/commit/f8d6d8b554f8c4158b04cfee4dd43154b7e89492))
* bump version to 1.2.3 [skip ci] ([d853c28](https://github.com/smithery-ai/cli/commit/d853c28492045e1de5128c81492a029f0fb57103))
* bump version to 1.2.30 [skip ci] ([b8a1693](https://github.com/smithery-ai/cli/commit/b8a1693696582d0777865c1c30f252e7463cc99d))
* bump version to 1.2.31 [skip ci] ([61238df](https://github.com/smithery-ai/cli/commit/61238dff145806171dfe94a3f0be46eecdfeb2e9))
* bump version to 1.2.4 [skip ci] ([b6471b2](https://github.com/smithery-ai/cli/commit/b6471b2c1cb3283d3bf05c7eeff3599090e2f234))
* bump version to 1.2.5 [skip ci] ([3854286](https://github.com/smithery-ai/cli/commit/38542860ed3ce42143d0b858a015e0be4b6a250a))
* bump version to 1.2.6 [skip ci] ([6a75b59](https://github.com/smithery-ai/cli/commit/6a75b5960abaa1505f1d880a3fd7909dcb1a4085))
* bump version to 1.2.7 [skip ci] ([1182530](https://github.com/smithery-ai/cli/commit/1182530224f3c36dcc05469e70e85273fa57eaf7))
* bump version to 1.2.8 [skip ci] ([214de4a](https://github.com/smithery-ai/cli/commit/214de4a41d27aa0158b8d2c24a37641d003eaa15))
* bump version to 1.2.9 [skip ci] ([e1481a6](https://github.com/smithery-ai/cli/commit/e1481a6927afbf1789c8f5e93c3735c7cdfa8344))
* clean up CLI and add tests ([#497](https://github.com/smithery-ai/cli/issues/497)) ([2084f6b](https://github.com/smithery-ai/cli/commit/2084f6b736fafa5cdded9ce3dddccdc55cbb5587))
* fix lints and improve typing ([#506](https://github.com/smithery-ai/cli/issues/506)) ([e30a054](https://github.com/smithery-ai/cli/commit/e30a05437eacebd69414ac6f796a130ade15ce80))
* **fix:** outdated lockfile ([5bd4636](https://github.com/smithery-ai/cli/commit/5bd4636cea4993f0f948aabbb68d7c7e9d76d8d4))
* hide homepage command from public help ([#752](https://github.com/smithery-ai/cli/issues/752)) ([251cadb](https://github.com/smithery-ai/cli/commit/251cadbcc80b583e97b349f8b399cf3f84e46292))
* ignore macOS AppleDouble files (._*) ([#627](https://github.com/smithery-ai/cli/issues/627)) ([7bb82c6](https://github.com/smithery-ai/cli/commit/7bb82c61f21fb46f5891feb16c880e6d590a9a1c))
* major version bump ([cf863b6](https://github.com/smithery-ai/cli/commit/cf863b60170958979eae93ab48eca6ae7f25c894))
* pin first release to 1.0.0 ([683a982](https://github.com/smithery-ai/cli/commit/683a982316cbd473c80937a3879c27db7a053e7a))
* remove review, upvote, downvote commands (SMI-1505) ([#706](https://github.com/smithery-ai/cli/issues/706)) ([36e7882](https://github.com/smithery-ai/cli/commit/36e78827a7821965375a0f02890174a7b003c1f9))
* rename npm package to smithery (1.0.0) ([#749](https://github.com/smithery-ai/cli/issues/749)) ([1aa4e5f](https://github.com/smithery-ai/cli/commit/1aa4e5fc4a0e560b89ecd570cbe5aae7cc8cdb1f))
* **SMI-1539:** add event command for MCP event subscriptions ([#652](https://github.com/smithery-ai/cli/issues/652)) ([6da0b63](https://github.com/smithery-ai/cli/commit/6da0b639d8f225f5c76eae86aaa3e0b9c0b2a72a))
* **SMI-1540:** scan event topics during publish ([#654](https://github.com/smithery-ai/cli/issues/654)) ([54b8ef0](https://github.com/smithery-ai/cli/commit/54b8ef0675b429e99fc3910e3f5d2087fe634809))
* **SMI-1552:** add events poll command and update SDK to 0.52.0 ([#670](https://github.com/smithery-ai/cli/issues/670)) ([cfe076d](https://github.com/smithery-ai/cli/commit/cfe076d84c54ea51d2c4d90a22668c41fd1aa557))
* **SMI-1567:** add prefix filtering to tool list and event topics ([#678](https://github.com/smithery-ai/cli/issues/678)) ([cdb28e8](https://github.com/smithery-ai/cli/commit/cdb28e88b5c5e1f74fb12613b485615ba6a6ee80))
* support deprecated playground related commands with notice ([#504](https://github.com/smithery-ai/cli/issues/504)) ([822aea4](https://github.com/smithery-ai/cli/commit/822aea459b6fd703124aa9cb967789e7913cfb0f))
* trigger release-please workflow ([cfa5be4](https://github.com/smithery-ai/cli/commit/cfa5be42421543df1ca821e739e9141a58dce612))
* update @smithery/api to 0.58.0 ([#717](https://github.com/smithery-ai/cli/issues/717)) ([b714a86](https://github.com/smithery-ai/cli/commit/b714a863476c231c15501c33ec8b3b3e773c4a9a))
* update biome ([#379](https://github.com/smithery-ai/cli/issues/379)) ([7a6912b](https://github.com/smithery-ai/cli/commit/7a6912b8abd6969c7b58337a9a5ee3ba0b4c747c))
* update biome schema version ([fd6532e](https://github.com/smithery-ai/cli/commit/fd6532e02e8e113ee7b37ecb46ca3c5ba5b6af70))
* update dependencies ([b14de9a](https://github.com/smithery-ai/cli/commit/b14de9a850e12d4d2600700b1e6022331543f5a4))
* update dependencies (zod4, mcp sdk); migrate to pnpm ([#494](https://github.com/smithery-ai/cli/issues/494)) ([7fc8a02](https://github.com/smithery-ai/cli/commit/7fc8a029a16ca0ea05b060b3850ddd87f23e3473))
* update dependencies, publish workflow, add agent guides ([96cb582](https://github.com/smithery-ai/cli/commit/96cb582a5f84e9f4f1abe9abca4d301ab0b273f6))
* update dev bootstrap for SDK v4.1.0 ([#676](https://github.com/smithery-ai/cli/issues/676)) ([7a105de](https://github.com/smithery-ai/cli/commit/7a105de0d0a9fb315dd4f36f5155b4f37dd13a3a))
* update pnpm version and allow build scripts ([#511](https://github.com/smithery-ai/cli/issues/511)) ([1d945d5](https://github.com/smithery-ai/cli/commit/1d945d516baf1a43de29780097568dddd9db2d5e))
* update to latest smithery api ([#525](https://github.com/smithery-ai/cli/issues/525)) ([12ba82f](https://github.com/smithery-ai/cli/commit/12ba82fbb9e2688eb983ebfff2c86db663c184cd))
* use positional args for secret set command ([#665](https://github.com/smithery-ai/cli/issues/665)) ([79c310e](https://github.com/smithery-ai/cli/commit/79c310e0a878d0bf82a873459ca79f7692e1d3f2))
* use smithery.run REST API ([#739](https://github.com/smithery-ai/cli/issues/739)) ([965c84e](https://github.com/smithery-ai/cli/commit/965c84e1ffed1f1472c63d12fae05a2ffe7ad52b))
* verify release-please workflow ([0b1c416](https://github.com/smithery-ai/cli/commit/0b1c416674a0df5a65c7cea6814b97459717ea9c))


### Refactors

* **auth:** remove whoami token mint/server flow ([#686](https://github.com/smithery-ai/cli/issues/686)) ([b8a9805](https://github.com/smithery-ai/cli/commit/b8a980564aec8c2464baab17cfa14deb9aa6ebd6))
* clean up index file ([#377](https://github.com/smithery-ai/cli/issues/377)) ([87c94f9](https://github.com/smithery-ai/cli/commit/87c94f995eb1eb6fd7ea532439b44d81741cbd5a))
* extract MCP connection output helper ([#718](https://github.com/smithery-ai/cli/issues/718)) ([1bbc5bd](https://github.com/smithery-ai/cli/commit/1bbc5bd566a01719e219cf7baaedc5af96b987dc))
* improve config validation, process clean up ([#149](https://github.com/smithery-ai/cli/issues/149)) ([96b2de1](https://github.com/smithery-ai/cli/commit/96b2de1ddd524c593ec8becc1d7ecc89f9850362))
* improve Smithery skill metadata; ref SMI-1404 ([#614](https://github.com/smithery-ai/cli/issues/614)) ([f36b4ba](https://github.com/smithery-ai/cli/commit/f36b4ba794e1b6df73de59a46d378eb6f5e9da14))
* remove automation commands feature ([#698](https://github.com/smithery-ai/cli/issues/698)) ([5413f9b](https://github.com/smithery-ai/cli/commit/5413f9b51f64ff175c2c7474abdf5cd680b2f744))
* rename "deployment" to "release" in CLI output ([#624](https://github.com/smithery-ai/cli/issues/624)) ([a3da821](https://github.com/smithery-ai/cli/commit/a3da821aef815efa14abbbc2f06c139b5d450265))
* rename roo-code to roocode ([#145](https://github.com/smithery-ai/cli/issues/145)) ([178efd5](https://github.com/smithery-ai/cli/commit/178efd5573a8ca14aba1589aa17f64c1410938ea))
* replace jsonc-parser with bundlable comment-json ([#648](https://github.com/smithery-ai/cli/issues/648)) ([2877d18](https://github.com/smithery-ai/cli/commit/2877d1801ab7d8a520e70869331935a632de6e52))
* simplify client config architecture + JSONC support ([#541](https://github.com/smithery-ai/cli/issues/541)) ([8001792](https://github.com/smithery-ai/cli/commit/80017927d6c324434942368a8325e09346af7f30))
* **trigger:** align CLI with MCP Events spec, hide from main help ([#758](https://github.com/smithery-ai/cli/issues/758)) ([6e4e0f0](https://github.com/smithery-ai/cli/commit/6e4e0f0b716b1d3b1c6682b0397a8c8005552369))
* use @smithery/api client for skills reviews ([#570](https://github.com/smithery-ai/cli/issues/570)) ([38957aa](https://github.com/smithery-ai/cli/commit/38957aa44b38e6c62390ffbc8c1aa25540e80bb1))

## [1.0.1](https://github.com/smithery-ai/cli/compare/v1.0.0...v1.0.1) (2026-05-03)


### Bug Fixes

* **mcp add:** resume setup when re-adding incomplete connection ([#756](https://github.com/smithery-ai/cli/issues/756)) ([ddaa2c0](https://github.com/smithery-ai/cli/commit/ddaa2c07a5b93c1ab6fcf5e5782df4d3c0ee0296))


### Refactors

* **trigger:** align CLI with MCP Events spec, hide from main help ([#758](https://github.com/smithery-ai/cli/issues/758)) ([6e4e0f0](https://github.com/smithery-ai/cli/commit/6e4e0f0b716b1d3b1c6682b0397a8c8005552369))

## [1.0.0](https://github.com/smithery-ai/cli/compare/v1.0.0...v1.0.0) (2026-05-01)


### ⚠ BREAKING CHANGES

* rename npm package to smithery (1.0.0) ([#749](https://github.com/smithery-ai/cli/issues/749))
* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623))
* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613))

### Features

* add --config-schema flag for external URL publish (SMI-1246) ([#538](https://github.com/smithery-ai/cli/issues/538)) ([68fcf07](https://github.com/smithery-ai/cli/commit/68fcf07d26f72b3e20530fac716a59edcf5c351c))
* add --headers option to connect add/set commands ([#581](https://github.com/smithery-ai/cli/issues/581)) ([da2856d](https://github.com/smithery-ai/cli/commit/da2856d77f766d72655e668d3063381d30c793e2))
* add api key prompt for remote server installation ([#172](https://github.com/smithery-ai/cli/issues/172)) ([6b1cdad](https://github.com/smithery-ai/cli/commit/6b1cdadb3a48e893dd8b3eeb69e0cf3dde68a2e0))
* add comprehensive Smithery CLI skill [SMI-1367] ([#562](https://github.com/smithery-ai/cli/issues/562)) ([04ace79](https://github.com/smithery-ai/cli/commit/04ace79f9ceba978015e1882c302055028f90493))
* add custom ID and metadata support to connect command ([#558](https://github.com/smithery-ai/cli/issues/558)) ([11c1484](https://github.com/smithery-ai/cli/commit/11c1484a6dcec5bc5ae3dbb2d07ade5ac8df748f))
* add dev query param to playground link ([#364](https://github.com/smithery-ai/cli/issues/364)) ([be4180c](https://github.com/smithery-ai/cli/commit/be4180c9737275c9c7ad4add6da941f46193136f))
* add heartbeat to WS connection ([#103](https://github.com/smithery-ai/cli/issues/103)) ([9ceaac8](https://github.com/smithery-ai/cli/commit/9ceaac868e8d5e5406882971263d93fa0a4484be))
* add homepage command to manage local dashboard daemon ([6aebb7a](https://github.com/smithery-ai/cli/commit/6aebb7a2d667c5f45e62068539faeb6ca0143933))
* add jitter to WebSocket reconnection logic and refactor WS runner ([#86](https://github.com/smithery-ai/cli/issues/86)) ([0a67eb6](https://github.com/smithery-ai/cli/commit/0a67eb64b89bfce7020b3fffc1a18394a0919aeb))
* add logout command to remove all local credentials ([#574](https://github.com/smithery-ai/cli/issues/574)) ([1d6db88](https://github.com/smithery-ai/cli/commit/1d6db88c2e315a04db44001b97b165f65aaf64ee))
* add OpenCode client (stdio only) ([#484](https://github.com/smithery-ai/cli/issues/484)) ([83e84bd](https://github.com/smithery-ai/cli/commit/83e84bd00c687b883385feb6674e568712c6e3eb))
* add post-install message and servers search command ([#598](https://github.com/smithery-ai/cli/issues/598)) ([874d8c2](https://github.com/smithery-ai/cli/commit/874d8c2534eb6412e57eb9fee379b4c7cb18e153))
* add retry and timeout options to sdk and api calls ([#401](https://github.com/smithery-ai/cli/issues/401)) ([990d829](https://github.com/smithery-ai/cli/commit/990d8298c573e7287ebbc3040921c23b27519901))
* add roo code installation ([#144](https://github.com/smithery-ai/cli/issues/144)) ([3015dff](https://github.com/smithery-ai/cli/commit/3015dff712607594207934bb507113a4f38e29a9))
* add search param and register mcp logs command ([#663](https://github.com/smithery-ai/cli/issues/663)) ([a5406fa](https://github.com/smithery-ai/cli/commit/a5406faa5eb9f165e25ca9dac1955d1346adbdca))
* add session analytics ([#180](https://github.com/smithery-ai/cli/issues/180)) ([eea2b1c](https://github.com/smithery-ai/cli/commit/eea2b1c6c211c322f364afcfe997736f4222f578))
* add skills review and vote commands ([#568](https://github.com/smithery-ai/cli/issues/568)) ([9251cfd](https://github.com/smithery-ai/cli/commit/9251cfdd4b400667e6193d0ba2b23f12c318ee94))
* add skills search and install commands ([#550](https://github.com/smithery-ai/cli/issues/550)) ([2b1c2db](https://github.com/smithery-ai/cli/commit/2b1c2db55a8e88c0e4720090ba6d3852c89fdea0))
* add skills view command ([#609](https://github.com/smithery-ai/cli/issues/609)) ([e0d3e65](https://github.com/smithery-ai/cli/commit/e0d3e65e65f44cec5dddb307e398f2c2a81d409c))
* add smithery setup command ([#616](https://github.com/smithery-ai/cli/issues/616)) ([d78e8d0](https://github.com/smithery-ai/cli/commit/d78e8d03a45f8b9254a52129eeb781f23a33a18f))
* add support for smithery profiles ([#170](https://github.com/smithery-ai/cli/issues/170)) ([5e3770e](https://github.com/smithery-ai/cli/commit/5e3770e4210133442b3028b46844e46e5dc25f39))
* add tests for public API patterns ([#566](https://github.com/smithery-ai/cli/issues/566)) ([e394217](https://github.com/smithery-ai/cli/commit/e394217c1980b59804991f846b1eb33df67b3bf3))
* **automation:** add zod schema validation and improve DX ([#692](https://github.com/smithery-ai/cli/issues/692)) ([4840995](https://github.com/smithery-ai/cli/commit/484099570bc60d6ea5162cd995a501a8e3a6782c))
* **beta:** support openai apps ([#425](https://github.com/smithery-ai/cli/issues/425)) ([5965ff6](https://github.com/smithery-ai/cli/commit/5965ff6db932fda3e017d7746b31d0e5a48dade2))
* build stateless server ([#362](https://github.com/smithery-ai/cli/issues/362)) ([8792645](https://github.com/smithery-ai/cli/commit/8792645d765b81a2822aee35fed7780b53f6ffb2))
* bundler options, update output format to ESM, remove npm cache from actions workflow ([#388](https://github.com/smithery-ai/cli/issues/388)) ([ccd466a](https://github.com/smithery-ai/cli/commit/ccd466ae3e88479e2d8e68c18128b3f4cd06f5c7))
* cache tool input/output schemas as Zod types after mcp call ([b9098e5](https://github.com/smithery-ai/cli/commit/b9098e5fa44f2336b9c58d04b28a40bc634507d9))
* check for latest server when using bundles ([#407](https://github.com/smithery-ai/cli/issues/407)) ([8a9a35f](https://github.com/smithery-ai/cli/commit/8a9a35f3eae446df0a43cdb066549043a9716f8b))
* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613)) ([56e0e7b](https://github.com/smithery-ai/cli/commit/56e0e7bf52cc0ffd2e01eb7e80c9a1ccf5432187))
* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623)) ([36a6944](https://github.com/smithery-ai/cli/commit/36a694416c3b85cf263d09e49de0f9cebdd7997e))
* detect createAuthAdapter export and write to manifest [SMI-1160] ([#604](https://github.com/smithery-ai/cli/issues/604)) ([f5f6b74](https://github.com/smithery-ai/cli/commit/f5f6b742a2885178b229a11df74ea3b17a292c16))
* enhance connect commands with get, pagination, error handling, and shorthand URLs ([#589](https://github.com/smithery-ai/cli/issues/589)) ([04293a7](https://github.com/smithery-ai/cli/commit/04293a719f663f8f81c47c131c63121b4d0659ea))
* improve auth token --policy UX with JSON schema and repeatable constraints ([#675](https://github.com/smithery-ai/cli/issues/675)) ([b95bd6f](https://github.com/smithery-ai/cli/commit/b95bd6f8c32780c6a13b8cbddc4eacb932243482))
* improve postinstall message for agents ([#601](https://github.com/smithery-ai/cli/issues/601)) ([92726b5](https://github.com/smithery-ai/cli/commit/92726b5231062136e650f271b15709d74273c310))
* improve review add UX with GitHub-style syntax ([#580](https://github.com/smithery-ai/cli/issues/580)) ([52aeb1d](https://github.com/smithery-ai/cli/commit/52aeb1df451167854ae2c0a346b37d9b1dec656f))
* improve run for bundled servers ([#423](https://github.com/smithery-ai/cli/issues/423)) ([9cebf18](https://github.com/smithery-ai/cli/commit/9cebf188a4fcf8223d0f0e77aaea39b794a8c894))
* improve search and connect UX for agents ([#605](https://github.com/smithery-ai/cli/issues/605)) ([11c8ef7](https://github.com/smithery-ai/cli/commit/11c8ef7d25c148d2e845ded0e7a6878a64290785))
* improved connections and idle timeout management ([#270](https://github.com/smithery-ai/cli/issues/270)) [SMI-451] ([fe779c3](https://github.com/smithery-ai/cli/commit/fe779c366159173ebc411b870219a0575ff86ec6))
* migrate to ESM from commonJS ([#385](https://github.com/smithery-ai/cli/issues/385)) ([ce606bd](https://github.com/smithery-ai/cli/commit/ce606bdd90639a95878783f4671ef8f6dd272de8))
* migrate to Release Please for automated releases ([#549](https://github.com/smithery-ai/cli/issues/549)) ([be724ae](https://github.com/smithery-ai/cli/commit/be724aededefc85d1e82fe486861aed9fbaffaac))
* minify by default in dev, allow configuration ([#428](https://github.com/smithery-ai/cli/issues/428)) ([610b9fe](https://github.com/smithery-ai/cli/commit/610b9fe6ce70db31e86bb5dd667b5600691e2b70))
* optimize skill trigger description [SMI-1493] ([#636](https://github.com/smithery-ai/cli/issues/636)) ([3e55dde](https://github.com/smithery-ai/cli/commit/3e55ddea506bf6bb2453598461862f2bc97f0f12))
* pass config to bundle stdio process as args & fix: cleanup process on exit signal ([#402](https://github.com/smithery-ai/cli/issues/402)) ([f80e031](https://github.com/smithery-ai/cli/commit/f80e031bb1ae7d9bbab48477358bfc1834d81203))
* Poll mcp add auth setup flow ([#743](https://github.com/smithery-ai/cli/issues/743)) ([0af019d](https://github.com/smithery-ai/cli/commit/0af019db41573b8a6871097b7b67057850fdd448))
* pr and issue template ([#312](https://github.com/smithery-ai/cli/issues/312)) ([af60cc9](https://github.com/smithery-ai/cli/commit/af60cc9278ca08679cadbeb923b39043e9d73aa9))
* pretty console logs ([#389](https://github.com/smithery-ai/cli/issues/389)) ([58adc6e](https://github.com/smithery-ai/cli/commit/58adc6ece90aba2242c73d41379881a7ec5055a1))
* prompt config for local servers in playground command ([#508](https://github.com/smithery-ai/cli/issues/508)) ([4e20fe0](https://github.com/smithery-ai/cli/commit/4e20fe0a0f3a08cc1c08feeb6d963403bddeb068))
* prompt for api key when key invalid ([#510](https://github.com/smithery-ai/cli/issues/510)) ([d6087ff](https://github.com/smithery-ai/cli/commit/d6087ffb5febb07e5986b68bd116eb904691159e))
* redesign skills review and vote CLI with gh-style commands ([#572](https://github.com/smithery-ai/cli/issues/572)) ([6463e37](https://github.com/smithery-ai/cli/commit/6463e37383b8b8d86d8ee286ca819f1b3b135e8d))
* remove api key requirement for local servers ([#167](https://github.com/smithery-ai/cli/issues/167)) ([7171ae9](https://github.com/smithery-ai/cli/commit/7171ae98cf6233013236abb9f5dcf5dfd876b96c))
* remove mcp dev command ([#727](https://github.com/smithery-ai/cli/issues/727)) ([980f994](https://github.com/smithery-ai/cli/commit/980f9943c512a88f64a3bf04fba0ef5de4f3515e))
* **run:** allow empty strings for required config fields during runtime ([#110](https://github.com/smithery-ai/cli/issues/110)) ([c514b10](https://github.com/smithery-ai/cli/commit/c514b106918c6d61d9918cf367ca9aca013ee992))
* session termination ([#165](https://github.com/smithery-ai/cli/issues/165)) ([3a46f31](https://github.com/smithery-ai/cli/commit/3a46f31447eb8581f32d798bac670153612f5508))
* show welcome message when CLI runs without arguments ([e2a7cc6](https://github.com/smithery-ai/cli/commit/e2a7cc6b7f7d1a2d0fd4c5b000b48eaaf5f5ae63))
* **skill:** add publish command ([#696](https://github.com/smithery-ai/cli/issues/696)) ([2b8c592](https://github.com/smithery-ai/cli/commit/2b8c59251515ae8b98f98eb2668e4d2fdcf719c6))
* **SMI-1512:** Add --unstableWebhookUrl option to smithery mcp add ([#634](https://github.com/smithery-ai/cli/issues/634)) ([944034e](https://github.com/smithery-ai/cli/commit/944034eb7656aae872efd53b6dbb4636eca3c2d6))
* **SMI-1564:** tree-based tool browsing with required connection arg ([#684](https://github.com/smithery-ai/cli/issues/684)) ([7562772](https://github.com/smithery-ai/cli/commit/756277255397b60667257b7d67ad745d8dbfdd52))
* **SMI-1823:** add trigger CLI commands ([#736](https://github.com/smithery-ai/cli/issues/736)) ([1368e3f](https://github.com/smithery-ai/cli/commit/1368e3fa48661ee470ec83e16761eec3638408ae))
* **SMI-1839:** download and run MCPB bundles via uplink on mcp add ([#741](https://github.com/smithery-ai/cli/issues/741)) ([6d70db3](https://github.com/smithery-ai/cli/commit/6d70db39ad20363fe81677d6f822b2b8379acca0))
* support for streamable HTTP transport ([#161](https://github.com/smithery-ai/cli/issues/161)) ([4394a11](https://github.com/smithery-ai/cli/commit/4394a1174a3701dcde1b0a3d60f64128ca1788a1))
* support input_required MCP connection flows ([#716](https://github.com/smithery-ai/cli/issues/716)) ([506bc3c](https://github.com/smithery-ai/cli/commit/506bc3c7819f4484bc2a87cdfad0dc46ed2dc2f4))
* support installing servers to vscode ([#96](https://github.com/smithery-ai/cli/issues/96)) ([89cd1f2](https://github.com/smithery-ai/cli/commit/89cd1f2a084d7a2d46d8d0dbb7b23c4cea1b271e))
* support uplink in mcp add ([#729](https://github.com/smithery-ai/cli/issues/729)) ([e9eab21](https://github.com/smithery-ai/cli/commit/e9eab21858f965d6dfd4b4f1fe557587d42d513c))
* surface tool annotations in tool list output ([#679](https://github.com/smithery-ai/cli/issues/679)) ([b949eb2](https://github.com/smithery-ai/cli/commit/b949eb2c46935b0ecc5c24586c9629ab2636da4e))
* unify error handling across ws and stdio connections ([#131](https://github.com/smithery-ai/cli/issues/131)) ([1e00778](https://github.com/smithery-ai/cli/commit/1e007786bf0ff102a0de246fdde093a28e4c4106))
* Update LibreChat Configuration Handling ([#331](https://github.com/smithery-ai/cli/issues/331)) ([7021a25](https://github.com/smithery-ai/cli/commit/7021a2573071cf64508cc1004e43846acb1924fe))
* use namespace import to prevent build fail ([#514](https://github.com/smithery-ai/cli/issues/514)) ([2059166](https://github.com/smithery-ai/cli/commit/20591668da210e32a911369189abd106adf7acf8))
* use smithery/sdk to access registry endpoints ([#213](https://github.com/smithery-ai/cli/issues/213)) ([489368b](https://github.com/smithery-ai/cli/commit/489368baff3924e1f31bd444990323b275d15ff8))


### Bug Fixes

* **/build.mjs:** fixes build failure on windows ([#375](https://github.com/smithery-ai/cli/issues/375)) ([ae5208a](https://github.com/smithery-ai/cli/commit/ae5208afd2e744e3d08c475b33cd559e9b7216ed))
* add CTA for permission denied errors ([#632](https://github.com/smithery-ai/cli/issues/632)) ([e18c52d](https://github.com/smithery-ai/cli/commit/e18c52d9606f9499ef457636add6f024ed80afe8))
* add explicit permissions for publish workflow OIDC ([a0962ec](https://github.com/smithery-ai/cli/commit/a0962ec5ab017d7017a6da17894ae017480eaa63))
* add id-token permission for npm publish OIDC ([#593](https://github.com/smithery-ai/cli/issues/593)) ([3f61a2d](https://github.com/smithery-ai/cli/commit/3f61a2d2281e5b40654363639a6098842b7dbb0b))
* add registry-url to setup-node for npm OIDC auth ([7855d98](https://github.com/smithery-ai/cli/commit/7855d9894279aef79caade19c2743c50a4cd6747))
* add workflow_dispatch to allow manual publish trigger ([bcc31c1](https://github.com/smithery-ai/cli/commit/bcc31c1d163535566ccbd285d6c44cfd73156d48))
* agent-friendly auth login for non-TTY environments (SMI-1627) ([#701](https://github.com/smithery-ai/cli/issues/701)) ([280917c](https://github.com/smithery-ai/cli/commit/280917c5bea8759ac0d8930654ddc584a5b296f0))
* agent-friendly publish, install, and search commands (SMI-1549, [#680](https://github.com/smithery-ai/cli/issues/680)) ([#704](https://github.com/smithery-ai/cli/issues/704)) ([4872b6c](https://github.com/smithery-ai/cli/commit/4872b6c51661076d0c31402d48d46297aa125876))
* allow '@' in server id during interactive install ([#498](https://github.com/smithery-ai/cli/issues/498)) ([9d97d29](https://github.com/smithery-ai/cli/commit/9d97d29293b129eb36e0c6f543870f21ba1cfb48))
* allow SDK client to work without API key ([#556](https://github.com/smithery-ai/cli/issues/556)) ([d883dbe](https://github.com/smithery-ai/cli/commit/d883dbe7a6f8b6b9326ea7e6d2d55eeb989388ea))
* analytics for stdio runner ([#509](https://github.com/smithery-ai/cli/issues/509)) ([1c0de04](https://github.com/smithery-ai/cli/commit/1c0de0421d673724c1c18657014b0c1461989e45))
* bypass ESM resolution cache in lazy import retry ([#655](https://github.com/smithery-ai/cli/issues/655)) ([27e3ac4](https://github.com/smithery-ai/cli/commit/27e3ac4759572b69eeff49950bac600d97451c17))
* collect configs when smithery api key is prompted ([#173](https://github.com/smithery-ai/cli/issues/173)) ([de6d248](https://github.com/smithery-ai/cli/commit/de6d248a498cb263f8789245d1846ea178aa1bb1))
* config schema and add tests ([#391](https://github.com/smithery-ai/cli/issues/391)) ([58835d2](https://github.com/smithery-ai/cli/commit/58835d2bc78c4d5eaee8eefb259beaac58699925))
* config validation and improve installation flow ([#422](https://github.com/smithery-ai/cli/issues/422)) ([e6cf76c](https://github.com/smithery-ai/cli/commit/e6cf76cdafda1a169602f8c6d9ec3003e3adddd4))
* connections for stdio servers ([#174](https://github.com/smithery-ai/cli/issues/174)) ([f6f76f3](https://github.com/smithery-ai/cli/commit/f6f76f35defd64eec542e5107d9c93acf2d2713b))
* **deps:** rm vulnerable dependencies ([8b49791](https://github.com/smithery-ai/cli/commit/8b497910baa8799b302ea75fcfaba0ef53b655bd))
* detect direct execution through symlinked bin ([#732](https://github.com/smithery-ai/cli/issues/732)) ([2cacbdf](https://github.com/smithery-ai/cli/commit/2cacbdfeb2ebaedf5cfa7ad2a38761cb835d880e))
* disable minification for shttp bundles to improve debuggability ([#685](https://github.com/smithery-ai/cli/issues/685)) ([64de162](https://github.com/smithery-ai/cli/commit/64de162f99549dc7c9087e41621f2bd31fbb42e2))
* don't pass mock values for optional fields ([#517](https://github.com/smithery-ai/cli/issues/517)) ([c11041a](https://github.com/smithery-ai/cli/commit/c11041afab21d1c9418c806c98b2ac16a18672f6))
* don't prompt to install keytar on logout (SMI-1615) ([#699](https://github.com/smithery-ai/cli/issues/699)) ([918ac0c](https://github.com/smithery-ai/cli/commit/918ac0ca6067f48276bf45a8c25f2566e673ea32))
* dynamic module imports when running miniflare ([#515](https://github.com/smithery-ai/cli/issues/515)) ([5d3cc2f](https://github.com/smithery-ai/cli/commit/5d3cc2f5e30f893437c131026e3b2135518c49fd))
* handle deletions for YAML configs using --uninstall ([#371](https://github.com/smithery-ai/cli/issues/371)) ([f22752e](https://github.com/smithery-ai/cli/commit/f22752edbc4743c078c2108c30baf9d8da18695c))
* handle no saved config ([0684f2c](https://github.com/smithery-ai/cli/commit/0684f2c36212b84c0d6269291ff9b89415e8ac3c))
* improve stdio error handling ([#135](https://github.com/smithery-ai/cli/issues/135)) ([64d23ef](https://github.com/smithery-ai/cli/commit/64d23ef822001a6837ad5bf13e80050069c0bf3b))
* Improve stdio-runner cleanup process ([#83](https://github.com/smithery-ai/cli/issues/83)) ([346870b](https://github.com/smithery-ai/cli/commit/346870b6c2554b3e364444010cce17ab47c3d50d))
* Improve ws-runner cleanup process ([#85](https://github.com/smithery-ai/cli/issues/85)) ([2a29ef0](https://github.com/smithery-ai/cli/commit/2a29ef0ece842d84e5a774e54090afc99d372fb5))
* Incorrect JSON escaping in run command example ([#185](https://github.com/smithery-ai/cli/issues/185)) ([904d473](https://github.com/smithery-ai/cli/commit/904d4730a03470507e4a3b4e78f35eaf36e39a39))
* initialize local HTTP MCP session before forwarding uplink frames ([#734](https://github.com/smithery-ai/cli/issues/734)) ([819a49e](https://github.com/smithery-ai/cli/commit/819a49ea2b6c5f01efdaf3e768483cc197f86ac8))
* inline npm publish into release-please workflow ([#599](https://github.com/smithery-ai/cli/issues/599)) ([d4c64ef](https://github.com/smithery-ai/cli/commit/d4c64ef25a1ca57d14c9ca718c471e2fe5f81761))
* keep skill required, only make agent optional ([#611](https://github.com/smithery-ai/cli/issues/611)) ([714b7f8](https://github.com/smithery-ai/cli/commit/714b7f896cfe5f96592f414a02b99645f83400a1))
* lint during build workflow ([04485c5](https://github.com/smithery-ai/cli/commit/04485c50cc5375c28d5a161ce4b5f67413aed4a1))
* list event topics without requiring MCP handshake ([#671](https://github.com/smithery-ai/cli/issues/671)) ([760bd8a](https://github.com/smithery-ai/cli/commit/760bd8adc3e1971864e062fd66977951d18732ca))
* make CLI auth organization aware ([#725](https://github.com/smithery-ai/cli/issues/725)) ([88f706b](https://github.com/smithery-ai/cli/commit/88f706b26687370df405224dd3baceca695968a9))
* make setup command non-interactive by default ([#640](https://github.com/smithery-ai/cli/issues/640)) ([7a92c51](https://github.com/smithery-ai/cli/commit/7a92c519c0b78554211788cef53e75edb8fc96ed))
* mcpb bundle builds ([#516](https://github.com/smithery-ai/cli/issues/516)) ([6ce2cb2](https://github.com/smithery-ai/cli/commit/6ce2cb2b9de1518b2039aeaf144ecf4a53504ce9))
* move OIDC permissions to workflow-level in publish.yml ([b9056f3](https://github.com/smithery-ai/cli/commit/b9056f3b3f58cdca3b3d1cad0daa28aaa1980d08))
* pnpm build failures by marking bootstrap dependencies as external  ([#487](https://github.com/smithery-ai/cli/issues/487)) ([28ee513](https://github.com/smithery-ai/cli/commit/28ee513a85b00fb75e583219b56f063c943d24fb))
* prevent platform mismatch in lazy dependency install ([#643](https://github.com/smithery-ai/cli/issues/643)) ([96ea3bf](https://github.com/smithery-ai/cli/commit/96ea3bf0b00d3258c03344da6d968f8dcce0416e))
* publish to npm in release-please workflow ([#565](https://github.com/smithery-ai/cli/issues/565)) ([94b3cdc](https://github.com/smithery-ai/cli/commit/94b3cdc0a7c401bd03003eff1ede550a4ee6cdf1))
* race conditions in tests (file read/write) ([25c0207](https://github.com/smithery-ai/cli/commit/25c0207df73e452f915cea59d9dc35ba2355adda))
* re-deploy patch version to avoid version conflict with 3.10 ([#576](https://github.com/smithery-ai/cli/issues/576)) ([ec52a05](https://github.com/smithery-ai/cli/commit/ec52a05fb876c4689f760762d4a3fe857e9b89f7))
* read SMITHERY_BASE_URL at runtime instead of bake-in at build ([#587](https://github.com/smithery-ai/cli/issues/587)) ([b618c33](https://github.com/smithery-ai/cli/commit/b618c33ad0fba917dd11a02d761d0318fe4ddf44))
* remove .npmrc that interferes with OIDC auth ([#555](https://github.com/smithery-ai/cli/issues/555)) ([87937a9](https://github.com/smithery-ai/cli/commit/87937a9f026c4ccdc233e01f3f008982aa866d4e))
* remove explicit biome linux binary from CI ([#645](https://github.com/smithery-ai/cli/issues/645)) ([51e872d](https://github.com/smithery-ai/cli/commit/51e872d1b67547d7c29f1dab65b89911c1075a18))
* remove oauth for cursor ([b882f1f](https://github.com/smithery-ai/cli/commit/b882f1f4c2892151cb220683bd51c4e32c7496fb))
* remove registry-url to allow OIDC auth ([#553](https://github.com/smithery-ai/cli/issues/553)) ([381aef2](https://github.com/smithery-ai/cli/commit/381aef2b2d0543503f9b0faebbcfdbafe8000171))
* remove unused --print-link option from login command ([#583](https://github.com/smithery-ai/cli/issues/583)) ([9a5b830](https://github.com/smithery-ai/cli/commit/9a5b830fcfc55e855c97a4c2e881c1beadb19753))
* require port specification when no command is provided in playground ([dd9a229](https://github.com/smithery-ai/cli/commit/dd9a229fcbdb77f9d41e866c3dfe02bfc5a303a5))
* resolve biome lint error and add pre-push hook ([#625](https://github.com/smithery-ai/cli/issues/625)) ([588ccf0](https://github.com/smithery-ai/cli/commit/588ccf09f6944eef37f1aa7a986dec9046d96707))
* restore whoami behavior, metadata filtering, and flat pagination ([#687](https://github.com/smithery-ai/cli/issues/687)) ([c9ed674](https://github.com/smithery-ai/cli/commit/c9ed674714941c8aba2b69efedd5352bd78c722c))
* run npx in windows through cmd /c ([#59](https://github.com/smithery-ai/cli/issues/59)) ([ae8badc](https://github.com/smithery-ai/cli/commit/ae8badcfc07e4673c26be79ff38ddea2b6e1ea81))
* search and inspect commands no longer require API key ([#545](https://github.com/smithery-ai/cli/issues/545)) ([b1ff329](https://github.com/smithery-ai/cli/commit/b1ff329ab9a27d297feb63008006fcb7c79941d3)), closes [#544](https://github.com/smithery-ai/cli/issues/544)
* show error message when tool list gets invalid connection name ([#681](https://github.com/smithery-ai/cli/issues/681)) ([50ecb00](https://github.com/smithery-ai/cli/commit/50ecb009c7f004eccf6e1a49bd6af22ef3d574f2))
* simplify uplink peer abstractions and stdio fix ([#738](https://github.com/smithery-ai/cli/issues/738)) ([0080086](https://github.com/smithery-ai/cli/commit/008008618d42b3dfd86b7c51eb3a076d71ab1746))
* simplify widget bundling ([#426](https://github.com/smithery-ai/cli/issues/426)) ([4288b4f](https://github.com/smithery-ai/cli/commit/4288b4ffb7541bd88e041d44887175d4e061fe13))
* **SMI-1470:** improve auth error messages for expired tokens ([#630](https://github.com/smithery-ai/cli/issues/630)) ([45c6fc8](https://github.com/smithery-ai/cli/commit/45c6fc8b1c3b2976fb9a979c1c566a9200f21dd8))
* start heartbeat only after connection established ([#168](https://github.com/smithery-ai/cli/issues/168)) ([2704fb6](https://github.com/smithery-ai/cli/commit/2704fb69159bb8ad508b5d5ee0ca164c3c63ebcf))
* temporarily remove test in workflow ([0d83ecb](https://github.com/smithery-ai/cli/commit/0d83ecbf09fa4547357bb70510265c1a33650829))
* tests during github workflow ([a47b07f](https://github.com/smithery-ai/cli/commit/a47b07fbe5c17b3a86baf65c4c8d868f4919ae1b))
* update skills commands for @smithery/api 0.38.0 ([#585](https://github.com/smithery-ai/cli/issues/585)) ([a049fa0](https://github.com/smithery-ai/cli/commit/a049fa01b803cf026830017691fd807ef8433f20))
* use --save-prod for lazy install to prevent silent no-op ([#658](https://github.com/smithery-ai/cli/issues/658)) ([f4c6614](https://github.com/smithery-ai/cli/commit/f4c6614b03066334e1ca71d1d5e07525d724e344))
* use async exec for lazy install so spinner animates ([#660](https://github.com/smithery-ai/cli/issues/660)) ([82617d4](https://github.com/smithery-ai/cli/commit/82617d4d1984f5555e9c9fa0cd7783d46d3fa7f1))
* use GitHub App token for release-please to trigger CI ([#592](https://github.com/smithery-ai/cli/issues/592)) ([832fe51](https://github.com/smithery-ai/cli/commit/832fe512a36e8251cd8e17ff0a98b0881839cb99))
* use MCP client for listing tools instead of raw HTTP; ref SMI-1260 ([#563](https://github.com/smithery-ai/cli/issues/563)) ([79cb44d](https://github.com/smithery-ai/cli/commit/79cb44d9d66a3fdd01aef827c54a6072d5ab3145))
* use Node 24 for npm OIDC publishing support ([7d7b4e2](https://github.com/smithery-ai/cli/commit/7d7b4e2b80f68c348cefce2c9dbcdf509aa9b7ab))
* use npm OIDC for tokenless publishing ([#552](https://github.com/smithery-ai/cli/issues/552)) ([714ce60](https://github.com/smithery-ai/cli/commit/714ce6002a629011a492be4a959ca0fdf19fb624))
* use pnpm publish with local npm for OIDC auth ([#554](https://github.com/smithery-ai/cli/issues/554)) ([7b7aafd](https://github.com/smithery-ai/cli/commit/7b7aafd5cb2936866cd63928ead6d7c1a142497f))
* use setupUrl in connect flows ([#721](https://github.com/smithery-ai/cli/issues/721)) ([b42c771](https://github.com/smithery-ai/cli/commit/b42c77155c8866d2890cfabf3fd4605bc5bf1845))
* use stderr for postinstall message to bypass npm suppression ([df5f6c4](https://github.com/smithery-ai/cli/commit/df5f6c450e7bb2938d0726894907adbf386e17e2))
* warn on auth-required connections instead of silently failing ([#673](https://github.com/smithery-ai/cli/issues/673)) ([4fe8a8c](https://github.com/smithery-ai/cli/commit/4fe8a8cd53427527179a2fb869d8a63c1cd86936))
* widget bundling ([#427](https://github.com/smithery-ai/cli/issues/427)) ([067c3aa](https://github.com/smithery-ai/cli/commit/067c3aae2ea8473909fa0290f9876ac1d9cc0897))
* windows cmd json parsing error ([#99](https://github.com/smithery-ai/cli/issues/99)) ([e2f3dcf](https://github.com/smithery-ai/cli/commit/e2f3dcf119a26ba454ec267dea2f0b26104a03e4))


### Performance Improvements

* lazy load command implementations to improve CLI startup ([#560](https://github.com/smithery-ai/cli/issues/560)) ([1f4a0e4](https://github.com/smithery-ai/cli/commit/1f4a0e49a4c665d360cd2e03d4887bf3f359f072))
* lazy-install keytar to eliminate native build ([#638](https://github.com/smithery-ai/cli/issues/638)) ([3e445ef](https://github.com/smithery-ai/cli/commit/3e445efdab5a9b587c88eacbabbc53280d66cef7))
* optimize CLI startup, install size, and deps [SMI-1535] ([#637](https://github.com/smithery-ai/cli/issues/637)) ([4a333dc](https://github.com/smithery-ai/cli/commit/4a333dc6c6b0e0ff4ae65858b94a1db4459e6965))
* zero runtime dependencies ([#646](https://github.com/smithery-ai/cli/issues/646)) ([9d0a636](https://github.com/smithery-ai/cli/commit/9d0a6365052ebe145f112beb949aad50ebaf0477))


### Reverts

* remove bootstrap externals approach, use pnpm hoisting instead ([#488](https://github.com/smithery-ai/cli/issues/488)) ([ac19ece](https://github.com/smithery-ai/cli/commit/ac19ece2a4c639ca271f68aecff76a546d499613))


### Documentation

* add value prop about connecting agents to Smithery registry ([#591](https://github.com/smithery-ai/cli/issues/591)) ([090f299](https://github.com/smithery-ai/cli/commit/090f299916a1045d3f45e678f7432d38d0a4596a))
* improve README clarity and accuracy ([#590](https://github.com/smithery-ai/cli/issues/590)) ([d41e65c](https://github.com/smithery-ai/cli/commit/d41e65cf6fc81d2a65d99de38d97c6f28b1f46da))


### Chores

* add direct uplink pairing ([#745](https://github.com/smithery-ai/cli/issues/745)) ([58a60e3](https://github.com/smithery-ai/cli/commit/58a60e341431923fa7ad1d6e17d9aa1e854dc94d))
* add hidden mcp secrets subcommands ([#650](https://github.com/smithery-ai/cli/issues/650)) ([35c9b0a](https://github.com/smithery-ai/cli/commit/35c9b0aa82549e4d642f983539ddd875a2b215fa))
* add mcp ls alias ([#730](https://github.com/smithery-ai/cli/issues/730)) ([806061b](https://github.com/smithery-ai/cli/commit/806061b8d3ad4cac9b75f403d23e47be66ad6486))
* add repo link to package.json ([#163](https://github.com/smithery-ai/cli/issues/163)) ([b634145](https://github.com/smithery-ai/cli/commit/b634145737464af89e59fc386226c4708f77f156))
* bump @smithery/sdk from 1.4.3 to 1.5.2 ([5e28147](https://github.com/smithery-ai/cli/commit/5e28147208b9bfbc6ebabb58fa3d6b715056ea93))
* bump version to 1.1.34 [skip ci] ([009eeff](https://github.com/smithery-ai/cli/commit/009eeff79cf5db545a747f35bf2c4b46e3f16bed))
* bump version to 1.1.35 [skip ci] ([42a3719](https://github.com/smithery-ai/cli/commit/42a37198d44d8ac207913862f67ad4c2da65e4b2))
* bump version to 1.1.36 [skip ci] ([cbe2e6c](https://github.com/smithery-ai/cli/commit/cbe2e6c3512428374a5c6b0fdfbef1309140721f))
* bump version to 1.1.37 [skip ci] ([6bfb0f1](https://github.com/smithery-ai/cli/commit/6bfb0f136089d1d3b1ac9ed0014a9a76b25d978b))
* bump version to 1.1.38 [skip ci] ([27dab9f](https://github.com/smithery-ai/cli/commit/27dab9fc03dbe2e855635aefc80cd9afd595c55e))
* bump version to 1.1.39 [skip ci] ([074c9d8](https://github.com/smithery-ai/cli/commit/074c9d81b5c40486d817e48a6a71fd0f2b1db2e8))
* bump version to 1.1.40 [skip ci] ([8e0c2de](https://github.com/smithery-ai/cli/commit/8e0c2de0c992216cc68f081b6f26fb937ddd270f))
* bump version to 1.1.41 [skip ci] ([f92db41](https://github.com/smithery-ai/cli/commit/f92db416979ef09638992a3f83255a7f91805229))
* bump version to 1.1.42 [skip ci] ([351c7e9](https://github.com/smithery-ai/cli/commit/351c7e98c11c98daf6305db2220434149c0b3cd5))
* bump version to 1.1.43 [skip ci] ([5fd6681](https://github.com/smithery-ai/cli/commit/5fd66817aca5062786f3a70ff9223a9c4b127c18))
* bump version to 1.1.44 [skip ci] ([1e18419](https://github.com/smithery-ai/cli/commit/1e18419a87f95321ce22181ec5e96cea2fa33c23))
* bump version to 1.1.45 [skip ci] ([fd6b40c](https://github.com/smithery-ai/cli/commit/fd6b40c8658af4a2248c9e6b8ec4a4c5b02ec163))
* bump version to 1.1.46 [skip ci] ([6edba26](https://github.com/smithery-ai/cli/commit/6edba269828a597acd5b7dff7d4a886dd43b7757))
* bump version to 1.1.47 [skip ci] ([e3e4d69](https://github.com/smithery-ai/cli/commit/e3e4d69bbdbbf75a5217e72d2fb9049cffa371b9))
* bump version to 1.1.48 [skip ci] ([faff898](https://github.com/smithery-ai/cli/commit/faff89873798062c17f30d6d7cf60cc6e92c4c76))
* bump version to 1.1.49 [skip ci] ([607a532](https://github.com/smithery-ai/cli/commit/607a532dfe98c1dbb4ff95c321c93eaa57a01c7f))
* bump version to 1.1.50 [skip ci] ([8f59c61](https://github.com/smithery-ai/cli/commit/8f59c61b183183caa800358a18c966ed579f9e18))
* bump version to 1.1.51 [skip ci] ([c2fb52b](https://github.com/smithery-ai/cli/commit/c2fb52b9956d6a934d8b4dd0c9c38b1b3be776b2))
* bump version to 1.1.52 [skip ci] ([3a33252](https://github.com/smithery-ai/cli/commit/3a332524ba6a3e63c1179597398b6a883feba3b2))
* bump version to 1.1.53 [skip ci] ([8d8b17f](https://github.com/smithery-ai/cli/commit/8d8b17f6bb26102955aa9f1efbb8b373579315ba))
* bump version to 1.1.54 [skip ci] ([8c1687e](https://github.com/smithery-ai/cli/commit/8c1687ee42c422bbf3a7fc045fe07d3dc3bbe7a9))
* bump version to 1.1.55 [skip ci] ([b34baf7](https://github.com/smithery-ai/cli/commit/b34baf7192bdba94fa846a818b35b85329fef037))
* bump version to 1.1.56 [skip ci] ([b15b36f](https://github.com/smithery-ai/cli/commit/b15b36f5f2e669a60bc1425c1876d104ca53ed3a))
* bump version to 1.1.57 [skip ci] ([c91603f](https://github.com/smithery-ai/cli/commit/c91603f0f26c45b3f77f3bbf14f9d37e1141b4cc))
* bump version to 1.1.58 [skip ci] ([c82dd7e](https://github.com/smithery-ai/cli/commit/c82dd7efc2dd911e726714a1ff2e7b2d3d422040))
* bump version to 1.1.59 [skip ci] ([832f3b0](https://github.com/smithery-ai/cli/commit/832f3b063c65cec844cb4021e758a9a356bfb751))
* bump version to 1.1.60 [skip ci] ([1555898](https://github.com/smithery-ai/cli/commit/155589856f755a8448690bcbaa0e2c0897105860))
* bump version to 1.1.61 [skip ci] ([d08dbb3](https://github.com/smithery-ai/cli/commit/d08dbb3051aa02943fb1566b57e1da9749c1e9ce))
* bump version to 1.1.62 [skip ci] ([b331c93](https://github.com/smithery-ai/cli/commit/b331c93b337805ce29de990a48357de7ebbb4eb4))
* bump version to 1.1.63 [skip ci] ([537b9c4](https://github.com/smithery-ai/cli/commit/537b9c44dac70e1c34b25f43f372ccb10fbd2b27))
* bump version to 1.1.64 [skip ci] ([c6ca5d7](https://github.com/smithery-ai/cli/commit/c6ca5d7282a6f7d9175aa17c1cb95002b88daebb))
* bump version to 1.1.65 [skip ci] ([c8b857a](https://github.com/smithery-ai/cli/commit/c8b857a8f4b1dd2d228945aaac076ccfe8d489e7))
* bump version to 1.1.66 [skip ci] ([d543f2c](https://github.com/smithery-ai/cli/commit/d543f2ccf0a2abf2adf0d83fb913ca747092516b))
* bump version to 1.1.67 [skip ci] ([1d09475](https://github.com/smithery-ai/cli/commit/1d09475c474903a72ee35a29cdeb12ffc58b6ae2))
* bump version to 1.1.68 [skip ci] ([b6d9dc5](https://github.com/smithery-ai/cli/commit/b6d9dc5c4af53ac4136c483009223b57140f1d9c))
* bump version to 1.1.69 [skip ci] ([cef10de](https://github.com/smithery-ai/cli/commit/cef10dee50f8545356dd0f1f52d1582ba6ff8145))
* bump version to 1.1.70 [skip ci] ([56ae031](https://github.com/smithery-ai/cli/commit/56ae031956c6366575f829a84cc204b49c66902b))
* bump version to 1.1.71 [skip ci] ([06a560d](https://github.com/smithery-ai/cli/commit/06a560df966256fc6a396d04949b073622878451))
* bump version to 1.1.72 [skip ci] ([57c52e2](https://github.com/smithery-ai/cli/commit/57c52e2ad915ab9e50a33add44b40eacba83bb5c))
* bump version to 1.1.73 [skip ci] ([3e66ec5](https://github.com/smithery-ai/cli/commit/3e66ec5ad9b6c607ecd6210f468aff4cc6992f4e))
* bump version to 1.1.74 [skip ci] ([f2bcfcf](https://github.com/smithery-ai/cli/commit/f2bcfcf7d0c37519a093a749c4f5cebe321649fb))
* bump version to 1.1.75 [skip ci] ([0f11c05](https://github.com/smithery-ai/cli/commit/0f11c05e923674bede69c4c40dac79583238a24f))
* bump version to 1.1.76 [skip ci] ([473a177](https://github.com/smithery-ai/cli/commit/473a1777b45640be59ef2da6deb895b27a73dcf0))
* bump version to 1.1.77 [skip ci] ([08675b1](https://github.com/smithery-ai/cli/commit/08675b1ddffadb1ab028edc454f2eeaa5680079d))
* bump version to 1.1.78 [skip ci] ([5208909](https://github.com/smithery-ai/cli/commit/5208909018fcaee2d45bcbdb2270d7f7868d41bb))
* bump version to 1.1.79 [skip ci] ([c5b34cf](https://github.com/smithery-ai/cli/commit/c5b34cfa0cdc149701e9a687843ad31d5f516818))
* bump version to 1.1.80 [skip ci] ([fc9c1c0](https://github.com/smithery-ai/cli/commit/fc9c1c0fcd25797156f0f7da68db332a217914ad))
* bump version to 1.1.81 [skip ci] ([ae42335](https://github.com/smithery-ai/cli/commit/ae42335224e6777cc7179ce00a9580eedc21242d))
* bump version to 1.1.82 [skip ci] ([c6c2998](https://github.com/smithery-ai/cli/commit/c6c29984b4f199c1abd5ef2c239bde468a62d57a))
* bump version to 1.1.83 [skip ci] ([2ee0157](https://github.com/smithery-ai/cli/commit/2ee01575f229361fa7c41c2d526135af55c63539))
* bump version to 1.1.84 [skip ci] ([151f1c1](https://github.com/smithery-ai/cli/commit/151f1c11971fed5b71660f78ed98c0ff63fe0c98))
* bump version to 1.1.85 [skip ci] ([ff7e19d](https://github.com/smithery-ai/cli/commit/ff7e19dcdab0fac79869197e246b58d44fff0539))
* bump version to 1.1.86 [skip ci] ([4189904](https://github.com/smithery-ai/cli/commit/41899045d1c576dc471f6f4204cbbaa1a812ddbc))
* bump version to 1.1.87 [skip ci] ([10c8e10](https://github.com/smithery-ai/cli/commit/10c8e10a94a6c5984aa8e910d78faea649425824))
* bump version to 1.1.88 [skip ci] ([254e4fd](https://github.com/smithery-ai/cli/commit/254e4fd883b39a0e9d17894396e24a51bdca283b))
* bump version to 1.1.89 [skip ci] ([029ef73](https://github.com/smithery-ai/cli/commit/029ef736d11f026b464efb4b29093063d66f95a7))
* bump version to 1.2.1 [skip ci] ([6a7261b](https://github.com/smithery-ai/cli/commit/6a7261badd6be788e5d9f42f9bc15a512c06cc20))
* bump version to 1.2.10 [skip ci] ([a9cf666](https://github.com/smithery-ai/cli/commit/a9cf66663afdfed26e340449ee64a7a2a2f70e7e))
* bump version to 1.2.11 [skip ci] ([d5f53d9](https://github.com/smithery-ai/cli/commit/d5f53d9f601ddfc90ab0e11a0b0ce10331aa7385))
* bump version to 1.2.12 [skip ci] ([f099421](https://github.com/smithery-ai/cli/commit/f099421e485de1ff2fa175d90b92a86a13caae03))
* bump version to 1.2.13 [skip ci] ([009d3cd](https://github.com/smithery-ai/cli/commit/009d3cd92f19bb91b71cc33af0bff7c3ffa16732))
* bump version to 1.2.14 [skip ci] ([1f292a4](https://github.com/smithery-ai/cli/commit/1f292a4deda4c76a7975d3747f76c1157a4f81a1))
* bump version to 1.2.15 [skip ci] ([01d20bc](https://github.com/smithery-ai/cli/commit/01d20bc32946d46ad844e10488d4c4f114184136))
* bump version to 1.2.16 [skip ci] ([5427b6e](https://github.com/smithery-ai/cli/commit/5427b6ea238d47efbfda77f4fb471fd66534bade))
* bump version to 1.2.17 [skip ci] ([e3e7bc4](https://github.com/smithery-ai/cli/commit/e3e7bc4095e4c6e404683d20241db9d9065f07bf))
* bump version to 1.2.18 [skip ci] ([7646a71](https://github.com/smithery-ai/cli/commit/7646a7165fef4b3a4bd2ca657c675c6a87ee4005))
* bump version to 1.2.19 [skip ci] ([bc653e1](https://github.com/smithery-ai/cli/commit/bc653e1a56a0f7ab88c194191515356fbcc3eef2))
* bump version to 1.2.2 [skip ci] ([fa878de](https://github.com/smithery-ai/cli/commit/fa878de8a1bb7cc44fc0ac05a38a1e1c1e850934))
* bump version to 1.2.20 [skip ci] ([a9a19d9](https://github.com/smithery-ai/cli/commit/a9a19d9300d52c5757d421ecd068824082c505df))
* bump version to 1.2.21 [skip ci] ([53c1f52](https://github.com/smithery-ai/cli/commit/53c1f521a483bde4cb24f629f737922bb98ca286))
* bump version to 1.2.22 [skip ci] ([e5faefd](https://github.com/smithery-ai/cli/commit/e5faefdc0b4cfa9c6dbde262ebd816abfb7a644e))
* bump version to 1.2.23 [skip ci] ([980ffe5](https://github.com/smithery-ai/cli/commit/980ffe51b04974fe476f758317519118a62eccfb))
* bump version to 1.2.24 [skip ci] ([ce10093](https://github.com/smithery-ai/cli/commit/ce100939f5c755b20bcebef369672196725e925b))
* bump version to 1.2.25 [skip ci] ([d483bcc](https://github.com/smithery-ai/cli/commit/d483bcc663637c95826ade2b3033d37ae4266e3b))
* bump version to 1.2.26 [skip ci] ([76c7a58](https://github.com/smithery-ai/cli/commit/76c7a58526291258195e19e4e6b7ab577f1e01dd))
* bump version to 1.2.27 [skip ci] ([b52c7bd](https://github.com/smithery-ai/cli/commit/b52c7bd24946ec1a938dd5ed0da48f536a2cd77a))
* bump version to 1.2.28 [skip ci] ([86dc648](https://github.com/smithery-ai/cli/commit/86dc6481e32b6bf14d61c8be685a3f5037641423))
* bump version to 1.2.29 [skip ci] ([f8d6d8b](https://github.com/smithery-ai/cli/commit/f8d6d8b554f8c4158b04cfee4dd43154b7e89492))
* bump version to 1.2.3 [skip ci] ([d853c28](https://github.com/smithery-ai/cli/commit/d853c28492045e1de5128c81492a029f0fb57103))
* bump version to 1.2.30 [skip ci] ([b8a1693](https://github.com/smithery-ai/cli/commit/b8a1693696582d0777865c1c30f252e7463cc99d))
* bump version to 1.2.31 [skip ci] ([61238df](https://github.com/smithery-ai/cli/commit/61238dff145806171dfe94a3f0be46eecdfeb2e9))
* bump version to 1.2.4 [skip ci] ([b6471b2](https://github.com/smithery-ai/cli/commit/b6471b2c1cb3283d3bf05c7eeff3599090e2f234))
* bump version to 1.2.5 [skip ci] ([3854286](https://github.com/smithery-ai/cli/commit/38542860ed3ce42143d0b858a015e0be4b6a250a))
* bump version to 1.2.6 [skip ci] ([6a75b59](https://github.com/smithery-ai/cli/commit/6a75b5960abaa1505f1d880a3fd7909dcb1a4085))
* bump version to 1.2.7 [skip ci] ([1182530](https://github.com/smithery-ai/cli/commit/1182530224f3c36dcc05469e70e85273fa57eaf7))
* bump version to 1.2.8 [skip ci] ([214de4a](https://github.com/smithery-ai/cli/commit/214de4a41d27aa0158b8d2c24a37641d003eaa15))
* bump version to 1.2.9 [skip ci] ([e1481a6](https://github.com/smithery-ai/cli/commit/e1481a6927afbf1789c8f5e93c3735c7cdfa8344))
* clean up CLI and add tests ([#497](https://github.com/smithery-ai/cli/issues/497)) ([2084f6b](https://github.com/smithery-ai/cli/commit/2084f6b736fafa5cdded9ce3dddccdc55cbb5587))
* fix lints and improve typing ([#506](https://github.com/smithery-ai/cli/issues/506)) ([e30a054](https://github.com/smithery-ai/cli/commit/e30a05437eacebd69414ac6f796a130ade15ce80))
* **fix:** outdated lockfile ([5bd4636](https://github.com/smithery-ai/cli/commit/5bd4636cea4993f0f948aabbb68d7c7e9d76d8d4))
* hide homepage command from public help ([#752](https://github.com/smithery-ai/cli/issues/752)) ([251cadb](https://github.com/smithery-ai/cli/commit/251cadbcc80b583e97b349f8b399cf3f84e46292))
* ignore macOS AppleDouble files (._*) ([#627](https://github.com/smithery-ai/cli/issues/627)) ([7bb82c6](https://github.com/smithery-ai/cli/commit/7bb82c61f21fb46f5891feb16c880e6d590a9a1c))
* major version bump ([cf863b6](https://github.com/smithery-ai/cli/commit/cf863b60170958979eae93ab48eca6ae7f25c894))
* pin first release to 1.0.0 ([683a982](https://github.com/smithery-ai/cli/commit/683a982316cbd473c80937a3879c27db7a053e7a))
* remove review, upvote, downvote commands (SMI-1505) ([#706](https://github.com/smithery-ai/cli/issues/706)) ([36e7882](https://github.com/smithery-ai/cli/commit/36e78827a7821965375a0f02890174a7b003c1f9))
* rename npm package to smithery (1.0.0) ([#749](https://github.com/smithery-ai/cli/issues/749)) ([1aa4e5f](https://github.com/smithery-ai/cli/commit/1aa4e5fc4a0e560b89ecd570cbe5aae7cc8cdb1f))
* **SMI-1539:** add event command for MCP event subscriptions ([#652](https://github.com/smithery-ai/cli/issues/652)) ([6da0b63](https://github.com/smithery-ai/cli/commit/6da0b639d8f225f5c76eae86aaa3e0b9c0b2a72a))
* **SMI-1540:** scan event topics during publish ([#654](https://github.com/smithery-ai/cli/issues/654)) ([54b8ef0](https://github.com/smithery-ai/cli/commit/54b8ef0675b429e99fc3910e3f5d2087fe634809))
* **SMI-1552:** add events poll command and update SDK to 0.52.0 ([#670](https://github.com/smithery-ai/cli/issues/670)) ([cfe076d](https://github.com/smithery-ai/cli/commit/cfe076d84c54ea51d2c4d90a22668c41fd1aa557))
* **SMI-1567:** add prefix filtering to tool list and event topics ([#678](https://github.com/smithery-ai/cli/issues/678)) ([cdb28e8](https://github.com/smithery-ai/cli/commit/cdb28e88b5c5e1f74fb12613b485615ba6a6ee80))
* support deprecated playground related commands with notice ([#504](https://github.com/smithery-ai/cli/issues/504)) ([822aea4](https://github.com/smithery-ai/cli/commit/822aea459b6fd703124aa9cb967789e7913cfb0f))
* trigger release-please workflow ([cfa5be4](https://github.com/smithery-ai/cli/commit/cfa5be42421543df1ca821e739e9141a58dce612))
* update @smithery/api to 0.58.0 ([#717](https://github.com/smithery-ai/cli/issues/717)) ([b714a86](https://github.com/smithery-ai/cli/commit/b714a863476c231c15501c33ec8b3b3e773c4a9a))
* update biome ([#379](https://github.com/smithery-ai/cli/issues/379)) ([7a6912b](https://github.com/smithery-ai/cli/commit/7a6912b8abd6969c7b58337a9a5ee3ba0b4c747c))
* update biome schema version ([fd6532e](https://github.com/smithery-ai/cli/commit/fd6532e02e8e113ee7b37ecb46ca3c5ba5b6af70))
* update dependencies ([b14de9a](https://github.com/smithery-ai/cli/commit/b14de9a850e12d4d2600700b1e6022331543f5a4))
* update dependencies (zod4, mcp sdk); migrate to pnpm ([#494](https://github.com/smithery-ai/cli/issues/494)) ([7fc8a02](https://github.com/smithery-ai/cli/commit/7fc8a029a16ca0ea05b060b3850ddd87f23e3473))
* update dependencies, publish workflow, add agent guides ([96cb582](https://github.com/smithery-ai/cli/commit/96cb582a5f84e9f4f1abe9abca4d301ab0b273f6))
* update dev bootstrap for SDK v4.1.0 ([#676](https://github.com/smithery-ai/cli/issues/676)) ([7a105de](https://github.com/smithery-ai/cli/commit/7a105de0d0a9fb315dd4f36f5155b4f37dd13a3a))
* update pnpm version and allow build scripts ([#511](https://github.com/smithery-ai/cli/issues/511)) ([1d945d5](https://github.com/smithery-ai/cli/commit/1d945d516baf1a43de29780097568dddd9db2d5e))
* update to latest smithery api ([#525](https://github.com/smithery-ai/cli/issues/525)) ([12ba82f](https://github.com/smithery-ai/cli/commit/12ba82fbb9e2688eb983ebfff2c86db663c184cd))
* use positional args for secret set command ([#665](https://github.com/smithery-ai/cli/issues/665)) ([79c310e](https://github.com/smithery-ai/cli/commit/79c310e0a878d0bf82a873459ca79f7692e1d3f2))
* use smithery.run REST API ([#739](https://github.com/smithery-ai/cli/issues/739)) ([965c84e](https://github.com/smithery-ai/cli/commit/965c84e1ffed1f1472c63d12fae05a2ffe7ad52b))
* verify release-please workflow ([0b1c416](https://github.com/smithery-ai/cli/commit/0b1c416674a0df5a65c7cea6814b97459717ea9c))


### Refactors

* **auth:** remove whoami token mint/server flow ([#686](https://github.com/smithery-ai/cli/issues/686)) ([b8a9805](https://github.com/smithery-ai/cli/commit/b8a980564aec8c2464baab17cfa14deb9aa6ebd6))
* clean up index file ([#377](https://github.com/smithery-ai/cli/issues/377)) ([87c94f9](https://github.com/smithery-ai/cli/commit/87c94f995eb1eb6fd7ea532439b44d81741cbd5a))
* extract MCP connection output helper ([#718](https://github.com/smithery-ai/cli/issues/718)) ([1bbc5bd](https://github.com/smithery-ai/cli/commit/1bbc5bd566a01719e219cf7baaedc5af96b987dc))
* improve config validation, process clean up ([#149](https://github.com/smithery-ai/cli/issues/149)) ([96b2de1](https://github.com/smithery-ai/cli/commit/96b2de1ddd524c593ec8becc1d7ecc89f9850362))
* improve Smithery skill metadata; ref SMI-1404 ([#614](https://github.com/smithery-ai/cli/issues/614)) ([f36b4ba](https://github.com/smithery-ai/cli/commit/f36b4ba794e1b6df73de59a46d378eb6f5e9da14))
* remove automation commands feature ([#698](https://github.com/smithery-ai/cli/issues/698)) ([5413f9b](https://github.com/smithery-ai/cli/commit/5413f9b51f64ff175c2c7474abdf5cd680b2f744))
* rename "deployment" to "release" in CLI output ([#624](https://github.com/smithery-ai/cli/issues/624)) ([a3da821](https://github.com/smithery-ai/cli/commit/a3da821aef815efa14abbbc2f06c139b5d450265))
* rename roo-code to roocode ([#145](https://github.com/smithery-ai/cli/issues/145)) ([178efd5](https://github.com/smithery-ai/cli/commit/178efd5573a8ca14aba1589aa17f64c1410938ea))
* replace jsonc-parser with bundlable comment-json ([#648](https://github.com/smithery-ai/cli/issues/648)) ([2877d18](https://github.com/smithery-ai/cli/commit/2877d1801ab7d8a520e70869331935a632de6e52))
* simplify client config architecture + JSONC support ([#541](https://github.com/smithery-ai/cli/issues/541)) ([8001792](https://github.com/smithery-ai/cli/commit/80017927d6c324434942368a8325e09346af7f30))
* use @smithery/api client for skills reviews ([#570](https://github.com/smithery-ai/cli/issues/570)) ([38957aa](https://github.com/smithery-ai/cli/commit/38957aa44b38e6c62390ffbc8c1aa25540e80bb1))

## [4.11.1](https://github.com/smithery-ai/cli/compare/v4.11.0...v4.11.1) (2026-04-30)


### Chores

* add direct uplink pairing ([#745](https://github.com/smithery-ai/cli/issues/745)) ([58a60e3](https://github.com/smithery-ai/cli/commit/58a60e341431923fa7ad1d6e17d9aa1e854dc94d))

## [4.11.0](https://github.com/smithery-ai/cli/compare/v4.10.0...v4.11.0) (2026-04-28)


### Features

* Poll mcp add auth setup flow ([#743](https://github.com/smithery-ai/cli/issues/743)) ([0af019d](https://github.com/smithery-ai/cli/commit/0af019db41573b8a6871097b7b67057850fdd448))

## [4.10.0](https://github.com/smithery-ai/cli/compare/v4.9.3...v4.10.0) (2026-04-25)


### Features

* **SMI-1823:** add trigger CLI commands ([#736](https://github.com/smithery-ai/cli/issues/736)) ([1368e3f](https://github.com/smithery-ai/cli/commit/1368e3fa48661ee470ec83e16761eec3638408ae))
* **SMI-1839:** download and run MCPB bundles via uplink on mcp add ([#741](https://github.com/smithery-ai/cli/issues/741)) ([6d70db3](https://github.com/smithery-ai/cli/commit/6d70db39ad20363fe81677d6f822b2b8379acca0))


### Bug Fixes

* simplify uplink peer abstractions and stdio fix ([#738](https://github.com/smithery-ai/cli/issues/738)) ([0080086](https://github.com/smithery-ai/cli/commit/008008618d42b3dfd86b7c51eb3a076d71ab1746))


### Chores

* use smithery.run REST API ([#739](https://github.com/smithery-ai/cli/issues/739)) ([965c84e](https://github.com/smithery-ai/cli/commit/965c84e1ffed1f1472c63d12fae05a2ffe7ad52b))

## [4.9.3](https://github.com/smithery-ai/cli/compare/v4.9.2...v4.9.3) (2026-04-24)


### Bug Fixes

* initialize local HTTP MCP session before forwarding uplink frames ([#734](https://github.com/smithery-ai/cli/issues/734)) ([819a49e](https://github.com/smithery-ai/cli/commit/819a49ea2b6c5f01efdaf3e768483cc197f86ac8))

## [4.9.2](https://github.com/smithery-ai/cli/compare/v4.9.1...v4.9.2) (2026-04-24)


### Bug Fixes

* detect direct execution through symlinked bin ([#732](https://github.com/smithery-ai/cli/issues/732)) ([2cacbdf](https://github.com/smithery-ai/cli/commit/2cacbdfeb2ebaedf5cfa7ad2a38761cb835d880e))

## [4.9.1](https://github.com/smithery-ai/cli/compare/v4.9.0...v4.9.1) (2026-04-24)


### Chores

* add mcp ls alias ([#730](https://github.com/smithery-ai/cli/issues/730)) ([806061b](https://github.com/smithery-ai/cli/commit/806061b8d3ad4cac9b75f403d23e47be66ad6486))

## [4.9.0](https://github.com/smithery-ai/cli/compare/v4.8.2...v4.9.0) (2026-04-24)


### Features

* remove mcp dev command ([#727](https://github.com/smithery-ai/cli/issues/727)) ([980f994](https://github.com/smithery-ai/cli/commit/980f9943c512a88f64a3bf04fba0ef5de4f3515e))
* support uplink in mcp add ([#729](https://github.com/smithery-ai/cli/issues/729)) ([e9eab21](https://github.com/smithery-ai/cli/commit/e9eab21858f965d6dfd4b4f1fe557587d42d513c))

## [4.8.2](https://github.com/smithery-ai/cli/compare/v4.8.1...v4.8.2) (2026-04-23)


### Bug Fixes

* make CLI auth organization aware ([#725](https://github.com/smithery-ai/cli/issues/725)) ([88f706b](https://github.com/smithery-ai/cli/commit/88f706b26687370df405224dd3baceca695968a9))

## [4.8.1](https://github.com/smithery-ai/cli/compare/v4.8.0...v4.8.1) (2026-04-16)


### Bug Fixes

* use setupUrl in connect flows ([#721](https://github.com/smithery-ai/cli/issues/721)) ([b42c771](https://github.com/smithery-ai/cli/commit/b42c77155c8866d2890cfabf3fd4605bc5bf1845))

## [4.8.0](https://github.com/smithery-ai/cli/compare/v4.7.4...v4.8.0) (2026-04-12)


### Features

* support input_required MCP connection flows ([#716](https://github.com/smithery-ai/cli/issues/716)) ([506bc3c](https://github.com/smithery-ai/cli/commit/506bc3c7819f4484bc2a87cdfad0dc46ed2dc2f4))


### Chores

* update @smithery/api to 0.58.0 ([#717](https://github.com/smithery-ai/cli/issues/717)) ([b714a86](https://github.com/smithery-ai/cli/commit/b714a863476c231c15501c33ec8b3b3e773c4a9a))


### Refactors

* extract MCP connection output helper ([#718](https://github.com/smithery-ai/cli/issues/718)) ([1bbc5bd](https://github.com/smithery-ai/cli/commit/1bbc5bd566a01719e219cf7baaedc5af96b987dc))

## [4.7.4](https://github.com/smithery-ai/cli/compare/v4.7.3...v4.7.4) (2026-03-18)


### Chores

* remove review, upvote, downvote commands (SMI-1505) ([#706](https://github.com/smithery-ai/cli/issues/706)) ([36e7882](https://github.com/smithery-ai/cli/commit/36e78827a7821965375a0f02890174a7b003c1f9))

## [4.7.3](https://github.com/smithery-ai/cli/compare/v4.7.2...v4.7.3) (2026-03-18)


### Bug Fixes

* agent-friendly publish, install, and search commands (SMI-1549, [#680](https://github.com/smithery-ai/cli/issues/680)) ([#704](https://github.com/smithery-ai/cli/issues/704)) ([4872b6c](https://github.com/smithery-ai/cli/commit/4872b6c51661076d0c31402d48d46297aa125876))

## [4.7.2](https://github.com/smithery-ai/cli/compare/v4.7.1...v4.7.2) (2026-03-18)


### Bug Fixes

* agent-friendly auth login for non-TTY environments (SMI-1627) ([#701](https://github.com/smithery-ai/cli/issues/701)) ([280917c](https://github.com/smithery-ai/cli/commit/280917c5bea8759ac0d8930654ddc584a5b296f0))

## [4.7.1](https://github.com/smithery-ai/cli/compare/v4.7.0...v4.7.1) (2026-03-18)


### Bug Fixes

* don't prompt to install keytar on logout (SMI-1615) ([#699](https://github.com/smithery-ai/cli/issues/699)) ([918ac0c](https://github.com/smithery-ai/cli/commit/918ac0ca6067f48276bf45a8c25f2566e673ea32))

## [4.7.0](https://github.com/smithery-ai/cli/compare/v4.6.0...v4.7.0) (2026-03-13)


### Features

* **skill:** add publish command ([#696](https://github.com/smithery-ai/cli/issues/696)) ([2b8c592](https://github.com/smithery-ai/cli/commit/2b8c59251515ae8b98f98eb2668e4d2fdcf719c6))


### Refactors

* remove automation commands feature ([#698](https://github.com/smithery-ai/cli/issues/698)) ([5413f9b](https://github.com/smithery-ai/cli/commit/5413f9b51f64ff175c2c7474abdf5cd680b2f744))

## [4.6.0](https://github.com/smithery-ai/cli/compare/v4.5.0...v4.6.0) (2026-03-08)


### Features

* **automation:** add zod schema validation and improve DX ([#692](https://github.com/smithery-ai/cli/issues/692)) ([4840995](https://github.com/smithery-ai/cli/commit/484099570bc60d6ea5162cd995a501a8e3a6782c))

## [4.5.0](https://github.com/smithery-ai/cli/compare/v4.4.0...v4.5.0) (2026-03-03)


### Features

* **SMI-1564:** tree-based tool browsing with required connection arg ([#684](https://github.com/smithery-ai/cli/issues/684)) ([7562772](https://github.com/smithery-ai/cli/commit/756277255397b60667257b7d67ad745d8dbfdd52))


### Bug Fixes

* disable minification for shttp bundles to improve debuggability ([#685](https://github.com/smithery-ai/cli/issues/685)) ([64de162](https://github.com/smithery-ai/cli/commit/64de162f99549dc7c9087e41621f2bd31fbb42e2))
* restore whoami behavior, metadata filtering, and flat pagination ([#687](https://github.com/smithery-ai/cli/issues/687)) ([c9ed674](https://github.com/smithery-ai/cli/commit/c9ed674714941c8aba2b69efedd5352bd78c722c))
* show error message when tool list gets invalid connection name ([#681](https://github.com/smithery-ai/cli/issues/681)) ([50ecb00](https://github.com/smithery-ai/cli/commit/50ecb009c7f004eccf6e1a49bd6af22ef3d574f2))


### Refactors

* **auth:** remove whoami token mint/server flow ([#686](https://github.com/smithery-ai/cli/issues/686)) ([b8a9805](https://github.com/smithery-ai/cli/commit/b8a980564aec8c2464baab17cfa14deb9aa6ebd6))

## [4.4.0](https://github.com/smithery-ai/cli/compare/v4.3.0...v4.4.0) (2026-02-27)


### Features

* surface tool annotations in tool list output ([#679](https://github.com/smithery-ai/cli/issues/679)) ([b949eb2](https://github.com/smithery-ai/cli/commit/b949eb2c46935b0ecc5c24586c9629ab2636da4e))


### Chores

* **SMI-1567:** add prefix filtering to tool list and event topics ([#678](https://github.com/smithery-ai/cli/issues/678)) ([cdb28e8](https://github.com/smithery-ai/cli/commit/cdb28e88b5c5e1f74fb12613b485615ba6a6ee80))
* update dev bootstrap for SDK v4.1.0 ([#676](https://github.com/smithery-ai/cli/issues/676)) ([7a105de](https://github.com/smithery-ai/cli/commit/7a105de0d0a9fb315dd4f36f5155b4f37dd13a3a))

## [4.3.0](https://github.com/smithery-ai/cli/compare/v4.2.1...v4.3.0) (2026-02-26)


### Features

* improve auth token --policy UX with JSON schema and repeatable constraints ([#675](https://github.com/smithery-ai/cli/issues/675)) ([b95bd6f](https://github.com/smithery-ai/cli/commit/b95bd6f8c32780c6a13b8cbddc4eacb932243482))


### Bug Fixes

* list event topics without requiring MCP handshake ([#671](https://github.com/smithery-ai/cli/issues/671)) ([760bd8a](https://github.com/smithery-ai/cli/commit/760bd8adc3e1971864e062fd66977951d18732ca))
* warn on auth-required connections instead of silently failing ([#673](https://github.com/smithery-ai/cli/issues/673)) ([4fe8a8c](https://github.com/smithery-ai/cli/commit/4fe8a8cd53427527179a2fb869d8a63c1cd86936))

## [4.2.1](https://github.com/smithery-ai/cli/compare/v4.2.0...v4.2.1) (2026-02-25)


### Chores

* **SMI-1552:** add events poll command and update SDK to 0.52.0 ([#670](https://github.com/smithery-ai/cli/issues/670)) ([cfe076d](https://github.com/smithery-ai/cli/commit/cfe076d84c54ea51d2c4d90a22668c41fd1aa557))
* use positional args for secret set command ([#665](https://github.com/smithery-ai/cli/issues/665)) ([79c310e](https://github.com/smithery-ai/cli/commit/79c310e0a878d0bf82a873459ca79f7692e1d3f2))

## [4.2.0](https://github.com/smithery-ai/cli/compare/v4.1.8...v4.2.0) (2026-02-25)


### Features

* add search param and register mcp logs command ([#663](https://github.com/smithery-ai/cli/issues/663)) ([a5406fa](https://github.com/smithery-ai/cli/commit/a5406faa5eb9f165e25ca9dac1955d1346adbdca))

## [4.1.8](https://github.com/smithery-ai/cli/compare/v4.1.7...v4.1.8) (2026-02-24)


### Bug Fixes

* use async exec for lazy install so spinner animates ([#660](https://github.com/smithery-ai/cli/issues/660)) ([82617d4](https://github.com/smithery-ai/cli/commit/82617d4d1984f5555e9c9fa0cd7783d46d3fa7f1))

## [4.1.7](https://github.com/smithery-ai/cli/compare/v4.1.6...v4.1.7) (2026-02-24)


### Bug Fixes

* use --save-prod for lazy install to prevent silent no-op ([#658](https://github.com/smithery-ai/cli/issues/658)) ([f4c6614](https://github.com/smithery-ai/cli/commit/f4c6614b03066334e1ca71d1d5e07525d724e344))

## [4.1.6](https://github.com/smithery-ai/cli/compare/v4.1.5...v4.1.6) (2026-02-24)


### Chores

* **SMI-1539:** add event command for MCP event subscriptions ([#652](https://github.com/smithery-ai/cli/issues/652)) ([6da0b63](https://github.com/smithery-ai/cli/commit/6da0b639d8f225f5c76eae86aaa3e0b9c0b2a72a))
* **SMI-1540:** scan event topics during publish ([#654](https://github.com/smithery-ai/cli/issues/654)) ([54b8ef0](https://github.com/smithery-ai/cli/commit/54b8ef0675b429e99fc3910e3f5d2087fe634809))

## [4.1.5](https://github.com/smithery-ai/cli/compare/v4.1.4...v4.1.5) (2026-02-24)


### Bug Fixes

* bypass ESM resolution cache in lazy import retry ([#655](https://github.com/smithery-ai/cli/issues/655)) ([27e3ac4](https://github.com/smithery-ai/cli/commit/27e3ac4759572b69eeff49950bac600d97451c17))


### Chores

* add hidden mcp secrets subcommands ([#650](https://github.com/smithery-ai/cli/issues/650)) ([35c9b0a](https://github.com/smithery-ai/cli/commit/35c9b0aa82549e4d642f983539ddd875a2b215fa))

## [4.1.4](https://github.com/smithery-ai/cli/compare/v4.1.3...v4.1.4) (2026-02-23)


### Refactors

* replace jsonc-parser with bundlable comment-json ([#648](https://github.com/smithery-ai/cli/issues/648)) ([2877d18](https://github.com/smithery-ai/cli/commit/2877d1801ab7d8a520e70869331935a632de6e52))

## [4.1.3](https://github.com/smithery-ai/cli/compare/v4.1.2...v4.1.3) (2026-02-23)


### Bug Fixes

* prevent platform mismatch in lazy dependency install ([#643](https://github.com/smithery-ai/cli/issues/643)) ([96ea3bf](https://github.com/smithery-ai/cli/commit/96ea3bf0b00d3258c03344da6d968f8dcce0416e))
* remove explicit biome linux binary from CI ([#645](https://github.com/smithery-ai/cli/issues/645)) ([51e872d](https://github.com/smithery-ai/cli/commit/51e872d1b67547d7c29f1dab65b89911c1075a18))


### Performance Improvements

* zero runtime dependencies ([#646](https://github.com/smithery-ai/cli/issues/646)) ([9d0a636](https://github.com/smithery-ai/cli/commit/9d0a6365052ebe145f112beb949aad50ebaf0477))

## [4.1.2](https://github.com/smithery-ai/cli/compare/v4.1.1...v4.1.2) (2026-02-22)


### Bug Fixes

* make setup command non-interactive by default ([#640](https://github.com/smithery-ai/cli/issues/640)) ([7a92c51](https://github.com/smithery-ai/cli/commit/7a92c519c0b78554211788cef53e75edb8fc96ed))

## [4.1.1](https://github.com/smithery-ai/cli/compare/v4.1.0...v4.1.1) (2026-02-22)


### Performance Improvements

* lazy-install keytar to eliminate native build ([#638](https://github.com/smithery-ai/cli/issues/638)) ([3e445ef](https://github.com/smithery-ai/cli/commit/3e445efdab5a9b587c88eacbabbc53280d66cef7))

## [4.1.0](https://github.com/smithery-ai/cli/compare/v4.0.2...v4.1.0) (2026-02-22)


### Features

* optimize skill trigger description [SMI-1493] ([#636](https://github.com/smithery-ai/cli/issues/636)) ([3e55dde](https://github.com/smithery-ai/cli/commit/3e55ddea506bf6bb2453598461862f2bc97f0f12))
* **SMI-1512:** Add --unstableWebhookUrl option to smithery mcp add ([#634](https://github.com/smithery-ai/cli/issues/634)) ([944034e](https://github.com/smithery-ai/cli/commit/944034eb7656aae872efd53b6dbb4636eca3c2d6))


### Performance Improvements

* optimize CLI startup, install size, and deps [SMI-1535] ([#637](https://github.com/smithery-ai/cli/issues/637)) ([4a333dc](https://github.com/smithery-ai/cli/commit/4a333dc6c6b0e0ff4ae65858b94a1db4459e6965))

## [4.0.2](https://github.com/smithery-ai/cli/compare/v4.0.1...v4.0.2) (2026-02-17)


### Bug Fixes

* add CTA for permission denied errors ([#632](https://github.com/smithery-ai/cli/issues/632)) ([e18c52d](https://github.com/smithery-ai/cli/commit/e18c52d9606f9499ef457636add6f024ed80afe8))

## [4.0.1](https://github.com/smithery-ai/cli/compare/v4.0.0...v4.0.1) (2026-02-16)


### Bug Fixes

* **SMI-1470:** improve auth error messages for expired tokens ([#630](https://github.com/smithery-ai/cli/issues/630)) ([45c6fc8](https://github.com/smithery-ai/cli/commit/45c6fc8b1c3b2976fb9a979c1c566a9200f21dd8))


### Chores

* ignore macOS AppleDouble files (._*) ([#627](https://github.com/smithery-ai/cli/issues/627)) ([7bb82c6](https://github.com/smithery-ai/cli/commit/7bb82c61f21fb46f5891feb16c880e6d590a9a1c))

## [4.0.0](https://github.com/smithery-ai/cli/compare/v3.19.0...v4.0.0) (2026-02-14)


### ⚠ BREAKING CHANGES

* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623))
* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613))

### Features

* CLI v4.0.0 — unified mcp noun, agent-friendly output, global flags [SMI-1372] ([#613](https://github.com/smithery-ai/cli/issues/613)) ([56e0e7b](https://github.com/smithery-ai/cli/commit/56e0e7bf52cc0ffd2e01eb7e80c9a1ccf5432187))
* decouple build from publish, simplify auth and deploy UX ([#623](https://github.com/smithery-ai/cli/issues/623)) ([36a6944](https://github.com/smithery-ai/cli/commit/36a694416c3b85cf263d09e49de0f9cebdd7997e))


### Bug Fixes

* resolve biome lint error and add pre-push hook ([#625](https://github.com/smithery-ai/cli/issues/625)) ([588ccf0](https://github.com/smithery-ai/cli/commit/588ccf09f6944eef37f1aa7a986dec9046d96707))


### Refactors

* rename "deployment" to "release" in CLI output ([#624](https://github.com/smithery-ai/cli/issues/624)) ([a3da821](https://github.com/smithery-ai/cli/commit/a3da821aef815efa14abbbc2f06c139b5d450265))

## [3.19.0](https://github.com/smithery-ai/cli/compare/v3.18.0...v3.19.0) (2026-02-09)


### Features

* add smithery setup command ([#616](https://github.com/smithery-ai/cli/issues/616)) ([d78e8d0](https://github.com/smithery-ai/cli/commit/d78e8d03a45f8b9254a52129eeb781f23a33a18f))


### Refactors

* improve Smithery skill metadata; ref SMI-1404 ([#614](https://github.com/smithery-ai/cli/issues/614)) ([f36b4ba](https://github.com/smithery-ai/cli/commit/f36b4ba794e1b6df73de59a46d378eb6f5e9da14))

## [3.18.0](https://github.com/smithery-ai/cli/compare/v3.17.0...v3.18.0) (2026-02-08)


### Features

* add skills view command ([#609](https://github.com/smithery-ai/cli/issues/609)) ([e0d3e65](https://github.com/smithery-ai/cli/commit/e0d3e65e65f44cec5dddb307e398f2c2a81d409c))
* detect createAuthAdapter export and write to manifest [SMI-1160] ([#604](https://github.com/smithery-ai/cli/issues/604)) ([f5f6b74](https://github.com/smithery-ai/cli/commit/f5f6b742a2885178b229a11df74ea3b17a292c16))


### Bug Fixes

* keep skill required, only make agent optional ([#611](https://github.com/smithery-ai/cli/issues/611)) ([714b7f8](https://github.com/smithery-ai/cli/commit/714b7f896cfe5f96592f414a02b99645f83400a1))

## [3.17.0](https://github.com/smithery-ai/cli/compare/v3.16.0...v3.17.0) (2026-02-06)


### Features

* improve search and connect UX for agents ([#605](https://github.com/smithery-ai/cli/issues/605)) ([11c8ef7](https://github.com/smithery-ai/cli/commit/11c8ef7d25c148d2e845ded0e7a6878a64290785))

## [3.16.0](https://github.com/smithery-ai/cli/compare/v3.15.1...v3.16.0) (2026-02-05)


### Features

* show welcome message when CLI runs without arguments ([e2a7cc6](https://github.com/smithery-ai/cli/commit/e2a7cc6b7f7d1a2d0fd4c5b000b48eaaf5f5ae63))

## [3.15.1](https://github.com/smithery-ai/cli/compare/v3.15.0...v3.15.1) (2026-02-05)


### Bug Fixes

* add registry-url to setup-node for npm OIDC auth ([7855d98](https://github.com/smithery-ai/cli/commit/7855d9894279aef79caade19c2743c50a4cd6747))
* add workflow_dispatch to allow manual publish trigger ([bcc31c1](https://github.com/smithery-ai/cli/commit/bcc31c1d163535566ccbd285d6c44cfd73156d48))
* use Node 24 for npm OIDC publishing support ([7d7b4e2](https://github.com/smithery-ai/cli/commit/7d7b4e2b80f68c348cefce2c9dbcdf509aa9b7ab))
* use stderr for postinstall message to bypass npm suppression ([df5f6c4](https://github.com/smithery-ai/cli/commit/df5f6c450e7bb2938d0726894907adbf386e17e2))

## [3.15.0](https://github.com/smithery-ai/cli/compare/v3.14.0...v3.15.0) (2026-02-05)


### Features

* improve postinstall message for agents ([#601](https://github.com/smithery-ai/cli/issues/601)) ([92726b5](https://github.com/smithery-ai/cli/commit/92726b5231062136e650f271b15709d74273c310))


### Bug Fixes

* inline npm publish into release-please workflow ([#599](https://github.com/smithery-ai/cli/issues/599)) ([d4c64ef](https://github.com/smithery-ai/cli/commit/d4c64ef25a1ca57d14c9ca718c471e2fe5f81761))

## [3.14.0](https://github.com/smithery-ai/cli/compare/v3.13.2...v3.14.0) (2026-02-05)


### Features

* add post-install message and servers search command ([#598](https://github.com/smithery-ai/cli/issues/598)) ([874d8c2](https://github.com/smithery-ai/cli/commit/874d8c2534eb6412e57eb9fee379b4c7cb18e153))

## [3.13.2](https://github.com/smithery-ai/cli/compare/v3.13.1...v3.13.2) (2026-02-05)


### Bug Fixes

* add explicit permissions for publish workflow OIDC ([a0962ec](https://github.com/smithery-ai/cli/commit/a0962ec5ab017d7017a6da17894ae017480eaa63))
* move OIDC permissions to workflow-level in publish.yml ([b9056f3](https://github.com/smithery-ai/cli/commit/b9056f3b3f58cdca3b3d1cad0daa28aaa1980d08))

## [3.13.1](https://github.com/smithery-ai/cli/compare/v3.13.0...v3.13.1) (2026-02-05)


### Bug Fixes

* add id-token permission for npm publish OIDC ([#593](https://github.com/smithery-ai/cli/issues/593)) ([3f61a2d](https://github.com/smithery-ai/cli/commit/3f61a2d2281e5b40654363639a6098842b7dbb0b))
* use GitHub App token for release-please to trigger CI ([#592](https://github.com/smithery-ai/cli/issues/592)) ([832fe51](https://github.com/smithery-ai/cli/commit/832fe512a36e8251cd8e17ff0a98b0881839cb99))


### Chores

* trigger release-please workflow ([cfa5be4](https://github.com/smithery-ai/cli/commit/cfa5be42421543df1ca821e739e9141a58dce612))
* verify release-please workflow ([0b1c416](https://github.com/smithery-ai/cli/commit/0b1c416674a0df5a65c7cea6814b97459717ea9c))

## [3.13.0](https://github.com/smithery-ai/cli/compare/v3.12.1...v3.13.0) (2026-02-05)


### Features

* enhance connect commands with get, pagination, error handling, and shorthand URLs ([#589](https://github.com/smithery-ai/cli/issues/589)) ([04293a7](https://github.com/smithery-ai/cli/commit/04293a719f663f8f81c47c131c63121b4d0659ea))


### Bug Fixes

* read SMITHERY_BASE_URL at runtime instead of bake-in at build ([#587](https://github.com/smithery-ai/cli/issues/587)) ([b618c33](https://github.com/smithery-ai/cli/commit/b618c33ad0fba917dd11a02d761d0318fe4ddf44))


### Documentation

* add value prop about connecting agents to Smithery registry ([#591](https://github.com/smithery-ai/cli/issues/591)) ([090f299](https://github.com/smithery-ai/cli/commit/090f299916a1045d3f45e678f7432d38d0a4596a))
* improve README clarity and accuracy ([#590](https://github.com/smithery-ai/cli/issues/590)) ([d41e65c](https://github.com/smithery-ai/cli/commit/d41e65cf6fc81d2a65d99de38d97c6f28b1f46da))

## [3.12.1](https://github.com/smithery-ai/cli/compare/v3.12.0...v3.12.1) (2026-02-05)


### Bug Fixes

* update skills commands for @smithery/api 0.38.0 ([#585](https://github.com/smithery-ai/cli/issues/585)) ([a049fa0](https://github.com/smithery-ai/cli/commit/a049fa01b803cf026830017691fd807ef8433f20))

## [3.12.0](https://github.com/smithery-ai/cli/compare/v3.11.0...v3.12.0) (2026-02-05)


### Features

* add --headers option to connect add/set commands ([#581](https://github.com/smithery-ai/cli/issues/581)) ([da2856d](https://github.com/smithery-ai/cli/commit/da2856d77f766d72655e668d3063381d30c793e2))


### Bug Fixes

* remove unused --print-link option from login command ([#583](https://github.com/smithery-ai/cli/issues/583)) ([9a5b830](https://github.com/smithery-ai/cli/commit/9a5b830fcfc55e855c97a4c2e881c1beadb19753))

## [3.11.0](https://github.com/smithery-ai/cli/compare/v3.10.1...v3.11.0) (2026-02-05)

### Features

* improve review add UX with GitHub-style syntax ([#580](https://github.com/smithery-ai/cli/issues/580)) ([52aeb1d](https://github.com/smithery-ai/cli/commit/52aeb1df451167854ae2c0a346b37d9b1dec656f))


## [3.10.0](https://github.com/smithery-ai/cli/compare/v3.9.0...v3.10.0) (2026-02-04)


### Features

* add comprehensive Smithery CLI skill [SMI-1367] ([#562](https://github.com/smithery-ai/cli/issues/562)) ([04ace79](https://github.com/smithery-ai/cli/commit/04ace79f9ceba978015e1882c302055028f90493))
* add logout command to remove all local credentials ([#574](https://github.com/smithery-ai/cli/issues/574)) ([1d6db88](https://github.com/smithery-ai/cli/commit/1d6db88c2e315a04db44001b97b165f65aaf64ee))
* add skills review and vote commands ([#568](https://github.com/smithery-ai/cli/issues/568)) ([9251cfd](https://github.com/smithery-ai/cli/commit/9251cfdd4b400667e6193d0ba2b23f12c318ee94))
* redesign skills review and vote CLI with gh-style commands ([#572](https://github.com/smithery-ai/cli/issues/572)) ([6463e37](https://github.com/smithery-ai/cli/commit/6463e37383b8b8d86d8ee286ca819f1b3b135e8d))


### Refactors

* use @smithery/api client for skills reviews ([#570](https://github.com/smithery-ai/cli/issues/570)) ([38957aa](https://github.com/smithery-ai/cli/commit/38957aa44b38e6c62390ffbc8c1aa25540e80bb1))

## [3.9.1](https://github.com/smithery-ai/cli/compare/v3.9.0...v3.9.1) (2026-02-05)

### Changed

* refactor skills review commands to use @smithery/api client instead of raw fetch ([#570](https://github.com/smithery-ai/cli/issues/570))
* update @smithery/api from 0.36.0 to 0.37.0

## [3.9.0](https://github.com/smithery-ai/cli/compare/v3.8.2...v3.9.0) (2026-02-04)

### Features

* add skills search and install commands ([#550](https://github.com/smithery-ai/cli/issues/550)) ([2b1c2db](https://github.com/smithery-ai/cli/commit/2b1c2db55a8e88c0e4720090ba6d3852c89fdea0))
  - `smithery skills search [query]` - interactive skill search and browsing
  - `smithery skills install <skill> --agent <name>` - install skills via Vercel Labs skills CLI
  - `smithery skills agents` - list available agents for installation
  - `smithery namespace search [query]` - search public namespaces
  - Options: `--json`, `--limit`, `--namespace`, `-g/--global`
* add skills review commands
  - `smithery skills reviews <skill>` - list reviews for a skill
  - `smithery skills review <skill>` - submit a text review (requires login)
  - `smithery skills review <skill> --delete` - delete your review
  - `smithery skills vote <skill> <review-id> --up|--down` - upvote/downvote a review
  - Options: `--json`, `--limit`, `--page`, `-t/--text`, `-m/--model`
* add `--page` option to `smithery skills search` for pagination
* add `--print-link` option to `smithery login` for agent-friendly authentication (prints URL without spinners/browser)
* add custom ID and metadata support to connect command ([#558](https://github.com/smithery-ai/cli/issues/558)) ([11c1484](https://github.com/smithery-ai/cli/commit/11c1484a6dcec5bc5ae3dbb2d07ade5ac8df748f))

### Bug Fixes

* use MCP client for listing tools instead of raw HTTP; ref SMI-1260 ([#563](https://github.com/smithery-ai/cli/issues/563)) ([79cb44d](https://github.com/smithery-ai/cli/commit/79cb44d9d66a3fdd01aef827c54a6072d5ab3145))
* upgrade @smithery/api and use new createConnection API ([#561](https://github.com/smithery-ai/cli/issues/561)) ([9241b59](https://github.com/smithery-ai/cli/commit/9241b59))
* allow SDK client to work without API key ([#556](https://github.com/smithery-ai/cli/issues/556)) ([d883dbe](https://github.com/smithery-ai/cli/commit/d883dbe7a6f8b6b9326ea7e6d2d55eeb989388ea))
* publish to npm in release-please workflow ([#565](https://github.com/smithery-ai/cli/issues/565)) ([94b3cdc](https://github.com/smithery-ai/cli/commit/94b3cdc0a7c401bd03003eff1ede550a4ee6cdf1))

### Performance Improvements

* lazy load command implementations to improve CLI startup ([#560](https://github.com/smithery-ai/cli/issues/560)) ([1f4a0e4](https://github.com/smithery-ai/cli/commit/1f4a0e49a4c665d360cd2e03d4887bf3f359f072))

### Tests

* add tests for public API patterns (skills and registry) ([#566](https://github.com/smithery-ai/cli/issues/566)) ([e394217](https://github.com/smithery-ai/cli/commit/e394217c1980b59804991f846b1eb33df67b3bf3))

## [3.5.0] - 2026-01-28

### Added
- `--config-schema` flag for `publish` command to specify JSON Schema for external URL servers (inline JSON or path to .json file)
- Post-publish tip suggesting `--config-schema` for external URL publishes without configuration

### Changed
- Renamed `deploy` command to `publish` (`deploy` remains as deprecated alias with warning)
- Consolidated CLI utilities into `cli-utils.ts` (qualified-name parsing, config masking, JSON parsing)

## [3.4.0] - 2025-01-27

### Added
- Asset bundling support for stdio deploys via `build.assets` field in `smithery.yaml` - allows including non-code files (data files, templates, configs) in MCPB bundles using glob patterns (#524)

## [3.3.3] - 2025-01-26

### Fixed
- Fixed qualified name parsing - simple names like `linear` now consistently resolve with `namespace="linear"` instead of empty namespace

### Changed
- Refactored `resolveServer()` to accept `{ namespace, serverName }` instead of qualified name string - callers now use centralized `parseQualifiedName()` utility

### Added
- New `parseQualifiedName()` utility in `src/utils/qualified-name.ts` for consistent qualified name parsing across the codebase
- Unit tests for qualified name parsing

## [2.0.0] - 2025-12-21

### Changed
- **BREAKING**: Store server configurations in OS keychain instead of remote storage for local servers. Configurations are now stored securely on the user's local machine using the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **BREAKING**: Remote server configuration handling - OAuth-capable clients now use direct HTTP URLs without API keys. Configuration is handled through OAuth flow instead of CLI prompts
- For clients that don't support OAuth but need HTTP servers, use `mcp-remote` as a fallback transport
- Simplified server resolution API - removed `ResolveServerSource` enum and `apiKey` parameter from `resolveServer()` function
- Refactored configuration handling - split `session-config.ts` into focused modules: `user-config.ts` for config resolution and `server-config.ts` for server configuration formatting
- Updated `run` command to load configurations from keychain instead of remote storage

### Added
- OS keychain integration using `keytar` library for secure local configuration storage
- New `keychain.ts` module with `saveConfig()`, `getConfig()`, and `deleteConfig()` functions
- `mcp-remote` integration for non-OAuth clients connecting to HTTP servers
- Test coverage for user configuration resolution, server configuration formatting, and client configuration I/O operations
- Support for HTTP URL key customization (`httpUrlKey`), HTTP type overrides (`httpType`), and format descriptor support for client-specific configuration formats

### Removed
- Remote configuration storage for local servers
- `session-config.ts` module (functionality moved to `user-config.ts` and `server-config.ts`)
- Widget-related code (`widget-bundler.ts`, `widget-discovery.ts`, `widget-validation.ts`)
- Old test files (`install.test.ts`, `installation-flow.test.ts`, `registry.test.ts`, `config-to-args.test.ts`)
- `config-to-args.ts` utility (functionality integrated into other modules)

## [1.5.2] - 2025-10-14

### Fixed
- Fixed integration tests to use actual resolution functions instead of custom mocks in `prepare-stdio-connection.test.ts`
- Replaced subprocess calls to `npx @anthropic-ai/mcpb unpack` with direct imports from `@anthropic-ai/mcpb` library for better reliability and performance
- Improved stdio command creation for bundles to properly resolve environment variables and arguments from manifest.json using actual template resolution functions

### Added
- Tests for bundle manager covering template resolution, manifest parsing, and error conditions

## [1.5.0] - 2025-10-13

### Added
- Configuration validation flow during server installation with saved config detection
- Profile support across all configuration endpoints
- New tests covering installation flows and registry API calls

### Changed
- Updated configuration validation endpoint from `/config/:id/validate` to `/config/status/:id` for better semantics
- Improved configuration prompting: required fields first, then optional fields
- Enhanced installation UX with better messaging and visual indicators

### Fixed
- Fixed URL encoding bug for server names
- Fixed route pattern conflict in registry validation endpoint
- Fixed profile parameter not being passed to config operations

## [1.4.1] - 2025-09-27

### Added
- Integration tests for stateful/stateless server behavior validation

### Fixed
- Fixed config schema not being passed into server bundle

## [1.4.0] - TBD

### Added
- OAuth support

## [1.3.0] - 2025-09-12

### Added
- Created shared `cleanupChildProcess` utility for consistent process cleanup across commands
- Added bun bundler support in addition to esbuild - detected automatically at runtime with optional override with `--tool` option (note: only when using bun runtime for esbuild bundle; node doesn't allow bun api)

### Changed
- Updated Biome from v1.5.3 to v2.2.4 for better cross-platform binary support
- Updated biome.jsonc configuration for v2 compatibility
- Updated Node.js requirement from >=18.0.0 to >=20.0.0 to match dependency requirements
- Updated GitHub Actions to use Node.js 20
- Refactored `dev`, `playground`, and `uplink` commands to use shared child process cleanup utility
- Changed default output format from CommonJS to ESM modules
- Removed npm cache configuration from GitHub Actions workflows to resolve build issues

### Fixed
- Resolved `Cannot find module '@biomejs/cli-linux-x64/biome'` CI error
- Improve error handling in child process cleanup
- Improve race condition handling in process exit
- Fixed CI/CD build issues by removing npm cache configuration from workflow

## [1.2.29] - 2025-09-12

### Changed
- Refactored CLI command prompts by extracting prompt utilities from main index file to `src/utils/command-prompts.ts`
- Cleaned up unused dependencies: removed `@types/uuid` and `bufferutil` optional dependency
- Improved code organization and maintainability of CLI interface
- Added short form `-c` option as alias for `--client` across all commands (install, uninstall, list)

## [1.2.26] - 2025-09-11

### Added
- Interactive CLI commands: `smithery install`, `smithery uninstall`, and `smithery list` now support interactive client selection when no `--client` flag is provided
- New `search [term]` command for interactive server discovery in the Smithery registry
- Support for Codex client with TOML configuration format
- Comprehensive installation test suite covering Target × Transport matrix (json, yaml, toml, command × stdio, http)

### Changed
- Improved client configuration pattern with better structure and validation
- Updated command documentation and help text to reflect interactive capabilities

## [1.2.12] - 2025-01-05

### Changed
- Idle timeout (30 minutes) now only logs instead of closing connection
- Heartbeat stops on idle, resumes on activity
- Refactored idle manager to use callbacks

## [1.1.89] - 2025-05-01

### Changed
- Updated registry endpoint access to use [smithery/sdk](https://github.com/smithery-ai/sdk)
- Added proper process exit handling during installation

## [1.1.81] - 2025-04-29

### Added
- Added new API key prompt during installation of remote servers

## [1.1.80] - 2025-04-26

### Added
- Added support for profiles to allow multiple configurations per server

## [1.1.79] - 2025-04-26

### Changed
- Improved Streamable HTTP transport initisation by ensuring heartbeats only start after connection is established

## [1.1.78] - 2025-04-26

### Changed
- Removed API key requirement for local server installation
- Removed deprecated `fetchConfigWithApiKey` function
- Updated config collection flow to skip configuration prompts when API key is provided

## [1.1.75] - 2025-04-25

### Added
- Added session termination on transport close for Streamable HTTP runner

## [1.1.74] - 2025-04-25

### Added
- New Streamable HTTP runner as the primary connection method
- Refactored common connection utilities into `runner-utils` for better code organization

### Deprecated
- WebSocket transport is now deprecated in favor of Streamable HTTP transport

## [1.1.71] - 2025-04-18

### Changed
- Refactored config handling to treat empty strings ("") as undefined values
- Added stricter validation for required fields in configuration
- Improved process exit handling with proper exit code 0 on transport close
- Removed redundant config validation in and index.ts
- Streamlined config validation flow in config.ts

## [1.1.70] - 2025-04-17

### Changed
- Renamed roo-code to roocode for consistency

## [1.1.69] - 2025-04-17

### Changed
- Updated Roo Code (previously Roo Cline) configuration path

## [1.1.68] - 2025-04-12

### Changed
- Enhanced stdio and WS runners with more gracious error handling
- Improved logging in stdio runner with timestamps

## [1.1.67] - 2025-04-11

### Changed
- Unified error handling between WebSocket and STDIO runners by centralizing common error handling logic
- Improved error handling flow by letting parent handle process exits during protocol errors
- Enhanced verbose logging in inspect command to track server resolution, connection selection, and runtime environment setup
- Improved security by logging only configuration structure instead of sensitive values

## [1.1.66] - 2025-04-03

### Changed
- Modified runtime config validation to allow empty strings for required fields
- Added separate config validation for run vs install commands
- Improved error handling for missing required fields during runtime

## [1.1.65] - 2025-04-02

### Added
- Added WebSocket heartbeat mechanism that pings every 30 seconds to maintain connection
- Added 15-minute idle timeout with automatic connection shutdown

## [1.1.64] - 2025-04-01

### Fixed
- Fixed config parsing on Windows command prompt where single quotes were being passed literally instead of being interpreted

## [1.1.63] - 2025-04-01

### Added
- Added support for VS Code and VS Code Insiders

## [1.1.62] - 2025-03-31

### Added
- Added `list servers` command to display installed servers for a specific client

## [1.1.61] - 2025-03-30

### Changed
- Use API key for calling track

## [1.1.60] - 2025-03-30

### Changed
- Added random jitter (0-1000ms) to WebSocket reconnection backoff
- Refactored WebSocket runner and improved console logs

## [1.1.59] - 2025-03-30

### Changed
- Enhanced WebSocket runner cleanup process with improved handling of connection termination
- Added safety timeout for WebSocket transport cleanup operations
- Added better state management for clean vs unexpected shutdowns in WebSocket connections

## [1.1.58] - 2025-03-30

### Changed
- Enhanced cleanup process in stdio-runner with better handling of client disconnections and process termination
- Added safety timeout for transport cleanup operations to ensure process termination

## [1.1.57]

### Changed
- Updated @modelcontextprotocol/sdk to v1.8.0 which fixes Windows spawn issues ([modelcontextprotocol/typescript-sdk#101](https://github.com/modelcontextprotocol/typescript-sdk/issues/101), [modelcontextprotocol/typescript-sdk#198](https://github.com/modelcontextprotocol/typescript-sdk/pull/198))

## [1.1.56]

### Added
- Added API key support to WebSocket runner for using saved configurations  

## [1.1.55] - 2025-03-27

### Changed
- Silenced WebSocket error logging for non-critical errors to improve UX in clients that surface console errors

## [1.1.54] - 2025-03-25

### Added
- Enhanced WebSocket error handling with specific handlers for connection errors (code -32000) and protocol errors (codes -32602, -32600)
- Added automatic reconnection attempt for server-initiated connection closures

## [1.1.53] - 2025-03-24

### Changed
- Updated server configuration handling to skip the `--config` flag when configuration is empty, for cleaner commands

## [1.1.52] - 2025-03-24

### Fixed
- Fixed destructuring issue in collectConfigValues() that was causing parsing error with inspect command

## [1.1.51] - 2025-03-25

### Changed
- Refactored the install command for better code organization and maintainability
- Enhanced API key handling to improve backward compatibility and isolate functions when API key is provided
- Optimized registry to reduce database calls by returning both server details and saved configuration in a single request

## [1.1.50] - 2025-03-22

### Fixed
- Updated `inspectServer` function to properly handle changes in configuration collection

## [1.1.49] - 2025-03-21

### Added
- Initial support for `--key` flag to authenticate and use servers through smithery (preparatory work, not yet functional)

### Changed
- Enhanced server configuration with improved validation

## [1.1.48] - 2025-03-17

### Fixed
- Replaced `normalizeServerId` with `getServerName` to prevent issues in Cursor due to long server names

## [1.1.47] - 2025-03-17

### Added
- Support server installation for Cursor since latest update (`0.47.x`) supports global mcp configuration (see [Cursor Changelog](https://www.cursor.com/changelog))

## [1.1.46] - 2025-03-11

### Added
- Test suites for WebSocket runner (ws-runner.ts)

### Changed
- Removed npx resolution utility functions in favor of direct handling in stdio-runner.ts with Windows-specific workaround using `cmd /c`

## [1.1.45] - 2025-03-10

### Changed
- Refactored command organization by moving command files to dedicated `src/commands/` directory
- Updated import paths and documentation
- Logging runtime environment details in verbose mode
