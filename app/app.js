//bug: 不支持中文

const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const mume = require("@shd101wyy/mume");

const updateConfig = JSON.parse( fs.readFileSync("config/update_config.json"));

function asyncExec(command)
{
    return new Promise((resolve, reject)=>
    {
        cp.exec(command, function(err,stdout)
        {
            if(err == null)
            {
                resolve(stdout);
            }
            else
            {
                err.stdout = stdout;
                reject(err);
            }
        });
    })
}

function dealLogOut(out)
{
    let resList = {updated : [], deleted : [], rename : []};
    //const regGetPath = / "?(.+\.md)"?\s*\|/g;
    const regGetPath = new RegExp(` "?(${updateConfig.noteDirPath}/.+\\.md)"?\\s*\\|`, 'g');
    //const regRename = / (.+){(.+) => (.+)}\s*\|\s*([0-9]+)/g;
    const regRename = new RegExp(` (${updateConfig.noteDirPath}/.+){(.+\\.md) => (.+\\.md)}\\s*\\|\\s*([0-9]+)`, 'g');

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
        if(res[4] === '0')
        {
            //仅重命名
            resList.rename.push({from : res[1] + res[2], to : res[1] + res[3]});
        }
        else
        {
            //重命名且修改过内容
            resList.updated.push(res[1] + res[3]);
            resList.deleted.push(res[1] + res[2]);
        }
    }

    return resList;
}

//调用 git log --stat=1000 获取所有被修改过的文件
//result 对象 {updated, deleted, rename}
//updated 需要更新的文件
//deleted 需要删除的文件
//rename 需要重命名的文件
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

function getDocPath(notePath)
{
    const regMatchMd = new RegExp("md$");
    const regMatchNoteRoot = new RegExp(`^${updateConfig.noteDirPath}`);

    let exportPath = notePath.replace(regMatchMd, "html");
    let res = {exportPath : exportPath, docPath : exportPath};
    res.docPath = res.docPath.replace(regMatchNoteRoot, updateConfig.docDirPath);
    return res;
}

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

function renameDoc(noteList)
{
    for(let notePath of noteList)
    {
        safeMove(getDocPath(notePath.from).docPath, getDocPath(notePath.to).docPath);
    }
}

async function createDoc(noteList)
{
    const configPath = path.resolve(__dirname, ".mume");
    const projectPath = path.resolve(process.argv[1], "config/.mume");
    const engineConfig = updateConfig.engineConfig;
    updateConfig.engineConfig.configPath = configPath;

    for(let notePath of noteList)
    {
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
}

async function main()
{
    await asyncExec(`git add ${updateConfig.noteDirPath} ${updateConfig.noteAddArgs}`);
    await asyncExec(`git commit ${updateConfig.noteDirPath} ${updateConfig.noteCommitArgs}`);

    let res = await gitGetUpdatedMd();

    await createDoc(res.updated);
    deleteDoc(res.deleted);
    renameDoc(res.rename);

    await asyncExec(`git add ${updateConfig.docDirPath} ${updateConfig.docAddArgs}`);
    await asyncExec(`git commit ${updateConfig.docDirPath} ${updateConfig.docCommitArgs}`);   

    if(updateConfig.autoPush)
    {
        await asyncExec(`git push origin ${updateConfig.objBranch} ${updateConfig.pushArgs}`); 
    }

    return true;
}

main().catch(error=>{
    if(error.cmd != undefined)
    {
        console.log("update fail with cmd:");
        console.log(error.cmd);
        console.log("with output:");
        console.log(error.stdout);        
    }
    else
    {
        console.log(error);
    }
});