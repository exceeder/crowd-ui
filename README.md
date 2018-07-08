This project allows to crowd-develop a web UI by using Redis pubsub messaging to push
 and update Vue.js components and work with distributed models.
 
#### Usage 
 To run, have local Redis running.
 Then start
 
```bash
node main.js 3001
```
or any other port. If no port is provided, default is 3001.

Login to http://localhost:3001/

Then change directory to client1 and run

```bash
node client.js
```
to push a simple module to the UI.

#### Architecture

```
[Browser]             |    [Node App]       |   [Redis]     |   [Distributed Actors]
- Bootstrap           |    - Express        |   - PubSub   <->  - Redis Client
- Vue                 |    - Redis Client  <->              |   - Source of Vue components
- Server-Sent Events <->                    |               |   - Source of data for models
                      |                     |               |   - Destination for data from UI
```

#### Event Topics

Redis event topics to cause UI to update:
* "main.ui" to push Vue components; message is a JSON string of an object
  ```javascript
  { component: "[slot name]",  files: [ {name: "module.js", content: "[file content]"}, ...] }
  ```                                      
    Note, if you need custom css for your component set, css file has to have a name `style.css`, e.g.
    ```javascript
    {name: "style.css", content: ".my-class { background:#777; }"}
    ```

* "main.model" to push updates to the model of each component, e.g.
  ```javascript
  { component: "[slot name]",  data: {path: 'users', value: ['John','Rob']} }
  ```
                                        
* "main.updates.(slot name)" subscribe and listen to updates from the UI, e.g.
    ```javascript
    let balance = 0;
    
    subscribe("main.updates.[slot name]", (msg) => {
        balance += msg.amountToAdd;
        publish("main.model", { component: '[slot name]',  data: {path: 'balance', value: balance} });
    });
    ```