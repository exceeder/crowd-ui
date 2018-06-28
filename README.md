This project allows to crowd-develop a web UI by using Redis pubsub messaging to push
 and update Vue.js components and work with distributed models.
 
 To run, have local Redis running.
 Then start
 
```bash
node app.js 3001
```
or any other port. If no port is provided, default is 3001.

Login to http://localhost:3001/

Then change directory to client1 and run

```bash
node client.js
```
to push a simple module to the UI.

