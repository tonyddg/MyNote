
echo " 检查 git 是否安装"
# 检查 git 是否安装
git --version
if [ 0 != $? ]
then
    echo "没有找到 git, 请确认是否安装"
    exit
fi

echo "修改仓库配置"
# 修改仓库所配置
git pull
rm .gitignore
mv real.gitignore .gitignore
rm README.md
# 解决中文乱码问题
git config core.quotepath false

echo "安装 node.js 相关支持"
# 检查并安装 node.js 相关支持 
mkdir ./doc
mkdir ./note
cd ./app
npm --version
if [ 0 == $? ]
then
    cnpm --version
    if [ 0 == $? ]
    then
        cnpm install --save @shd101wyy/mume
    else
        npm install --save @shd101wyy/mume
    fi
else
    echo "npm not found!"
    exit
fi

echo "更新仓库"
# 更新仓库
git add -A
git commit
git push origin main