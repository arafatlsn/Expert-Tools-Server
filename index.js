const express = require('express');
const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.moy4n.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){

  try{

    await client.connect();
    const toolCollection = client.db('Expert_Tools').collection('tools');
    const orderCollection = client.db('Expert_Tools').collection('orders');

    // load all tools 
    app.get('/tools', async(req, res) => {
      const result = (await toolCollection.find().toArray()).reverse();
      res.send(result);
    })

    // load single tool
    app.get('/tool', async(req, res) => {
      const queryId = req.query?.id;
      const query = {_id: ObjectId(queryId)}
      const result = await toolCollection.findOne(query);
      res.send(result)
    })

    // post order 
    app.post('/order', async(req, res) => {
      const orderObj = req.body;
      const toolId = req.query.id;

      const queryId = { _id: ObjectId(toolId) }
      const find = await toolCollection.findOne(queryId)
      
      const orderQuantity = orderObj.orderQuantity;
      const prsntQuantity = find.quantity;
      const newQuantity = Number(prsntQuantity) - Number(orderQuantity);

      
      const updateQuantity = {
        $set: {quantity: newQuantity}
      }

      // order press 
      const pressOrder = await orderCollection.insertOne(orderObj);
      // update quantity 
      const updateTool = await toolCollection.updateOne(find, updateQuantity)

      res.send({ pressOrder, updateTool })
    })

  }
  finally{

  }

}

run()


app.get('/', (req, res) => {
  res.send('server is running')
})

app.listen(port, () => {
  console.log('server is runnign on', port)
})