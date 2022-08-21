var cp = require("child_process");
var path = require("path");
var fs = require("fs");
const mume = require("@shd101wyy/mume");

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

//调用 git log --stat=1000 获取所有被修改过的文件
//result 对象 {updated, deleted}
//updated 需要更新的文件
//deleted 需要删除的文件
function gitGetUpdatedMd()
{
    const regGetPath = / "?(.+.md)"?\s*\|.+/g;

    return new Promise((resolve, reject)=>
    {
        let resList = {updated : [], deleted : []};
        cp.exec("git log --stat=1000",function(err,stdout)
        {
            if(err == null)
            {
                let resItr = stdout.matchAll(regGetPath);
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
                resolve(resList);
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
    let toDir = path.dirname(to);
    if(!fs.existsSync(toDir))
    {
        fs.mkdirSync(toDir, { recursive: true });
    }
    fs.renameSync(from, to);
}

function getDocPath(notePath)
{
    let docPath = notePath.replace(/md$/, "html");
    let res = {from : docPath, to : docPath};
    res.to = res.to.replace(/^note/, "doc");
    return res;
}

function deleteDoc(noteList)
{
    for(let notePath of noteList)
    {
        let docPath = getDocPath(notePath).to;
        if(fs.existsSync(docPath))
        {
            fs.rmSync(docPath);
        }
    }
}

async function createDoc(noteList)
{
    const configPath = path.resolve(__dirname, ".mume");

    for(let notePath of noteList)
    {
        const engine = new mume.MarkdownEngine({
            filePath: notePath,
            config: {
                configPath: configPath,
                previewTheme: "github-light.css",
                // revealjsTheme: "white.css"
                codeBlockTheme: "default.css",
                printBackground: true,
                enableScriptExecution: true, // <= for running code chunks
            },
        });
        // html export
        await engine.htmlExport({ offline: false, runAllCodeChunks: true});

        let docPath = getDocPath(notePath);
        safeMove(docPath.from, docPath.to);
    }
}

async function main()
{
    await asyncExec("git add note");
    await asyncExec("git commit note");

    let res = await gitGetUpdatedMd();

    await createDoc(res.updated);
    deleteDoc(res.deleted)

    await asyncExec("git add doc");
    await asyncExec("git commit doc");    

    return true;
}

main().catch(error=>{
    console.log("update fail with cmd:");
    console.log(error.cmd);
    console.log("with output:");
    console.log(error.stdout);
});

// gitGetUpdatedMd().then(result=>{
//     console.log(result);
// })

//fs.mkdirSync(path.dirname(t), { recursive: true });
//fs.renameSync("note/c++/virtualterminal.md", "doc/c++/virtualterminal.md");

//console.log(fs.existsSync(path.dirname("note/c++/virtualterminal.md")));

//console.log(getDocPath("note/c++/regex.md"));

//createDoc(["note/c++/effective C++.md"]).catch(error=>{console.log(error);});