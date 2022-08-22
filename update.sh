node --version
if [ 0 == $? ]
then
    node app/app.js
else
    echo "node not found!"
    exit
fi