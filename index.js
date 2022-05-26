const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors')
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_KEY)

app.use(cors());
app.use(express.json());

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
    const reviewCollection = client.db('Expert_Tools').collection('reviews');

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

    // load all orders 
    app.get('/allorders', async(req, res) => {
      const userEmail = req.query.userEmail;
      const result = await orderCollection.find({}).toArray();
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

    // load specific order 
    app.get('/paymentorder', async(req, res) => {
      const orderId = req.query.toolId;
      const query = { _id: ObjectId(orderId) };
      const result = await orderCollection.findOne(query);
      res.send(result)
    })

    // update order status
    app.put('/paymentsuccess', async(req, res) => {

      const transactionId = req.query.trxId;
      const toolId = req.query.toolId;
      const toolQuery = { _id: ObjectId(toolId) }

      const find = await orderCollection.findOne(toolQuery);
      const updateDoc = {
        $set: { paymentStatus: 'Paid' }
      }

      const result = await orderCollection.updateOne(find, updateDoc);
      res.send(result)

    })

    // make admin shipped status 
    app.put('/makeshipped', async(req, res) => {

      const orderId = req.query.orderId;
      const query = { _id: ObjectId(orderId) };

      const find = await orderCollection.findOne(query);
      const updatDoc = {
        $set: { shipped: 'true' }
      }

      const result = await orderCollection.updateOne(find, updatDoc);
      res.send(result)

    })

    // post review 
    app.post('/addreview', async(req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result)
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

    // update user profile 
    app.put('/users', async(req, res) => {
      const updateObj = req.body;
      const userEmail = req.headers.authorization.split(' ')[1];
      
      const find = await userCollection.findOne({ email: userEmail })
      const updatDoc = {
        $set: updateObj
      }
      const result = await userCollection.updateOne(find, updatDoc);
    })

    // load all users 
    app.get('/allusers', async(req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    })

    // make admin user
    app.put('/makeadmin', async(req, res) => {
      const adminId = req.query.adminId;

      const findQuery = {_id: ObjectId(adminId)};
      const find = await userCollection.findOne(findQuery);
      const options = { upsert: true }
      console.log(adminId)

      const updatDoc = {
        $set: { role: 'Admin'}

      }

      const result = await userCollection.updateOne(find, updatDoc, options);
      res.send(result)


    })

    // payment intent 
    app.post('/paymentintent', async(req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });

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