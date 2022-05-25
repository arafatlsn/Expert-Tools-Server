const express = require('express');
const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.moy4n.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){

  try{

    // verify jwt 
    function verifyJwt(req, res, next){
      const token = req?.headers?.authorization;
      const getToken = JSON.parse(token.split(' ')[1])

      if(!getToken){
        return res.status(403).send({message: 'Unauthorized Access'})
      }
      jwt.verify(getToken, process.env.JWT_TOKEN, (error, decoded) => {
        if(error){
          return res.status(401).send({message: 'Forbidden Access'})
        }
        req.decoded = decoded;
        next()
      })

    }

    await client.connect();
    const toolCollection = client.db('Expert_Tools').collection('tools');
    const orderCollection = client.db('Expert_Tools').collection('orders');
    const userCollection = client.db('Expert_Tools').collection('users');

    // load all tools 
    app.get('/tools', async(req, res) => {
      const result = (await toolCollection.find().toArray()).reverse();
      res.send(result);
    })

    // load single tool
    app.get('/tool', verifyJwt, async(req, res) => {
      const userEmail = req.headers.useremail;
      const decodedEmail = req.decoded.userEmail;
      if(userEmail === decodedEmail){
        const queryId = req.query?.id;
        const query = {_id: ObjectId(queryId)}
        const result = await toolCollection.findOne(query);
        res.send(result)
      }
      else{
        res.status(401).send({message: 'Unauthorized Access'})
      }
    })

    // load myorders 
    app.get('/myorders', async(req, res) => {
      const userEmail = req.query.userEmail;
      const query = { email: userEmail }
      const result = await orderCollection.find(query).toArray();
      res.send(result)
    })

    // cancel order 
    app.delete('/removeorder', async(req, res) => {
      const queryId = req.query.toolId;
      const query = { _id: ObjectId(queryId) }
      const toolId = { _id: ObjectId(req.query.prodId) };
      const find = await toolCollection.findOne(toolId);
      const presentQuantity = find.quantity;
      const cancelQuantity = Number(req.query.orderCancelQantity);
      const reStockQuantity = presentQuantity + cancelQuantity;
      const updateDoc = {
        $set: { quantity: reStockQuantity }
      }

      const reStock = await toolCollection.updateOne(find, updateDoc)
      const result = await orderCollection.deleteOne(query);
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

    // sign in jwt 
    app.get('/users', async(req, res) => {
      const userEmail = (req.headers?.authorization)?.split(' ')[1];
      const find = { email: userEmail };
      const options = { upsert: true };
      const userDoc = {
        $set: { email: userEmail }
      }
      const token = jwt.sign({ userEmail }, process.env.JWT_TOKEN, { expiresIn: '1d' })
      const addUser = await userCollection.updateOne(find, userDoc, options);

      res.send({ token, addUser })
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