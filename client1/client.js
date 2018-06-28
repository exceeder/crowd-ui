const fs = require('fs');
const redis = require('redis');
const redisClient = redis.createClient(6379, '127.0.0.1');

//use any of these names to update different slots:
// "escal", "othere", "creas", "varelse", "trusion", "intar", "clevel", "rement", "eping"
let ui = { component: "escal",  files: [] };

ui.files.push({
        name: 'module.js',
        content: fs.readFileSync("ui/module.js","utf8")
    });
//ui.files.push other files as needed by module.js, use base64 string encoding for images

redisClient.publish("main.ui",JSON.stringify(ui));
redisClient.quit();