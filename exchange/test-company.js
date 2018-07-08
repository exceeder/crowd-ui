const redis = require('redis');
let crypto = require('crypto');

//global settings
const SLOT = "varelse";

//redis convenience methods, functional style
let clients = []; //client registry
const redisHost = '127.0.0.1';
const registerConnection = (c) => { clients.push(c); return c; };
const createRedisClient = () => registerConnection(redis.createClient(6379, redisHost));
const pubClient = createRedisClient();
const publish = (topic, message) => pubClient.publish(topic, JSON.stringify(message));
const subscribe = (topic, listener) => {
    let client = createRedisClient();
    client.subscribe(topic, (arg, channel) => console.log(`Test subscribed to [${channel}]`));
    client.on("message", (topic, msg) => listener(JSON.parse(msg)));
};
let md5 = (str) => {
    let md5sum = crypto.createHash('md5');
    md5sum.update(str);
    return md5sum.digest('hex');
};

//subcscribe to logs, balances and marked conditions from exchange
subscribe(`exchange.logs.${SLOT}`, (msg) => console.log("XCHG Log: "+msg.message));
subscribe(`exchange.balances.${SLOT}`, (msg) => console.log("XCHG Bal: ",msg));
subscribe("exchange.market", (msg) => console.log("XCHG Mkt: ",msg));

//register at exchange and run
let doRegistration = new Promise((resolve) => {
    console.log("Registering");
    const reqId = ''+Math.floor(Math.random()*10000); //random 'nuf to not collide with others
    let responseTopic = "exchange.registry."+reqId;
    subscribe(responseTopic, (reply) => {
        resolve(reply);
    });
    publish("exchange.registry", {slot:SLOT, name:`${SLOT} Corp.`, reqId:reqId});
});

function runCompany(company) {
    console.log(company);
    subscribe("exchange.market", (market) => {
        let signature = md5(market.offerId+":"+company.key);
        let bid = { offerId: market.offerId, slot: SLOT, qty: market.units, price: market.price+1, signed: signature };
        console.log("My bid", bid);
        publish("exchange.bids", bid);
    });
}

doRegistration.then(runCompany);

process.on('SIGTERM', () => clients.forEach(c => c.quit()));


