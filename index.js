require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
var admin = require("firebase-admin");
const { initializeApp } = require('firebase-admin/app');


//middleware
app.use(cors());
app.use(express.json());

//custom middleware
const verifyFirebaseToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).status({message: "unauthorized access"});
    };
    const token = authHeader.split(" ")[1];
    if(!token){
        res.status(401).status({message: "unauthorized access"});
    };
    //verify token
    try{
        const decocded = await admin.auth().verifyIdToken(token);
        req.decocded = decocded;
        next();
    }catch(error){
        return res.status(403).send({message: "forbidden access"});
    }
};

const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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
        const ridersCollection = client.db("zap-shift").collection("riders");

        // userCollection
        app.get("/users", async(req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.post("/users", async(req, res) => {
            const { email } = req.body;
            //chech user already exist or not
            const existUser = await userCollection.findOne({ email });
            if(existUser){
                const { lastSignInTime } = req.body;
                const query = { email: email };
                const updatedDoc = {
                    $set: {
                        lastSignInTime: lastSignInTime
                    }
                };
                const result = await userCollection.updateOne(query, updatedDoc);
                return res.status(200).send(result);
            };

            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.status(201).send(result);
        });

        // parcelCollection
        app.get("/parcels",verifyFirebaseToken, async(req, res) => {
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
        app.get('/payments', verifyFirebaseToken, async (req, res) => {

            try {
                const email = req.query.email;

                if(req.decocded.email !== email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

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

        //ridersCollection
        app.get("/riders/pending", verifyFirebaseToken, async(req, res) => {
            try {
                const pendingRiders = await ridersCollection.find({ status: "pending" }).toArray();
                res.send(pendingRiders);
            } catch (error) {
                console.error("Failed to load pending riders:", error);
                res.status(500).send({ message: "Failed to load pending riders" });
            }
        });

        app.get("/riders/active", verifyFirebaseToken, async(req, res) => {
            try {
                const activeRiders = await ridersCollection.find({ status: "active" }).toArray();
                res.send(activeRiders);
            } catch (error) {
                console.error("Failed to load active riders:", error);
                res.status(500).send({ message: "Failed to load active riders" });
            }
        });

        app.get("/riders/deactivated", verifyFirebaseToken, async(req, res) => {
            try {
                const deactivateRiders = await ridersCollection.find({ status: "deactivated" }).toArray();
                res.send(deactivateRiders);
            } catch (error) {
                console.error("Failed to load deactivated riders:", error);
                res.status(500).send({ message: "Failed to load deactivated riders" });
            }
        });
        
        app.post('/riders', async(req, res) => {
            const ridersData = req.body;
            const result = await ridersCollection.insertOne(ridersData);
            res.send(result);
        });

        app.patch('/riders/:id/status', async(req, res) => {
            const { id } = req.params;
            const { status, email } = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set:
                {
                    status
                }
            }

            try {
                const result = await ridersCollection.updateOne(
                    query, updateDoc
                );

                // update user role for accepting rider
                if (status === 'active') {
                    const userQuery = { email };
                    const userUpdateDoc = {
                        $set: {
                            role: 'rider'
                        }
                    };
                    const roleResult = await usersCollection.updateOne(userQuery, userUpdateDoc)
                    console.log(roleResult.modifiedCount)
                }

                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Failed to update rider status" });
            }
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