const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const properties = require ("properties");
const redis = require('redis');
const UiBus = require('./ui-bus');

const redisHost = '127.0.0.1';
const redisPort = 6379;

//Starts a microservice at given port and connects to the given gateway
//usage `node main.js [port]`, e.g. `node main.js` or `node main.js 8080
class Main {
    constructor() {
        this.http_port = process.env.HTTP_PORT || process.argv[2] || 3001;
        this.app = express(this.http_port);
        this.components = [];
        this.ui = {};
        this.initRedisUiBus();
        this.initRedisDataBus();
        this.createShutdownHook();
        this.initExpress();
    }

    // ---------- MESSAGING ----------------
    initRedisUiBus() {
        this.redisClientUI = redis.createClient(redisPort, redisHost);
        this.redisClientUI.subscribe("main.ui");
        this.redisClientUI.on("message", (channel, message) => {
            //todo harden this code for invalid messages
            //console.log("Message '" + message + "' on channel '" + channel + "' arrived!");
            let c = JSON.parse(message);
            //c be like { component: "[slot name]",  files: [ {name: "module.js", content: "[file content]"}, ...] }
            if (!this.ui[c.component]) {
                this.components.push(c.component);
            }
            this.ui[c.component] = c.files;
            //notify UI we got new component
            //todo only send if newer version
            UiBus.bus().emit('component', '', c.component);
        });
    }

    initRedisDataBus() {
        this.redisClientModel = redis.createClient(redisPort, redisHost);
        this.redisClientModel.subscribe("main.model");
        this.redisClientModel.on("message", (channel, message) => {
            console.log("Message '" + message + "' on channel '" + channel + "' arrived!");
            let data = JSON.parse(message);
            //data be like { component: "[slot name]",  data: {path: 'users.list', value: ['John','Rob']} }
            //notify UI we got new model data
            UiBus.bus().emit('model', '', data);
        });
    }

    createShutdownHook() {
        // ensure clean shutdown with closing of all server sockets on kill / Ctrl+C
        let shutdownHook = () => {
            console.log("\n...gracefully shutting down ");
            this.redisClientUI.quit();
            this.redisClientModel.quit();
            process.exit(0);
        };
        process.on('SIGTERM', shutdownHook);
        process.on('SIGINT', shutdownHook);
    }

    initExpress() {
        //register app
        this.app.use(bodyParser.json());
        this.app.use("/",express.static(path.join(__dirname, 'public')));
        this.app.listen(this.http_port, () => console.log('Listening on '+this.http_port));
        //register events for SSE
        this.uiEventBus = new UiBus('/events', this.app, (tabId) => {
            return this.components;
        });

        //serve UI components from model
        this.app.get("/ui/:component/*", (req, res) => {
            let component = req.params.component;
            let path = req.path.substring(("/ui/"+component).length+1);
            console.log("Component:"+component);
            console.log("Path:"+path);
            let c = this.ui[component];
            if (c) {
                for (let f of c) {
                    if (f.name === path) {
                        if (f.name.endsWith(".js")) {
                            res.type('application/javascript')
                        }
                        res.send(f.content);
                        return;
                    }
                }
            }
            res.status(404).send("not found");
        });
    }
}

const main = new Main();
