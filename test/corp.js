const fs = require('fs');
const redis = require('redis');
const redisClient = redis.createClient(6379, 'localhost');
let ui = {
    component: "hulk",
    files: [
        { name: 'module.js',
            content: fs.readFileSync("module.js","utf8") }
    ]
};
redisClient.publish("main.ui",JSON.stringify(ui));
redisClient.quit();