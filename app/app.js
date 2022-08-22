const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const mume = require("@shd101wyy/mume");

const updateConfig = JSON.parse( fs.readFileSync("config/update_config.json"));

// Promise 包装的 cp.exec
// resolve 时返回 stdout
function asyncExec(command)
{
    return new Promise((resolve, reject)=>
    {
        cp.exec(command, function(err,stdout, stderr)
        {
            if(err == null)
            {
                resolve(stdout);
            }
            else
            {
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            }
        });
    })
}

// 处理 git log --stat 的结果, 获取文件改动
// 返回值 {updated, deleted, rename}
// updated 需要更新的文件
// deleted 需要删除的文件
// rename 需要重命名的文件
function dealLogOut(out)
{
    let resList = {updated : [], deleted : [], rename : []};
    //const regGetPath = / "?(.+\.md)"?\s*\|/g;
    const regGetPath = new RegExp(`\n "?(${updateConfig.noteDirPath}/[^> ]+\\.md)"?\\s*\\|`, 'g');
    //const regRename = / (.+){(.+) => (.+)}(\S*)\s*\|/g;
    const regRename = new RegExp(`\n "?(${updateConfig.noteDirPath}/.*){(.+) => (.+)}(\\S*)"?\\s*\\|\\s*([0-9]+)`, 'g');

    let resItr = out.matchAll(regGetPath);
    for(let res of resItr)
    {
        //排除被删除的文件
        if(fs.existsSync(res[1]))
        {
            resList.updated.push(res[1]);
        }
        else
        {
            resList.deleted.push(res[1]);
        }
    }

    //搜索重命名的文件
    resItr = out.matchAll(regRename);
    for(let res of resItr)
    {
        let from = (res[1] + res[2] + res[4]).trim();
        let to = (res[1] + res[3] + res[4]).trim();
        if(from.match(regGetPath))
        {
            continue;
        }
        else
        {
            if(res[5] === '0')
            {
                //仅重命名
                resList.rename.push({from : from, to : to});
            }
            else
            {
                //重命名且修改过内容
                resList.updated.push(to);
                resList.deleted.push(from);
            }            
        }

    }
    return resList;
}

// 同步调用 git log --stat=1000 并获文件改动
function gitGetUpdatedMd(refTimes = 1)
{
    return new Promise((resolve, reject)=>
    {
        cp.exec(`git log -${refTimes} --stat=1000`, function(err,stdout)
        {
            if(err == null)
            {
                resolve(dealLogOut(stdout));
            }
            else
            {
                err.stdout = stdout;
                reject(err);
            }
        });
    })
}

// 通过 console.log 解释 dealLogOut 的结果
function explainReslist(resList)
{
    console.log("以下文件被更新");
    for(let i of resList.updated)
    {
        console.log(i);
    }
    console.log("以下文件被删除");
    for(let i of resList.deleted)
    {
        console.log(i);
    }
    console.log("以下文件被重命名");
    for(let i of resList.rename)
    {
        console.log(i.from, '=>', i.to);
    }
}

// 安全同步移动文件
// 当 to 路径下的文件夹不存在时自动创建
function safeMove(from, to)
{
    if(!fs.existsSync(from))
    {
        return false;
    }
    let toDir = path.dirname(to);
    if(!fs.existsSync(toDir))
    {
        fs.mkdirSync(toDir, { recursive: true });
    }
    fs.renameSync(from, to);
    return true;
}

// 通过笔记文件路径, 解析其对应的文档路径
// 返回对象 {exportPath, docPath}
// exportPath 使用引擎导出的路径
// docPath 转移保存路径
function getDocPath(notePath)
{
    const regMatchMd = new RegExp("md$");
    const regMatchNoteRoot = new RegExp(`^${updateConfig.noteDirPath}`);

    let exportPath = notePath.replace(regMatchMd, "html");
    let res = {exportPath : exportPath, docPath : exportPath};
    res.docPath = res.docPath.replace(regMatchNoteRoot, updateConfig.docDirPath);
    return res;
}

// 根据 git log --stat=1000 获取的文件改动, 同步删除文档
function deleteDoc(noteList)
{
    for(let notePath of noteList)
    {
        let docPath = getDocPath(notePath).docPath;
        if(fs.existsSync(docPath))
        {
            fs.rmSync(docPath);
        }
    }
}

// 根据 git log --stat=1000 获取的文件改动, 同步重命名文档
function renameDoc(noteList)
{
    for(let notePath of noteList)
    {
        safeMove(getDocPath(notePath.from).docPath, getDocPath(notePath.to).docPath);
    }
}

