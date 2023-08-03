const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const nodemailer = require("nodemailer");
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


const app = express()
const port = process.env.PORT || 7000

// middlewares
app.use(cors())
app.use(express.json())

//JWT
function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: 'unathorized access'})
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      return res.status(403).send({message: 'Foriddend access'})
    }
    console.log(decoded)
    req.decoded = decoded
    next()
  })
}

//Send Email
const sendMail = (emailData, email) =>{
  //...https://miracleio.me/snippets/use-gmail-with-nodemailer 

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_ADD,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from:process.env.EMAIL_ADD, 
    to: email,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
   console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

}

// Database Connection
// const uri = "mongodb://localhost:27017"
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dkggbgt.mongodb.net/?retryWrites=true&w=majority`;
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
        
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
            expiresIn:'1d'
        })
        res.send({result, token})
    })

    //Get all users for admin
    app.get('/users', async (req, res) =>{
      const query = {};
      const users = await userCollection.find(query).toArray()
      res.send(users)
    })

    //Get a single user by email
    app.get('/user/:email', async (req, res) =>{
      const email = req.params.email;
      const query ={ email: email}
      const user = await userCollection.findOne(query)
      console.log(user.role)
      res.send(user)
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
      res.send(booking)
      
    })


    //Save Bookings
    app.post('/bookings', async(req, res)=>{
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      console.log(result)
      sendMail(
        {
          subject:'Booking Successful', 
          message:`Booking Id: ${result?.insertedId}`
        }, bookingData?.guestEmail)

      res.send(result)

    })


    //Create Payment intent
    app.post('/create-payment-intent', async (req, res)=>{

      const price = req.body.price;
      const amount = parseFloat(price * 100)

      try {

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'jpy',
          payment_method_types: ['card'],
        })

        res.send({clientSecret: paymentIntent.client_secret})
        
      } catch (error) {
        console.log(error)
      }



    })


    // Delete Booking
    app.delete('/booking/:id', async (req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const deleteBooking = await bookingsCollection.deleteOne(filter)
      res.send(deleteBooking);
    }) 



    //get Home
    app.get('/homes', async(req, res) =>{
      const query = {}
      const homes = await homesCollection.find(query).toArray()
      console.log(homes)
      res.send(homes)
    })

    //get Single home
    app.get('/homes/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const home = await homesCollection.findOne(query)
      console.log(home)
      res.send(home)
    })

    //Save Homes
    app.post('/homes', async(req, res)=>{
      const homeData = req.body;
      const result = await homesCollection.insertOne(homeData);
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
