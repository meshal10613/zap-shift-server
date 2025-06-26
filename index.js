require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@meshal10613.mbbtx0s.mongodb.net/?retryWrites=true&w=majority&appName=meshal10613`;
const YOUR_DOMAIN = 'http://localhost:5173';

app.get("/", async(req, res) => {
    res.send("Server is running...");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const userCollection = client.db("zap-shift").collection("users");
        const parcelCollection = client.db("zap-shift").collection("parcels");
        const paymentsCollection = client.db("zap-shift").collection("payments");
        const trackingCollection = client.db("zap-shift").collection("payments");

        // parcelCollection
        app.get("/parcels", async(req, res) => {
            try{
                const {email} = req.query;
                const query = email ? { created_by: email } : {};
                const options = {
                    sort: { creation_date: -1 } //sort by latest first
                }
                const result = await parcelCollection.find(query, options).toArray();
                res.send(result);
            }catch(error){
                console.log("Error getting percel:", error);
                res.status(500).send({ message: "Failed to get percel" })
            }
        });

        app.get("/parcels/:id", async(req, res) => {
            try{
                const { id } = req.params;
                const query = { _id: new ObjectId(id) };
                const result = await parcelCollection.findOne(query);
                res.send(result);
            }catch(error){
                console.log("Error getting percel:", error);
                res.status(500).send({ message: "Failed to get percel" })
            }
        });

        app.post("/parcels", async(req, res) => {
            try{
                const newParcel = req.body;
                const result = await parcelCollection.insertOne(newParcel);
                res.status(201).send(result);
            }catch (error){
                console.log("Error inserting percel:", error);
                res.status(500).send({ message: "Failed to create a percel" })
            }
        });

        app.delete("/parcels/:id", async(req, res) => {
            const {id} = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        });

        //paymentsCollection
        app.get('/payments', async (req, res) => {

            try {
                const email = req.query.email;
                // console.log('decocded', req.decoded)
                // if (req.decoded.email !== userEmail) {
                //     return res.status(403).send({ message: 'forbidden access' })
                // }

                const query = email ? { email: email } : {};
                const options = { sort: { paid_at: -1 } }; // Latest first

                const payments = await paymentsCollection.find(query, options).toArray();
                res.send(payments);
            } catch (error) {
                console.error('Error fetching payment history:', error);
                res.status(500).send({ message: 'Failed to get payments' });
            }
        });

        // POST: Record payment and update parcel status
        app.post('/payments', async (req, res) => {
            try {
                const { id, email, amount, paymentMethod, transactionId } = req.body;

                // 1. Update parcel's payment_status
                const updateResult = await parcelCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            payment_status: 'paid'
                        }
                    }
                );

                if (updateResult.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Parcel not found or already paid' });
                }

                // 2. Insert payment record
                const paymentDoc = {
                    id,
                    email,
                    amount,
                    paymentMethod,
                    transactionId,
                    paid_at_string: new Date().toISOString(),
                    paid_at: new Date(),
                };

                const paymentResult = await paymentsCollection.insertOne(paymentDoc);

                res.status(201).send({
                    message: 'Payment recorded and parcel marked as paid',
                    insertedId: paymentResult.insertedId,
                });

            } catch (error) {
                console.error('Payment processing failed:', error);
                res.status(500).send({ message: 'Failed to record payment' });
            }
        });

        //trackingCollection
        app.post("/tracking", async (req, res) => {
            const { tracking_id, parcel_id, status, message, updated_by = '' } = req.body;

            const log = {
                tracking_id,
                parcel_id: parcel_id ? new ObjectId(parcel_id) : undefined,
                status,
                message,
                time: new Date(),
                updated_by,
            };

            const result = await trackingCollection.insertOne(log);
            res.send({ success: true, insertedId: result.insertedId });
        });

        //payment
        app.post('/create-payment-intent', async (req, res) => {
            const { amountInCents, id } = req.body;
            console.log(id)
            const session = await stripe.paymentIntents.create({
                // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                amount: amountInCents, //amount in cents 
                currency: "bdt",
                payment_method_types: ['card'],
                // return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
            });

            res.json({clientSecret: session.client_secret});
        });

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});