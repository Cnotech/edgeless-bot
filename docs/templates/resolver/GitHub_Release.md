# GitHub Release

- 类型：解析器
- 入口：`GitHub_Release`
- 适用 URL：`https?://api.github.com/repos/[^/]+/[^/]+/releases`

用于解析 GitHub Release 的下载地址，适用的 URL 通常由 `GitHub_Release` 爬虫提供
:::tip
预发布的 Release 会被忽略；

可以通过[环境变量](../../guide/usage.md#环境变量)注入 `GITHUB_TOKEN` 以增加请求频率
:::

## 必须提供的参数

### allow_pre_release

- 路径：`scraper_temp.allow_pre_release`
- 类型：`boolean`
- 说明：缺省状态下，模板会自动忽略预发布的 Release，设置为 `true` 则会将预发布的 Release 也纳入爬取范围
