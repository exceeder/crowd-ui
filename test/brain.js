const redis = require('redis');
const pub = redis.createClient(6379, 'localhost');
const sub = redis.createClient(6379, 'localhost');
sub.subscribe("exchange.market", (arg, channel) => console.log(`Subscribed to ${channel}.`));
sub.on("message", (topic, msg) => {
    let market = JSON.parse(msg);
    let update = {
        component: "hulk",
        data: {path: 'message', value: `Units available: ${market.units} at \$${market.price}.`}
    };
    pub.publish("main.model",JSON.stringify(update));
});