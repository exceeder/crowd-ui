const redis = require('redis');
const fs = require('fs');

//redis convenience methods, functional style
let clients = []; //client registry
const registerConnection = (c) => { clients.push(c); return c; };
const createRedisClient = () => registerConnection(redis.createClient(6379, '127.0.0.1'));
const pubClient = createRedisClient();
const publish = (topic, message) => { pubClient.publish(topic, JSON.stringify(message)); };
const subscribe = (topic, listener) => {
    let client = createRedisClient();
    client.subscribe(topic, (arg, channel) => console.log(`Subscribed to ${channel}.`));
    client.on("message", (topic, msg) => listener(JSON.parse(msg)));
};

//Take care of UI. Using slot "trusion" for this component, but you can change it.
const slot = "hulk";
let ui = {
    component: slot,
    version: 1, //increment version to cause updates of UIs
    files: [
      { name: 'module.js',  content: fs.readFileSync("ui/module.js","utf8").replace("%SLOTNAME%",slot) },
      { name: 'style.css',  content: fs.readFileSync("ui/style.css","utf8") }
    ]};
//publish ui files to the main web App
publish("main.ui", ui);

//Take care of business logic
let balance = 0;

subscribe(`main.updates.${slot}`, (msg) => {
    console.log("Received: ",msg);
    balance += msg.amountToAdd;
    publish("main.model", { component: slot,  data: {path: 'balance', value: balance} });
});

//wait for some exit command to allow business logic to work while this microservice is up
//think of how to keep the state between restarts (hint: Redis?)
console.log("Press ^D key to exit");
fs.readFile(0, () => { //wait for EOF, 0 is file handle for stdin
    console.log(`Thank you for reactivity`);
    clients.forEach( c => c.quit()); //disconnect all clients
});
