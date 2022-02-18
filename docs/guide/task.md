# 任务

任务通常指对于一个特定软件的看门狗任务，添加一个任务并配置了定时运行 Edgeless Bot 后这个特定的软件就可以按照你的要求定时检查更新，并在有更新时将其下载然后按照特定方式打包、上传到你的存储介质。

## 创建任务

你可以通过复制粘贴已有的任务文件夹来添加一个新任务，不过我们更推荐使用 CLI 创建：

```shell
yarn new task
```

运行上述命令后，程序会询问一些问题并相应地完成新任务创建操作，并尽可能确保新任务符合要求。

创建完成后你可以通过修改任务名称文件夹中的 `config.toml` 文件更改某些配置，但是你的修改可能会不合法，需要[测试你的任务](#测试任务)校验你的配置是否正确。

## 回答问题

创建任务时你可能发现自己难以回答程序提出的问题，在继续之前请确保你已经阅读了[流程](whats.md#流程)。

### 任务名称

输入需要跟踪的软件名称，这个名称会贯穿整个任务，请谨慎决定。

### 任务分类

输入一个序号选择该软件的类型。全部分类定义在 `src/const.ts` 中。

### 作者

输入你的昵称，请保持此值唯一且在项目生命周期内不变。

### 上游 URL

输入此软件的官方发布页面，CLI 程序会自动尝试根据此 URL 匹配爬虫模板。

### 使用外置爬虫脚本

如果上游 URL 没有成功匹配到爬虫模板，则会询问此问题。此时选择"是"则会在任务文件夹内生成一个爬虫模板( `scraper.ts` )。

### 通用爬虫模板/爬虫模板要求的参数

如果在"使用外置爬虫脚本"中选择"否"则会要求选择一个通用爬虫模板，如果此爬虫要求提供一些键则会继续要求输入这些键的值，可以通过[查看对应模板的文档](../templates/scraper.md)了解如何填充其值。

### 制作器模板

选择一个需要的制作器模板，可以通过[查看对应模板的文档](../templates/producer.md)了解如何选择模板。你也可以选择最后一项以使用外置制作器脚本，此时则会在任务文件夹内生成一个制作器模板( `producer.ts` )。

### 下载文件校验正则

输入一个用于校验下载文件名的正则表达式，此正则表达式也可能会被爬虫或解析器用于匹配需要下载的文件名。

### 构建装箱单

构建装箱单用于在验收时校验是否缺失了文件或文件夹，支持使用[内置变量](../guide/built-in-values.md) (事实上配置文件的大部分键值都可以使用内置变量)。

### 制作器模板要求的参数

如果你选择的制作器要求提供一些键则会要求输入这些键的值，可以通过[查看对应模板的文档](../templates/producer.md)了解如何填充其值。如果制作器模板作者在 schema 中给定了对应键的描述则会显示在上方的"键释义"文本中。

## 编辑任务

有时创建任务的 CLI 程序无法完全确保生成的配置正确，因此依旧需要根据[测试](#测试任务)时输出的提示内容更改你的配置：

```toml
# 任务基本信息
[task]
# 名称
name = ""
# 分类
category = ""
# 作者
author = ""
# 上游发布页面URL
url = ""

# 指定使用的模板
[template]
# （可选）使用的爬虫模板入口名称，值为"External"表示使用外置爬虫脚本"scraper.ts"；
# 缺省时自动根据上游URL匹配
#scraper = ""
# （可选）强制指定使用的解析器模板入口名称，值为"None"表示强制不使用解析器而直接使用爬虫提供的直链下载；
# 默认为缺省，即自动根据爬虫提供的下载地址匹配
#resolver = ""
# 使用的制作器模板入口名称，值为"External"表示使用外置制作器脚本"producer.ts"
producer = ""

# 使用到的正则
[regex]
# （可选）用于帮助部分爬虫模板匹配下载地址
#download_link = ''
# 用于校验下载得到的文件名称是否符合预期，也可结合内置变量${latestVersion}用于帮助部分解析器模板匹配需要下载的文件
download_name = ''
# （可选）用于帮助部分爬虫模板匹配最新版本号
#scraper_version = ''

# 通用参数
[parameter]
# （可选）用于帮助部分解析器模板进入目录查找需要的文件，以此缩小查找范围
#resolver_cd = ["存档","历史版本","1.0.0"]
# （可选）压缩等级，范围1-10，数字越大得到的压缩包越小、解压越慢
#compress_level = 5
# 构建装箱单，用于验收制作器完成制作后返回的就绪目录，检查是否有关键文件（夹）缺失
build_manifest = ["${taskName}"]
# （可选）覆盖选项，值可以是一个压缩包或一个文件夹，用于在制作器完成制作后向就绪目录添加文件以自定义部分细节；
# 压缩包或文件夹内的内容会被覆盖复制到就绪目录
#build_cover = ""
# （可选）删除列表，用于在制作器完成制作后删除就绪目录中的文件（夹）
#build_delete = []

# （可选）爬虫模板临时参数，部分爬虫模板会要求指定其中的键；
# 对于此表中的键，Bot仅提供缺失校验，不会校验值类型，因此名称中带"temp"
#[scraper_temp]

# 自动制作模板要求的参数，制作器模板会要求指定其中的键
[producer_required]


# 额外备注，对于特殊类型的任务会在此处标注
#[extra]
#require_windows = false
#missing_version = ""

```

## 测试任务

使用以下命令测试你的任务：

```shell
yarn serve -d -t TASK_NAME
```