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
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'unathorized access' })
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Foriddend access' })
    }
    console.log(decoded)
    req.decoded = decoded
    next()
  })
}









//Send Email
const sendMail = (emailData, email) => {
  //...https://miracleio.me/snippets/use-gmail-with-nodemailer 

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_ADD,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_ADD,
    to: email,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`
  };

  transporter.sendMail(mailOptions, function (error, info) {
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

    //Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      console.log('admin true')
      next()
    }






    // Save your email and jwt
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email }
      const options = { upsert: true }
      const docUpdate = {
        $set: user
      }
      const result = await userCollection.updateOne(filter, docUpdate, options)

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '1d'
      })
      res.send({ result, token })
    })

    //Get all users for admin
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await userCollection.find(query).toArray()
      res.send(users)
    })

    //Get a single user by email
    app.get('/user/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      res.send(user)
    })



    //get all bookings for admin
    app.get('/bookings', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {}
      const booking = await bookingsCollection.find(query).toArray()
      console.log(booking, 'allbookings');
      res.send(booking)

    })


    //Get all bookings by query
    app.get('/bookings-by-email', verifyJWT, async (req, res) => {
      let query = {}
      const email = req.query.email;
      if (email) {
        query = {
          guestEmail: email,
        }
      }
      const booking = await bookingsCollection.find(query).toArray()
      res.send(booking)

    })


    //Save Bookings
    app.post('/bookings', async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      sendMail(
        {
          subject: 'Booking Successful',
          message: `Booking Id: ${result?.insertedId}, TransactionId: ${bookingData.transactionID}`
        }, bookingData?.guestEmail)

      res.send(result)

    })


    //Create Payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {

      const price = req.body.price;
      const amount = parseFloat(price * 100)
      console.log(amount);
      try {

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'jpy',
          payment_method_types: ['card'],
        })

        res.send({ clientSecret: paymentIntent.client_secret })

      } catch (error) {
        console.log(error)
      }



    })


    // Delete Booking
    app.delete('/booking/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const deleteBooking = await bookingsCollection.deleteOne(filter)
      res.send(deleteBooking);
    })


    // all home apiu start from here


    //get all Homes
    app.get('/homes', async (req, res) => {
      const query = {}
      const homes = await homesCollection.find(query).toArray()
      res.send(homes)
    })


    // // get all homes for host
    app.get('/homes/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { 'host.email': email };
      const homes = await homesCollection.find(query).toArray()
      console.log(homes)
      res.send(homes)
    })



    //get Single home
    app.get('/home/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      console.log(query)
      const home = await homesCollection.findOne(query)
      res.send(home)
    })



    //Save Homes
    app.post('/homes', verifyJWT, async (req, res) => {
      const homeData = req.body;
      const result = await homesCollection.insertOne(homeData);
      res.send(result)

    })

    // Update a home for Host
    app.put('/homes', verifyJWT, async (req, res) => {
      const home = req.body;
      const filter = {}
      const options = { upsert: true }
      const updateDoc = {
        $set: home,
      }
      const result = await homesCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })


    // Delete a home for host 
    app.delete('/single-home/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await homesCollection.deleteOne(query)
      res.send(result)
      console.log(result, 'host delete')
    })



    //Search Result
      app.get('/search-result', async(req, res) =>{
        const query ={};
        const location = req.query.location;
        if(location) query.location = location

        const cursor = homesCollection.find(query)
        const homes = await cursor.toArray()
        res.send(homes)
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