// 将笔记文件导出为文档文件, 并移动到文档保存位置
async function exportNote(notePath)
{
    const projectPath = path.resolve(".", "config/.mume");
    const engineConfig = updateConfig.engineConfig;
    updateConfig.engineConfig.configPath = path.resolve(".", "config/.mume");

    const engine = new mume.MarkdownEngine({
        filePath: notePath,
        projectDirectoryPath: projectPath,
        config: engineConfig,
    });
    // html export
    await engine.htmlExport(updateConfig.exportConfig);

    let docPath = getDocPath(notePath);
    safeMove(docPath.exportPath, docPath.docPath);
}

// 根据 git log --stat=1000 获取的文件改动, 同步更新文档
async function createDoc(noteList)
{
    for(let notePath of noteList)
    {
        await exportNote(notePath);
    }
}

// 遍历目录下所有文件, 生成对目标文件的 markdown 导航
// root 遍历的根目录
// workroot index 所在的目录
// target 目标文件的类型 使用 | 标记多种文件(正则表达式语法)
// title 生成导航的一级标题, 默认为 {root}
function exportIndexMd(root, workroot, target, title, layer = 1)
{
    let content = "";
    let subContent = "";
    let dir = fs.readdirSync(root);
    let hasContent = false;
    const matchTarget = new RegExp(`(.+)\\.${target}`);

    dir.forEach(file=>{
        if(file == '.' || file == '..')
        {
            return;
        }

        let fullPath = path.resolve(root, file);
        let stats = fs.statSync(fullPath)

        if(stats.isDirectory())
        {
            let subres = exportIndexMd(fullPath, workroot, target, null, layer + 1);
            if(subres)
            {
                subContent = subContent.concat(subres);
                hasContent = true;
            }
        }
        else if(stats.isFile())
        {
            let matchRes = file.match(matchTarget);
            if(matchRes)
            {
                content = content
                .concat(`* [${matchRes[1]}](${path.relative(workroot, fullPath).replace(/\\/g, "/")})\n`);
                hasContent = true;
            }
        }
    })

    if(hasContent)
    {
        let head = "#";
        head = head.repeat(layer);

        if(layer === 1 && typeof(title) === "string")
        {
            head = head.concat(` ${title}\n`);
        }
        else
        {
            head = head.concat(` ${path.basename(root)}\n`);
        }
        return head + content + subContent;
    }
    else return false;
}

// 导出文档的导航( html 与 md )
async function exportIndexHtml()
{
    let indexMdPath = `${updateConfig.docDirPath}/index.md`
    let fileStream = fs.createWriteStream(indexMdPath);
    let indexMd = exportIndexMd(updateConfig.docDirPath, updateConfig.docDirPath, "html", updateConfig.indexTitle);
    
    if(indexMd)
    {
        await new Promise((resolve, reject)=>
        {
            fileStream.write(indexMd, "utf-8", (error)=>
            {
                if(error)
                {
                    reject(error);
                }
                else
                {
                    resolve();
                }
            });
        })
        
        await exportNote(indexMdPath);
    }
    else
    {
        console.log("empty index");
    }

    fileStream.close();     
}

async function main()
{
    console.log("初始化引擎");
    await mume.init(path.resolve(".", "config/.mume"));

    console.log("提交更改");
    await asyncExec(`git add ${updateConfig.noteDirPath} ${updateConfig.noteAddArgs}`);
    await asyncExec(`git commit ${updateConfig.noteCommitArgs}`);

    console.log("获取更改");
    let res = await gitGetUpdatedMd();

    if(updateConfig.debugMode)
    {
        explainReslist(res);
    }

    console.log("生成文档");
    await createDoc(res.updated);
    deleteDoc(res.deleted);
    renameDoc(res.rename);

    if(updateConfig.autoIndex)
    {
        console.log("生成Index");
        exportIndexHtml();
    }

    console.log("提交文档");
    await asyncExec(`git add ${updateConfig.docDirPath} ${updateConfig.docAddArgs}`);
    await asyncExec(`git commit ${updateConfig.docCommitArgs}`);

    if(updateConfig.autoPush)
    {
        console.log("上传");
        await asyncExec(`git push origin ${updateConfig.objBranch} ${updateConfig.pushArgs}`); 
    }

    return process.exit();
}

main().catch(error=>{
    console.log(error);
    process.exit();
});

//console.log(exportIndexMd("doc", "doc", "html", null));
// let fileStream = fs.createWriteStream("note/index.md");
// fileStream.write(exportIndexMd("doc", "doc", "html", null), "utf-8");
// fileStream.close();

// exportNote("note/index.md").catch(err=>{
//     console.log(err);
// })
