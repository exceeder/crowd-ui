const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const redis = require('redis');
const UiBus = require('./ui-bus');
const Exchange = require("./exchange/exchange");

const redisHost = '127.0.0.1';
const redisPort = 6379;

//Starts a microservice at given port and connects to the given gateway
//usage `node main.js [port]`, e.g. `node main.js` or `node main.js 8080
class Main {
    constructor() {
        this.http_port = process.env.HTTP_PORT || process.argv[2] || 3001;
        this.app = express(this.http_port);
        this.components = [];
        this.styles = [];
        this.ui = {};
        this.sessions = {};
        this.initRedisUiBus();
        this.initRedisDataBus();
        this.initRedisInboundBus();
        this.createShutdownHook();
        this.initExpress();
        this.exchange = new Exchange();
    }

    // ---------- MESSAGING ----------------
    initRedisInboundBus() {
        let pub = redis.createClient(redisPort, redisHost);
        this.redisClientInbound = pub;
        UiBus.bus().on("inbound", (msg) => {
            pub.publish("main.updates."+msg.slot,JSON.stringify(msg.data));
        });
        let numsub = (topic) => new Promise((resolve, reject) => pub.pubsub('NUMSUB', topic, (err,res) => err ? reject(err) : resolve(res[1])));
        numsub("main.ui").then(r => console.log("Subscribers on main.ui channel: "+r));
        numsub("main.model").then(r => console.log("Subscribers on main.model channel: "+r));
    }

    initRedisUiBus() {
        this.redisClientUI = redis.createClient(redisPort, redisHost);
        this.redisClientUI.subscribe("main.ui");
        this.redisClientUI.on("message", (channel, message) => {
            try {
                //todo harden this code for invalid messages
                //console.log("Message '" + message + "' on channel '" + channel + "' arrived!");
                let c = JSON.parse(message);
                //c be like
                // { component: "[slot name]",  html: "html to display" } or
                // { component: "[slot name]",  files: [ {name: "module.js", content: "[file content]"}, ...] } or
                if (!this.ui[c.component]) {
                    c.version = 0;
                    this.components.push(c.component);
                    this.ui[c.component] = c;
                }
                if (c.html) {
                    c.files = this.wrapAsDefaultComponent(c.html);
                }
                if (c.version) {
                    this.ui[c.component].version = c.version;
                } else {
                    this.ui[c.component].version++;
                }
                this.ui[c.component].files = c.files;
                //if files contain a style sheet, push it separately
                for (let f of c.files) {
                    if (f.name === 'style.css' && !this.styles.includes(c.component)) {
                        this.styles.push(c.component);
                        UiBus.bus().emit('model', '', {style: c.component});
                    }
                }
                //notify UI we got new component
                UiBus.bus().emit('component', '', {version: this.ui[c.component].version, component: c.component});
            } catch (e) { console.log("Error on UI message:",e); }
        });
        UiBus.bus().on("inbound-main", (tabId, msg) => {
            if (msg === 'closed') {
                delete this.sessions[tabId];
            } else if (msg.data.login) {
                this.login(tabId, msg.data.login);
            } else if (msg.data.invest) {
                this.invest(tabId,  msg.data.user, msg.data.slot, msg.data.invest);
            }
        });
        //update balances for logged in users
        setInterval(() => {
            Object.values(this.sessions).forEach(s => {
                UiBus.bus().emit('model', s.tabId, { component: 'login', data: { path:'balance', value: this.exchange.getUserBalance(s.user) } });
            });
        },10000);
    }

    wrapAsDefaultComponent(html) {
        return [{
            name: "module.js",
            content:
                `export default { 
                             template: '<span v-html="rawHtml"></span>',
                             data() { return { rawHtml: ${JSON.stringify(html)} } }
                        }`
        }];
    }

    login(tabId, login) {
        this.sessions[tabId] = {
            user: login,
            tabId: tabId,
            authorized: true,
            created: new Date()
        };
        this.exchange.ensureUser(login);
        UiBus.bus().emit('model', tabId, { component: 'login', data: { path:'balance', value: this.exchange.getUserBalance(login) } });
    }

    invest(tabId, user, slot, amount) {
        if (this.exchange.invest(user, slot, amount)) {
            UiBus.bus().emit('model', tabId, {
                component: 'login',
                data: {path: 'balance', value: this.exchange.getUserBalance(user) }
            });
        }
    }

    initRedisDataBus() {
        this.redisClientModel = redis.createClient(redisPort, redisHost);
        this.redisClientModel.subscribe("main.model");
        this.redisClientModel.on("message", (channel, message) => {
            console.log("Message '" + message + "' on channel '" + channel + "' arrived!");
            try {
                let data = JSON.parse(message);
                //data be like { component: "[slot name]",  data: {path: 'users.list', value: ['John','Rob']} }
                //notify UI we got new model data
                UiBus.bus().emit('model', '', data);
            } catch (e) {
                console.log("Invalid message received ",message);
            }
        });
    }

    createShutdownHook() {
        // ensure clean shutdown with closing of all server sockets on kill / Ctrl+C
        let shutdownHook = () => {
            console.log("\n...gracefully shutting down ");
            this.exchange.shutdown();
            this.redisClientUI.quit();
            this.redisClientModel.quit();
            this.redisClientInbound.quit();
            process.exit(0);
        };
        process.on('SIGTERM', shutdownHook);
        process.on('SIGINT', shutdownHook);
    }

    initExpress() {
        //register usual express app
        this.app.use(bodyParser.json());
        //expose public directory as static files
        this.app.use("/",express.static(path.join(__dirname, 'public')));
        //start http server
        this.httpServer = this.app.listen(this.http_port, () => console.log('Listening on '+this.http_port));
        //register web socket at /events
        this.wsServer = new WebSocket.Server({server: this.httpServer, path: "/events"});
        //register event bus with web sockets
        this.uiEventBus = new UiBus(this.wsServer, (tabId) => {
            return { //send this data with new connection / refresh to fill UI with elements
                components: this.components,
                    styles: this.styles
            }
        });

        //serve UI components from internal in-memory model (event sourced)
        this.app.get("/ui/:component/*", (req, res) => {
            let component = req.params.component;
            let path = req.path.substring(("/ui/"+component).length+1);
            console.log("Component:"+component);
            console.log("Path:"+path);
            let c = this.ui[component];
            if (c) {
                for (let f of c.files) {
                    if (f.name === path) {
                        if (f.name.endsWith(".js")) {
                            res.type('application/javascript')
                        } else if (f.name.endsWith(".css")) {
                            res.type("text/css");
                        } else if (f.name.endsWith(".html")) {
                            res.type("text/html");
                        }
                        res.send(f.content);
                        return;
                    }
                }
            }
            res.status(404).send("Component ["+path+"] not found");
        });
    }
}

const main = new Main();
