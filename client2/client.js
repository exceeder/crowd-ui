const redis = require('redis');
const fs = require('fs');

//redis convenience methods
let clients = []; //client registry
const register = (c) => { clients.push(c); return c; };
const newClient = () => register(redis.createClient(6379, '127.0.0.1'));
const pubClient = newClient();
const publish = (topic, message) => { pubClient.publish(topic, JSON.stringify(message)); };
const subscribe = (topic, listener) => {
    let client = newClient();
    client.subscribe(topic, (arg, channel) => console.log(`Subscribed to ${channel}.`));
    client.on("message", (topic, msg) => listener(JSON.parse(msg)));
};

//using slot "escal" create this component
let ui = {
    component: "escal",
    version: 2,
    files: [
      { name: 'module.js',  content: fs.readFileSync("ui/module.js","utf8") },
      { name: 'style.css',  content: fs.readFileSync("ui/style.css","utf8") }
    ]};
//publish ui files to the main web App
publish("main.ui", ui);

//business logic
let balance = 0;

subscribe("main.updates.escal", (msg) => {
    console.log("Received: ",msg);
    balance += msg.amountToAdd;
    publish("main.model", { component: 'escal',  data: {path: 'balance', value: balance} });
});

//wait for some exit to allow business logic to work while up
console.log("Press ^D key to exit");
fs.readFile(0, () => { //wait for EOF, 0 is file handle for stdin
    console.log(`Thank you for reactivity`);
    clients.forEach( c => c.quit());
});
