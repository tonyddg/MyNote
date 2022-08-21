git --version
if [ 0 != $? ]
then
    echo "git not found!"
    exit
fi

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
        cnpm install --save @shd101wyy/mume
    fi
else
    echo "npm not found!"
    exit
fi