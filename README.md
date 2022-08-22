# MyNote
A template git repository for manage markdown notes, export notes to html and create website on github.
The markdown encode is powered by [mume](https://github.com/shd101wyy/mume).
一个git的模板仓库, 可用于管理 markdown 笔记, 并导出为静态网页托管在github上
导出功能使用 [mume](https://github.com/shd101wyy/mume) 实现
## 安装
1. 通过复制此仓库, 建立一个新的仓库
2. 运行 init.sh 初始化
3. 建立新的 README.md 与 LICENSE
4. 在 github 上, 将 ./doc 设为静态网站根目录
## 使用
1. git pull 同步仓库
2. 编辑笔记
3. 运行 update.sh 导出 doc 并上传笔记
## 配置说明
配置文件于 ./config/update_config.json
``` js
{
    // 添加笔记文件 (git add) 的参数
    "noteAddArgs" : "",
    // 添加文档文件 (git add) 的参数
    "docAddArgs" : "",

    // 笔记文件根目录
    "noteDirPath" : "note",
    // 导出文档文件根目录
    "docDirPath" : "doc",

    // 提交导出文档文件 (git commit) 的参数
    "docCommitArgs" : "-m \"Update doc\"",
    // 提交笔记文件 (git commit) 的参数
    "noteCommitArgs" : "",
    
    // push 的分支
    "objBranch" : "main",
    // 上传的参数 (git push)
    "pushArgs" : "",
    // 是否自动上传
    "autoPush": true,

    // markdown 导出引擎参数, 见 https://github.com/shd101wyy/mume
    "engineConfig":
    {
        "previewTheme ": "github-light.css",
        "revealjsTheme ": "white.css",
        "codeBlockTheme ": "default.css",
        "printBackground ": true,
        "enableScriptExecution ": true
    },

    "exportConfig":
    {
        "offline": false, 
        "runAllCodeChunks": true
    }
}
```
## todo
1. 自动生成 index.html/index.md
2. 中文路径支持
