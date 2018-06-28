const fs = require('fs');
const redis = require('redis');
const redisClient = redis.createClient(6379, '127.0.0.1');

//use any of these names to update different slots:
// "escal", "othere", "creas", "varelse", "trusion", "intar", "clevel", "rement", "eping"
const SLOT_NAME="intar";

let ui = { component: SLOT_NAME,  files: [] };

ui.files.push({
        name: 'module.js',
        content: fs.readFileSync("ui/module.js","utf8")
    }); //push other files as needed by module.js, use base64 string encoding for images

//publish the UI component
redisClient.publish("main.ui",JSON.stringify(ui));
console.log("UI components updated");

//update message text
setTimeout(() => {
    redisClient.publish("main.model",JSON.stringify(
        { component: SLOT_NAME,  data: {path: 'message', value: 'Dynamic message update.'} }
    ));
    console.log("Data for component sent");
    redisClient.quit();
    console.log("I'm done.")
}, 2000);

