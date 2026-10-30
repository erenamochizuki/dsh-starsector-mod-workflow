# awesome-dsh-plugin 收录说明

[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 是 DSH 官方向社区维护的插件精选列表，同时是 dsh 0.2.1+ 内置插件市场（Discover → Index sources）的数据源。DSH 的市场卡片**只列它的收录源**，所以这个仓库发布后要我出现在市场里，需要提一个 PR 收录。

本文件记录提交所需的全部材料，仓库发布后照抄即可。

## 1. 提交形式（官方规则）

- **只加一个 YAML 文件**：`data/plugins/<owner>__<repo>.yml`，本插件即：

  ```
  data/plugins/erenamochizuki__dsh-starsector-mod-workflow.yml
  ```

- `README.md` / `README.zh.md` 由脚本从 `data/plugins/*.yml` 生成，**不要手工编辑 README**。
- 一个 PR 只加/改自己这一条，不动别人的条目。

文件内容：

```yaml
url: https://github.com/erenamochizuki/dsh-starsector-mod-workflow
name: erenamochizuki/dsh-starsector-mod-workflow
category: skill
description:
  en: Registers the starsector-mod-workflow skill and a starsector_moci tool that runs the bundled Moci Starsector mod CLI (doctor, compile, build, verify, sync) against a project binding file.
  zh: 把 starsector-mod-workflow skill 与 starsector_moci 工具接入 DSH，按绑定文件在 Moci Starsector 工程上执行捆绑的 CLI（doctor、compile、build、verify、sync）。
# 可选：用 GitHub 托管的位图作市场卡片图标，不写则回退成作者头像
# icon: https://raw.githubusercontent.com/erenamochizuki/dsh-starsector-mod-workflow/main/assets/icon-180.png
# 可选：不发 npm 时，把预构建 tarball 附加到 Release 并在此指向它
# tarball: https://github.com/erenamochizuki/dsh-starsector-mod-workflow/releases/download/v1.0.0/dsh-starsector-mod-workflow-1.0.0.tgz
```

注意事项：

- 描述里出现 `: `（冒号+空格）必须整行加引号，否则 YAML 解析失败。上面的英文描述没有 `: `，安全；中文用全角冒号也没问题。
- 描述**必须属实**——评审会拿它去核对代码。上面这句对应的就是 `lib/index.js`（skill provider）与 `lib/moci-tool.js`（`starsector_moci`），以及 `assets/starsector-mod-workflow/Script/moci.mjs` 支持的子命令，不要写超出实现的数字或命令。
- `category` 取 `skill`（本插件的主体是打包一个 skill + 一个 CLI 工具）；候选还有 `workflow`、`dev`，选错不会被打回，维护者会改。

## 2. 硬性门槛（提 PR 前逐项确认）

| 要求 | 本仓库状态 |
|---|---|
| `package.json` 声明 `dsh.bundle.patch`（不是只有 `dsh.client`） | ✅ `dsh.bundle.patch: ./cordis.patch.yml` |
| 仓库根有 `cordis.patch.yml` 且 `insert` 里 `id` / `name` 正确 | ✅ `id: starsector-mod-workflow` / `name: dsh-starsector-mod-workflow` |
| 仓库有真实可用的代码，不是占位/纯 README | ✅ `lib/` + `test/` + 捆绑 skill |
| 仓库创建满 **1 天** | ⚠️ 仓库创建于 2026-10-31，**最早 2026-11-01 再提 PR**（CI 自动检查） |
| 仓库加了 `dsh-plugin` topic | ⚠️ 建仓后设置：Settings → Topics 加 `dsh-plugin`（建议再加 `deepseek-harness`、`starsector`） |
| 项目处于活跃维护状态 | ✅ |
| 描述无营销词、只讲功能 | ✅ |

## 3. 提 PR 的具体步骤

```bash
# 1. fork + clone
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone
cd awesome-dsh-plugin

# 2. 新建条目文件（内容见上）
mkdir -p data/plugins
$EDITOR data/plugins/erenamochizuki__dsh-starsector-mod-workflow.yml

# 3.（可选）本地预览生成结果
npm ci
node scripts/generate-readme.mjs

# 4. 提交
git checkout -b add-dsh-starsector-mod-workflow
git add data/plugins/erenamochizuki__dsh-starsector-mod-workflow.yml
git commit -m "Add dsh-starsector-mod-workflow"
git push -u origin add-dsh-starsector-mod-workflow
```

然后在该仓库开 PR，标题形如 `Add dsh-starsector-mod-workflow`，正文说明插件做什么、安装方式，并附上本仓库链接。没有 `gh` CLI 时直接在 GitHub 网页 fork + 编辑文件 + 提 PR 也可以。

## 4. 评审会看什么

1. 代码是否与条目声明一致（含描述里提到的任何数字/命令名）。
2. 分类是否合理（不因此打回）。
3. 是否是真实可跑代码。
4. 是否已被列表里其他条目覆盖（现有列表里没有 Starsector / mod 开发相关条目）。
5. 源码是否有可疑行为（混淆、凭据外传、异常安装期行为）。
6. PR 有没有动无关条目。
7. 是不是纯聚合包（本插件自己有 skill 注入与工具实现，不是聚合包）。

通过后条目会出现在 README 的 `Skills`/对应分类里，并被 dsh 的市场索引收录。

## 5. 可选加分项（让安装更顺）

- **发 npm 包**（`npm publish`，包名保持 `dsh-starsector-mod-workflow`）：市场会显示预构建安装，跳过 `allowBuilds` 构建授权步骤。需要 npm 账号；本仓库 `package.json` 已带 `repository`/`license`/`files` 等字段，`npm pack` 可直接出包。
- **在 Release 附预构建 tarball**（本仓库 v1.0.0 Release 计划已包含）：

  ```bash
  npm pack        # → dsh-starsector-mod-workflow-1.0.0.tgz
  gh release upload v1.0.0 dsh-starsector-mod-workflow-1.0.0.tgz
  ```

  然后把条目里的 `tarball:` 字段指向该下载链接。

## 6. 提交记录

- [ ] 仓库公开可访问
- [ ] `dsh-plugin` topic 已加
- [ ] Release v1.0.0 + tarball 已上传
- [ ] 条目 YAML 已提交 PR（≥ 2026-11-01）
- [ ] PR 已合并 → 市场可见
