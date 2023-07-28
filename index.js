const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()


const app = express()
const port = process.env.PORT || 7000

// middlewares
app.use(cors())
app.use(express.json())

// Database Connection
// const uri = "mongodb://localhost:27017"
const uri = "mongodb+srv://commonDb:common2212@cluster0.dkggbgt.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})

async function run() {
  try {
    const homesCollection = client.db('aircnc-db').collection('homes')
    const userCollection = client.db('aircnc-db').collection('users')
    const bookingsCollection = client.db('aircnc-db').collection('bookings')

    // Save your email and jwt
    app.put('/user/:email', async (req, res)=>{
        const email = req.params.email;
        const user = req.body;
        const filter = {email: email}
        const options = {upsert: true}
        const docUpdate={
            $set:user
        }
        const result = await userCollection.updateOne(filter, docUpdate, options)
        
        console.log(result)
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
            expiresIn:'1d'
        })
        console.log('token',token);
        res.send({result, token})
    })


    //get all bookings for admin
    // app.get('/bookings', async(req, res)=>{
    //   const query = {}
    //   const booking = bookingsCollection.find(query).toArray()
    //   console.log(booking);
    //   res.send(booking)
      
    // })


    //Get all bookings by query
    app.get('/bookings', async(req, res)=>{
      let query = {}
      const email = req.query.email;
      if(email){
        query = {
          guestEmail: email,
        }
      }
      const booking = await bookingsCollection.find(query).toArray()
      console.log(booking);
      res.send(booking)
      
    })




    //Save Bookings
    app.post('/bookings', async(req, res)=>{
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      console.log(result)
      res.send(result)

    })



    console.log('Database Connected.....now')
  } finally {
  }
}

run().catch(err => console.error(err))

app.get('/', (req, res) => {
  res.send('Server is running...')
})

app.listen(port, () => {
  console.log(`Server is running...on ${port}`)
})
