const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const properties = require ("properties");
const redis = require('redis');
const UiBus = require('./ui-bus');

//Starts a microservice at given port and connects to the given gateway
//usage `node app.js [port]`, e.g. `node app.js` or `node app.js 8080
class App {
    constructor() {
        this.http_port = process.env.HTTP_PORT || process.argv[2] || 3001;
        this.app = express(this.http_port);
        this.components = [];
        this.ui = {};
        this.redisClient = redis.createClient(6379, '127.0.0.1');
        this.initRedis();
        this.initExpress();
    }

    // ---------- MESSAGING ----------------
    initRedis() {
        this.redisClient.subscribe("main.ui");
        this.redisClient.on("message", (channel, message) => {
            console.log("Message '" + message + "' on channel '" + channel + "' arrived!")
            let c = JSON.parse(message);
            if (!this.ui[c.component]) {
                this.components.push(c.component);
            }
            this.ui[c.component] = c.files;
            //notify UI we got new component
            UiBus.bus().emit('publish', '', c.component);
        });
    }

    initExpress() {
        // ensure clean shutdown with closing of all server sockets on kill / Ctrl+C
        let shutdownHook = () => {
            console.log("\n...gracefully shutting down ");
            this.redisClient.quit();
            process.exit(0);
        };
        process.on('SIGTERM', shutdownHook);
        process.on('SIGINT', shutdownHook);
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

const app = new App();
